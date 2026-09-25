// Simulação do jogo (sem gráficos): estado, relógio, produção, obras, módulos, serviços,
// repasses, pedidos e capítulos. Tudo é calculado por horários, então o progresso continua
// com o jogo fechado. Os eventos avisam a interface e o mundo 3D.
//
// ---- API para a interface (contrato estável) ----
// Eventos (J.on((tipo, d) => …)); quem não conhece um evento pode ignorá-lo:
//   'fala'  {quem, texto, atraso?}       conselheiro fala (atraso em ms depois do evento; quem ∈ CONSELHO)
//   'aviso' {texto, icone, creditos?}    aviso curto (medição, marco, topógrafo, disposição, fila)
//   'nivel' {de, para, nivel, creditos, especiais[], especial, novos[], predios[], vagas[]}  um evento por subida,
//           mesmo que pule vários níveis (nivel = para; vagas = oficinas que ganharam o Selo de Mestre de Obras)
//   'novoCapitulo' {cap, anterior, escolha, novos[], abre[]}   'fimDeJogo' {cap, escolhas}  (último capítulo)
//   e os de antes: xp, coleta, produto, produzir, enfileirar {pend}, etapaIniciada/Pronta/Feita, moduloIniciado/
//   Pronto/Feito, capituloCompleto, mutirao, repasse, troca, pedido, predio, ampliar, almox, dica {id}, topografo.
// TUTORIAL, ABERTURA, DICAS, PEDIDOS, FALAS_ETAPA, MARCOS, EPILOGO, EFEITOS: em data/historia.js.
// J.planoMeta() → {acao, alvo, item, n, meta, texto, fim?, adiantar?} ou null. acao: 'aprovar' | 'coletar' | 'iniciar' |
//   'entregar' | 'produzir' | 'construir' | 'aguardar' | 'apresentar' (capítulo cumprido, falta o Conselho) |
//   'vender' (almoxarifado cheio: vender sobras no Depósito). alvo: {etapa:'proj.e'} | {modulo:[faixa,i]} | {predio:id} |
//   {repasse:true} | {topografo:k} | {capitulo:n} | {almox:true} (ampliar, com acao 'construir') | {deposito:true} |
//   {ampliar:id} (acao 'construir': +1 espaço na usina ou vaga na fila, quando a produção travou por falta de espaço);
//   texto: a ação em português ("Produzir 2 Concreto na Central de Concreto"); meta: a meta do capítulo (txt).
//   adiantar: true quando tudo das metas está em espera e o plano sugere produzir já o que as próximas etapas e
//   pavimentos vão pedir (texto 'Adiantar: …'; fim = quando a espera termina).
// J.metaProgresso(meta) → {feito, total, txt}  ('3/8', 'etapa 2/5', 'nível 12/15').
// S.mutirao: fichas (teto FICHAS_MAX = 3). S.disposicao 0..100: +2 pedido, +4 módulo, +8 etapa, +30 marco;
//   em 100 vira 1 ficha. J.mutirao(alvo) adianta até 2 h (usina: todos os espaços; oficina: o item atual).
// J.encomendarLicenca(k) → 'ok'|'ocupado'|'falta'|'creditos'|'nada'. TOPOGRAFO[k] = {itens, creditos, min};
//   S.topografo = {k, ini, fim} | null (uma por vez; ao terminar, +1 licença e 'aviso').
// J.estoqueDeposito(k) → {n, preco}  (10 por matéria-prima a cada janela de 4 h, preço sobe 12% por compra);
//   J.vendasDeposito() → {feitas, max}; J.comprar(k) → 'ok'|'esgotado'|'creditos'|'almox'|'bloqueado';
//   J.vender(k, n) → 'ok'|'limite'|'nada'|'nao'.
// J.servicoInfo(tipo) → {cap, uso} (tipo 'agua'|'energia'|'saneamento'); J.bemInfo() → {total, fontes[], pressao}.
// Pedidos (S.pedidos[i]): {id, modelo, quem, onde, cor, fala, itens, recompensa, espera} com
//   recompensa = {creditos, xp, itens?:{id:n}, bem?:{n,h}, disposicao?}; (creditos, xp, especial: cópias antigas).
// Escolhas do Conselho (CAPITULOS[n].escolha[]): {id, quem, txt, ganho, custo, porque, dica (as três juntas)}; valem nos capítulos seguintes.
// Consultas com efeitos das escolhas: J.itensEtapa(p,e), J.custoEtapa(p,e), J.durEtapa(p,e), J.durItem(k),
//   J.predioLiberado(id), J.vagasFila(id), J.requisitosModulo(f,i) → {…, servicos[], bemMin}.
// Números das regras para a interface: REGRAS {fichasMax 3, mutiraoH 2, cofreH 4, capPedidos 2 (o painel de pedidos
//   abre no capítulo 2, não por nível), bandeja 9, filaMax 9, filaSelo 12, usinaMax 6, pendH 12}; servicosDoNivel(n)
//   (3: água; 4 em diante: energia e saneamento) e bemMinimo(n) (70 no 5º pavimento); J.liberado(k) diz se um item
//   já pode ser produzido (nível e capítulo) e J.durItem(k) o tempo real dele (com escolhas e a rampa de saves antigos).
// Save: prepararSave(S) = normalizar(migrar(S)); uma migração pode deixar S._avisos (textos para um brinde; main.js
//   mostra e apaga). F_OBRA[6] = 0,15 de propósito: o epílogo é uma festa curta, não uma espera.
import { ITENS, PREDIOS, USINAS, OFICINAS, XP_NIVEL, NIVEIS_SELO } from '../data/itens.js';
import { PROJETOS, PROJ, MODULOS, LIMITE_CAP, POP_NIVEL, POOL_NIVEL, CUSTO_NIVEL, TEMPO_NIVEL, SERVICO_NIVEL, BEM_NIVEL, PRESSAO_MORADIA } from '../data/obras.js';
import { CAPITULOS, EFEITOS, MARCOS, FALAS_ETAPA, EPILOGO, PEDIDOS } from '../data/historia.js';

export const VERSAO_SAVE = 2;
const N_MODULOS = { anel: 8, uni: 4, anelBib: 3, casas: 6, santuario: 5 };
const MAX_ESPECIAL = 999;
// ajuste global de ritmo (o jogador ainda escolhe 1x, 2x ou 4x nas configurações)
const F_ITEM = 0.65, F_MODULO = 0.8, F_OBRA_ANTIGO = 0.7;
export const F_PRODUTO = 0.88;
export const F_OBRA = { 1: 0.7, 2: 1.5, 3: 3, 4: 4, 5: 5, 6: 0.15 }; // obras mais longas a cada capítulo; o epílogo é festa, não espera
export const FICHAS_MAX = 3;
const BANDEJA = 9, FILA_MAX = 9, USINA_MAX = 6, FILA_SELO = 12, MUTIRAO_MS = 2 * 3600e3, PEND_MS = 12 * 3600e3;
const PASSO_OFF = 5 * 60e3, PASSOS_MAX = 288, RAMPA_MS = 48 * 3600e3;
export const COFRE_H = 4, CAP_PEDIDOS = 2; // horas de repasse que o cofre guarda; capítulo em que os pedidos começam
// números das regras para a interface mostrar (em vez de constantes soltas nos textos)
export const REGRAS = { fichasMax: FICHAS_MAX, mutiraoH: MUTIRAO_MS / 3600e3, cofreH: COFRE_H, capPedidos: CAP_PEDIDOS, bandeja: BANDEJA, filaMax: FILA_MAX, filaSelo: FILA_SELO, usinaMax: USINA_MAX, pendH: PEND_MS / 3600e3 };
export function servicosDoNivel(n) { const out = []; for (const [lv, ks] of Object.entries(SERVICO_NIVEL)) if (+lv <= n) out.push(...ks); return out; } // serviços que um pavimento de nível n pede
export function bemMinimo(n) { return BEM_NIVEL[n] || 0; } // bem-estar mínimo para subir um módulo ao nível n
// economia (medida pelo robô em sessões): repasse = (base + por morador) × (0,5 + bem-estar) por minuto; a medição devolve
// parte do custo quando a etapa é aprovada, então os créditos são capital de giro e não uma parede
// e diminui no fim, quando os repasses de uma arcologia cheia já pagam as obras (sem inflação no epílogo)
const REPASSE = [24, 0.0025], MEDICAO = { 1: 0.7, 2: 0.7, 3: 0.7, 4: 0.6, 5: 0.5, 6: 0.6 }, DISP = { pedido: 2, modulo: 4, etapa: 8, marco: 30 };
const DEP = { janela: 4 * 3600e3, estoque: 10, sobe: 1.12, vendas: 20, venda: 0.6 };
export const TOPOGRAFO = { estaca: { itens: { madeira: 2 }, creditos: 300, min: 20 }, baliza: { itens: { aco: 2 }, creditos: 600, min: 30 }, trena: { itens: { cobre: 2 }, creditos: 900, min: 45 } };
const LICENCAS = ['estaca', 'baliza', 'trena'], ALMOX = ['estrado', 'etiqueta', 'cadeado'];
const QUEDA = { estaca: ['madeira', 0.006], baliza: ['serralheria', 0.03], trena: ['eletrica', 0.03] }; // licenças caem de onde fazem sentido
const hashS = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v, d = 0) => (Number.isFinite(+v) && v !== null && v !== '' ? +v : d);
const fmtN = (n) => Math.round(n).toLocaleString('pt-BR');
const hhmm = (t) => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const EM = { horto: 'no', laboratorio: 'no', escritorio: 'no', almox: 'no' };
const noPredio = (id) => `${EM[id] || 'na'} ${PREDIOS[id]?.nome || id}`;
const nomeIt = (k) => ITENS[k]?.nome || k;

export function novoEstado(agora = Date.now()) {
  const S = {
    v: VERSAO_SAVE, criado: agora, t: agora, creditos: 3000, xp: 0, nivel: 1, mutirao: 1, disposicao: 0, cap: 1, capEscolhas: {}, marcos: {},
    bonus: { usina: 0, oficina: 0, almox: 0, repasse: 0, bem: 0, xp: 0 }, ritmo: 1,
    itens: {}, almoxNivel: 1,
    predios: {}, etapas: {}, modulos: {}, pedidos: [], repasse: { acum: 0, t: agora }, dicas: {}, desbloq: {},
    topografo: null, deposito: { janela: 0, n: {}, vendas: 0 }, bemTemp: [],
    stats: { coletas: 0, obras: 0, jogadoMs: 0, mutiroes: 0, pedidos: 0, compras: 0, vendas: 0, dispGanha: 0, dispPerdida: 0 }, seq: 1,
  };
  for (const k of Object.keys(ITENS)) S.itens[k] = 0;
  S.itens.madeira = 6; S.itens.brita = 4; S.itens.estaca = 1;
  for (const [id, p] of Object.entries(PREDIOS)) {
    if (p.tipo === 'usina') S.predios[id] = { ok: id === 'usina1', slots: [null, null, null], nSlots: 3 };
    else if (p.tipo === 'oficina') S.predios[id] = { ok: false, fila: [], prontos: [], nFila: 3 };
    else S.predios[id] = { ok: true };
  }
  for (const [f, n] of Object.entries(N_MODULOS)) S.modulos[f] = Array.from({ length: n }, () => ({ nivel: 0, obra: null }));
  return S;
}

// ---------------- save: migrações e normalização (nunca perde o progresso) ----------------
const bonusZero = () => ({ usina: 0, oficina: 0, almox: 0, repasse: 0, bem: 0, xp: 0 });
export const MIGRACOES = {
  1: (S, agora) => { // v1 → v2: escolhas viram efeitos, teto de 3 fichas, epílogo em duas etapas, itens de capítulos adiante
    const esc = {}; for (const [n, id] of Object.entries(S.capEscolhas || {})) esc[n] = typeof id === 'string' && !Object.hasOwn(EFEITOS, id) ? 'legado:' + id : typeof id === 'string' ? id : null;
    S.capEscolhas = esc; S.bonus = bonusZero();
    // fichas acima do teto: enchem a disposição (100 = 1 ficha guardada) e o resto vira créditos (1.500 × capítulo por ficha)
    const m = Math.max(0, num(S.mutirao) | 0), avisos = (S._avisos = Array.isArray(S._avisos) ? S._avisos : []);
    if (m > FICHAS_MAX) { const x = m - FICHAS_MAX, d = clamp(num(S.disposicao), 0, 100), entra = Math.min(100 * x, 100 - d), cr = Math.round(15 * num(S.cap, 1) * (100 * x - entra));
      S.disposicao = d + entra; S.mutirao = FICHAS_MAX; S.creditos = num(S.creditos) + cr;
      avisos.push(`O Mutirão agora guarda até ${FICHAS_MAX} fichas: ${x > 1 ? `as ${x} a mais viraram` : 'a ficha a mais virou'} disposição${cr ? ` e ${fmtN(cr)} créditos` : ''}`); }
    // cofre de repasses das regras antigas (8 h, taxa maior): vai inteiro para os créditos; o teto novo (COFRE_H) o cortaria
    const ac = objeto(S.repasse) ? Math.floor(num(S.repasse.acum)) : 0;
    if (ac > 0) { S.creditos = num(S.creditos) + ac; S.repasse.acum = 0; avisos.push(`Repasses guardados no cofre antigo: +${fmtN(ac)} créditos`); }
    const r = objeto(S.etapas) ? S.etapas['reflorestar.e1'] : null; if (objeto(r) && r.estado && r.estado !== 'prancha') S.etapas['reflorestar.e0'] = { estado: 'feita', entregue: {} };
    const cap = num(S.cap, 1), adiante = (k) => ITENS[k] && (ITENS[k].cap || 1) > cap, leg = new Set();
    for (const [k, v] of Object.entries(S.itens || {})) if (num(v) > 0 && adiante(k)) leg.add(k);
    const lista = (v) => (Array.isArray(v) ? v : []);
    for (const p of Object.values(objeto(S.predios) ? S.predios : {})) { for (const f of lista(p?.fila)) if (adiante(f?.item)) leg.add(f.item); for (const k of lista(p?.prontos)) if (adiante(k)) leg.add(k); }
    for (const p of lista(S.pedidos)) for (const k of Object.keys(objeto(p?.itens) ? p.itens : {})) if (adiante(k)) leg.add(k);
    S.legado = [...leg]; S.migradoEm = agora; S.v = 2;
  },
};
export function migrar(S, agora = Date.now()) { if (!(S.v >= 1)) S.v = 1; let g = 0; while (S.v < VERSAO_SAVE && MIGRACOES[S.v] && g++ < 20) MIGRACOES[S.v](S, agora); return S; }
const objeto = (o) => o && typeof o === 'object' && !Array.isArray(o);
const tem = (o, k) => Object.hasOwn(o, k); // chaves que vêm do save: 'constructor' ou '__proto__' não são itens nem obras
function mesclar(base, v) { // merge profundo: base dá os padrões, v prevalece e chaves desconhecidas ficam
  if (!objeto(v)) return base; const out = { ...base };
  for (const [k, x] of Object.entries(v)) out[k] = objeto(base[k]) && objeto(x) ? mesclar(base[k], x) : x;
  return out;
}
// soma dos efeitos das escolhas do Conselho (e do bônus antigo, se houver); pura, também serve à normalização do save
function efeitos(S) {
  const E = { bem: 0, almox: 0, repasse: 0, energia: 0, usina: 0, oficina: 0, xp: 0, fila: 0, oficinas: {}, itens: {}, custoEtapa: {}, tempoEtapa: {}, itensEtapa: {}, maisItens: {}, requer: {}, semRequer: {}, modulo: {} };
  for (const k of ['usina', 'oficina', 'almox', 'repasse', 'bem', 'xp']) E[k] += num(S.bonus?.[k]);
  for (const id of Object.values(S.capEscolhas || {})) {
    const ef = typeof id === 'string' && Object.hasOwn(EFEITOS, id) ? EFEITOS[id] : null; if (!ef) continue;
    for (const parte of [ef.bonus, ef.custo]) {
      if (!parte || (parte.ateCap && S.cap >= parte.ateCap)) continue;
      for (const [k, v] of Object.entries(parte)) {
        if (k === 'ateCap') continue; if (typeof v === 'number') { E[k] = (E[k] || 0) + v; continue; }
        for (const [a, x] of Object.entries(v)) {
          if (k === 'requer') (E.requer[a] ||= []).push(...x); else if (k === 'itensEtapa') E.itensEtapa[a] = (E.itensEtapa[a] ?? 1) * x;
          else if (k === 'maisItens') { const d = (E.maisItens[a] ||= {}); for (const [it, n] of Object.entries(x)) d[it] = (d[it] || 0) + n; }
          else if (k === 'modulo') { for (const [lv, its] of Object.entries(x)) { const d = ((E.modulo[a] ||= {})[lv] ||= {}); for (const [it, n] of Object.entries(its)) d[it] = (d[it] || 0) + n; } } else E[k][a] = (E[k][a] || 0) + x;
        }
      }
    }
  }
  return E;
}
// itens de uma etapa com os efeitos das escolhas (o mesmo cálculo de Jogo.itensEtapa)
function itensCom(E, p, e) { const key = p.id + '.' + e.id; const f = E.itensEtapa[key]; const out = {}; for (const [k, n] of Object.entries(e.itens)) out[k] = f ? Math.max(1, Math.round(n * f)) : n; for (const [k, n] of Object.entries(E.maisItens[key] || {})) out[k] = (out[k] || 0) + n; for (const [k, n] of Object.entries(e.licencas || {})) out[k] = n; return out; }
export function normalizar(S, agora = Date.now()) {
  if (!objeto(S)) return novoEstado(agora);
  const B = novoEstado(num(S.criado, agora)); const orf = objeto(S._orfaos) ? { ...S._orfaos } : {}; const guarda = (g, k, v) => { (orf[g] ||= {})[k] = v; };
  const O = { ...S };
  for (const k of ['bonus', 'stats', 'repasse', 'dicas', 'desbloq', 'deposito', 'capEscolhas', 'marcos']) O[k] = mesclar(B[k], S[k]);
  for (const k of Object.keys(O.bonus)) O.bonus[k] = num(O.bonus[k]); for (const k of Object.keys(O.stats)) if (typeof B.stats[k] === 'number') O.stats[k] = num(O.stats[k]);
  for (const [n, id] of Object.entries(O.capEscolhas)) if (id != null && typeof id !== 'string') O.capEscolhas[n] = null;
  if (!objeto(O.deposito.n)) O.deposito.n = {};
  O.v = Math.max(num(S.v, VERSAO_SAVE), VERSAO_SAVE); O.criado = num(S.criado, agora); O.t = num(S.t, agora);
  O.creditos = Math.max(0, Math.round(num(S.creditos))); O.xp = Math.max(0, num(S.xp)); O.nivel = clamp(num(S.nivel, 1) | 0, 1, XP_NIVEL.length - 1);
  O.cap = clamp(num(S.cap, 1) | 0, 1, CAPITULOS.length); O.mutirao = clamp(num(S.mutirao) | 0, 0, FICHAS_MAX); O.disposicao = clamp(num(S.disposicao), 0, 100);
  const E = efeitos(O); // vagas e itens a mais das escolhas (para a fila e as entregas abaixo)
  O.almoxNivel = Math.max(1, num(S.almoxNivel, 1) | 0); O.seq = Math.max(1, num(S.seq, 1) | 0); O.ritmo = num(S.ritmo, 1) > 0 ? num(S.ritmo, 1) : 1;
  O.repasse.acum = Math.max(0, num(O.repasse.acum));
  // itens: todos os do jogo (0 se faltar); desconhecidos vão para _orfaos
  O.itens = {}; for (const k of Object.keys(ITENS)) O.itens[k] = Math.max(0, Math.round(num(S.itens?.[k])));
  for (const [k, v] of Object.entries(objeto(S.itens) ? S.itens : {})) if (!tem(ITENS, k)) guarda('itens', k, v);
  const itemOk = (k) => typeof k === 'string' && tem(ITENS, k) && ITENS[k].tipo !== 'especial';
  // prédios
  O.predios = {};
  for (const [id, P] of Object.entries(PREDIOS)) {
    const b = B.predios[id], s = objeto(S.predios?.[id]) ? S.predios[id] : null; const o = { ...(s || {}), ...b, ok: s ? !!s.ok : b.ok };
    if (P.tipo === 'usina') { o.nSlots = clamp(num(s?.nSlots, 3) | 0, 3, USINA_MAX); o.slots = Array.from({ length: o.nSlots }, (_, i) => { const x = s?.slots?.[i]; return x && typeof x.item === 'string' && tem(ITENS, x.item) && ITENS[x.item].tipo === 'bruto' ? { item: x.item, ini: num(x.ini, O.t), fim: num(x.fim, O.t) } : null; }); }
    else if (P.tipo === 'oficina') {
      o.nFila = clamp(num(s?.nFila, 3) | 0, 3, FILA_SELO);
      o.fila = []; for (const f of Array.isArray(s?.fila) ? s.fila : []) { if (!itemOk(f?.item)) { guarda('fila', id + ':' + (f?.item || '?'), f); continue; } const g = { item: f.item, ini: num(f.ini), fim: num(f.fim) }; if (f.pend) { g.pend = true; g.desde = num(f.desde, O.t); g.ini = g.fim = 0; } o.fila.push(g); }
      o.prontos = (Array.isArray(s?.prontos) ? s.prontos : []).filter((k) => { if (itemOk(k)) return true; guarda('prontos', id + ':' + k, k); return false; });
      // fila maior que as vagas (save antigo): as compradas passam a cobrir o que já estava lá, sem contar as vagas das escolhas
      if (o.fila.length > o.nFila + E.fila) o.nFila = Math.min(FILA_SELO, o.fila.length - E.fila);
    }
    O.predios[id] = o;
  }
  for (const [id, v] of Object.entries(objeto(S.predios) ? S.predios : {})) if (!tem(PREDIOS, id)) guarda('predios', id, v);
  // etapas: só as que existem; na prancha, entregas acima do pedido (com os itens a mais ou a menos das escolhas)
  // voltam para o almoxarifado; em obra, pronta ou feita o material já foi usado e nada volta
  O.etapas = {};
  for (const [key, st] of Object.entries(S.etapas || {})) {
    const [pid, eid] = key.split('.'); const p = tem(PROJ, pid) ? PROJ[pid] : null, e = p?.etapas.find((x) => x.id === eid); if (!e || !objeto(st)) { guarda('etapas', key, st); continue; }
    const estado = ['prancha', 'obra', 'pronta', 'feita'].includes(st.estado) ? st.estado : 'prancha'; const n = { ...st, estado, entregue: {} };
    const req = estado === 'prancha' ? itensCom(E, p, e) : null;
    for (const [k, q] of Object.entries(objeto(st.entregue) ? st.entregue : {})) { const v = Math.max(0, Math.round(num(q))); if (!tem(ITENS, k)) { guarda('entregue', key + ':' + k, v); continue; } const u = req ? Math.min(v, req[k] || 0) : v; if (u) n.entregue[k] = u; if (v > u) O.itens[k] += v - u; }
    if (estado === 'obra' || estado === 'pronta') { n.ini = num(st.ini, O.t); n.fim = num(st.fim, O.t); }
    O.etapas[key] = n;
  }
  // módulos: N por faixa; os que sobrarem vão para _orfaos
  O.modulos = {};
  for (const [f, N] of Object.entries(N_MODULOS)) {
    const arr = Array.isArray(S.modulos?.[f]) ? S.modulos[f] : [];
    O.modulos[f] = Array.from({ length: N }, (_, i) => {
      const m = arr[i]; if (!objeto(m)) return { nivel: 0, obra: null };
      const out = { ...m, nivel: clamp(num(m.nivel) | 0, 0, MODULOS[f].max), obra: null };
      if (objeto(m.obra) && ['obra', 'pronta'].includes(m.obra.estado) && num(m.obra.para) > out.nivel && num(m.obra.para) <= MODULOS[f].max) out.obra = { estado: m.obra.estado, para: m.obra.para | 0, ini: num(m.obra.ini, O.t), fim: num(m.obra.fim, O.t) };
      if (m.pedido && (!objeto(m.pedido.itens) || Object.keys(m.pedido.itens).some((k) => !tem(ITENS, k)))) delete out.pedido;
      return out;
    });
    if (arr.length > N) guarda('modulos', f, arr.slice(N));
  }
  for (const [f, v] of Object.entries(objeto(S.modulos) ? S.modulos : {})) if (!tem(N_MODULOS, f)) guarda('modulos', f, v);
  // pedidos, topógrafo, bem-estar temporário, escolhas
  O.pedidos = (Array.isArray(S.pedidos) ? S.pedidos : []).filter(objeto).map((p) => (p.itens && (!objeto(p.itens) || Object.keys(p.itens).some((k) => !tem(ITENS, k))) ? { id: p.id, espera: O.t, itens: null } : { ...p, espera: num(p.espera, O.t) }));
  O.topografo = objeto(S.topografo) && typeof S.topografo.k === 'string' && tem(TOPOGRAFO, S.topografo.k) ? { k: S.topografo.k, ini: num(S.topografo.ini, O.t), fim: num(S.topografo.fim, O.t) } : null;
  O.bemTemp = (Array.isArray(S.bemTemp) ? S.bemTemp : []).filter((b) => objeto(b) && num(b.n) > 0).map((b) => ({ n: num(b.n), fim: num(b.fim) }));
  O.legado = Array.isArray(S.legado) ? S.legado.filter((k) => typeof k === 'string' && tem(ITENS, k)) : [];
  if (Object.keys(orf).length) O._orfaos = orf; else delete O._orfaos;
  return O;
}
export function prepararSave(S, agora = Date.now()) { return normalizar(migrar(S, agora), agora); }

export class Jogo {
  constructor(S) { this.S = S; this.ouvintes = []; this.agora = S.t; this._derivar(); }
  on(fn) { this.ouvintes.push(fn); }
  emit(tipo, dados = {}) { for (const f of this.ouvintes) f(tipo, dados); }
  // ---------------- consultas ----------------
  get capacidade() { return 60 + 20 * (this.S.almoxNivel - 1) + this.ef.almox; }
  get ocupado() { let n = 0; for (const [k, v] of Object.entries(this.S.itens)) if (ITENS[k] && ITENS[k].tipo !== 'especial') n += v; return n; }
  get livre() { return this.capacidade - this.ocupado; }
  temItem(k, n = 1) { return (this.S.itens[k] || 0) >= n; }
  liberado(item) {
    const I = ITENS[item], S = this.S; if (!I || I.nivel > S.nivel) return false;
    if ((I.cap || 1) > S.cap && !S.legado?.includes(item)) return false;
    return !I.oficina || !!S.predios[I.oficina]?.ok;
  }
  predioLiberado(id) { const P = PREDIOS[id]; return P.nivel <= this.S.nivel && (!P.requer || this.feita(P.requer) || !!this.ef.semRequer[id]); }
  etapa(key) { return this.S.etapas[key] || { estado: 'nada', entregue: {} }; }
  feita(key) {
    if (!key) return true;
    const [a, b] = key.split('.');
    if (MODULOS[a] || N_MODULOS[a]) { const n = +b; return this.S.modulos[a].some((m) => m.nivel >= n); }
    return this.etapa(key).estado === 'feita';
  }
  capEtapa(p, e) { return e.cap || p.cap; }
  projAberto(p) { return (p.cap <= this.S.cap) && (p.requer || []).every((r) => this.feita(r)); }
  requerEtapa(p, e) { return [...(p.requer || []), ...(e.requer || []), ...(this.ef.requer[p.id + '.' + e.id] || [])]; }
  // estado de disponibilidade de uma etapa: 'feita' | 'obra' | 'pronta' | 'prancha' | 'disponivel' | 'bloqueada' | 'futura'
  situacao(p, e) {
    const key = p.id + '.' + e.id; const st = this.etapa(key);
    if (st.estado === 'feita' || st.estado === 'obra' || st.estado === 'pronta') return st.estado;
    if (this.capEtapa(p, e) > this.S.cap) return 'futura';
    const i = p.etapas.indexOf(e); if (i > 0 && !this.feita(p.id + '.' + p.etapas[i - 1].id)) return 'bloqueada';
    if (!this.requerEtapa(p, e).every((r) => this.feita(r))) return 'bloqueada';
    return st.estado === 'prancha' ? 'prancha' : 'disponivel';
  }
  // a prancha aceita materiais (inclusive antes de abrir, quando a etapa tem preEntrega)
  aceitaEntrega(p, e) { const s = this.situacao(p, e); return s === 'disponivel' || s === 'prancha' || (!!e.preEntrega && this.S.cap >= e.preEntrega && (s === 'futura' || s === 'bloqueada')); }
  proximaEtapa(p) { for (const e of p.etapas) { const s = this.situacao(p, e); if (s !== 'feita') return { e, s }; } return null; }
  // itens, custo e tempo de uma etapa com os efeitos das escolhas do Conselho
  itensEtapa(p, e) { return itensCom(this.ef, p, e); }
  custoEtapa(p, e) { return Math.round(e.custo * (1 + (this.ef.custoEtapa[p.id + '.' + e.id] || 0))); }
  durEtapa(p, e) { return this.dur(e.t, 'obra', this.capEtapa(p, e)) * (1 + (this.ef.tempoEtapa[p.id + '.' + e.id] || 0)); }
  _pe(key) { const [pid, eid] = key.split('.'); const p = PROJ[pid]; return [p, p?.etapas.find((x) => x.id === eid)]; }
  // módulos
  limiteModulo(f) { const L = LIMITE_CAP[f]; if (!L) return MODULOS[f].max; let v = 0; for (const [c, n] of Object.entries(L)) if (this.S.cap >= +c) v = n; return v; }
  moduloAberto(f, i) {
    const M = MODULOS[f]; if (M.cap > this.S.cap) return false; if (!(M.requer || []).every((r) => this.feita(r))) return false;
    if (f === 'anel' && this.S.cap === 1 && i >= M.inicio) return false; return true;
  }
  pedidoModulo(f, i, nivel) { // itens pedidos para subir ao "nivel" (sorteio fixo por módulo e nível)
    const S = this.S; const pool = (POOL_NIVEL[nivel] || []).filter((k) => ITENS[k].nivel <= Math.max(S.nivel, 1) && (ITENS[k].cap || 1) <= S.cap && (!ITENS[k].oficina || S.predios[ITENS[k].oficina]?.ok || ITENS[k].tipo === 'bruto'));
    const base = pool.length ? pool : ['viga'];
    const n = Math.min(nivel === 1 ? 2 : 3, base.length); const out = {};
    const ord = base.slice().sort((a, b) => hashS(f + i + nivel + a) - hashS(f + i + nivel + b));
    for (const k of ord.slice(0, n)) out[k] = 1 + ((hashS(f + i + nivel + k + 'q') * (nivel >= 4 ? 3 : 2)) | 0);
    return out;
  }
  populacao() { let p = 0; for (const [f, arr] of Object.entries(this.S.modulos)) for (const m of arr) p += Math.round(MODULOS[f].pop * POP_NIVEL[m.nivel]); return p; }
  servicos() {
    const s = { agua: 0, energia: 0, saneamento: 0 };
    for (const p of PROJETOS) for (const e of p.etapas) if (e.servico && this.feita(p.id + '.' + e.id)) for (const [k, v] of Object.entries(e.servico)) s[k] += v;
    s.energia = Math.max(0, s.energia + this.ef.energia); return s;
  }
  servicoInfo(tipo) { return { cap: this.serv[tipo] || 0, uso: this.pop }; }
  _bemTemp() { let n = 0; for (const b of this.S.bemTemp) if (b.fim > this.agora) n += b.n; return Math.min(6, n); }
  // bem-estar: obras de lazer menos a pressão de moradia (quanto mais gente, mais praça e verde é preciso)
  bemEstar() { let b = 35 + this.ef.bem + this._bemTemp() - this.populacao() / PRESSAO_MORADIA; for (const p of PROJETOS) for (const e of p.etapas) if (e.bem && this.feita(p.id + '.' + e.id)) b += e.bem; return Math.round(clamp(b, 0, 100)); }
  bemInfo() {
    const fontes = []; for (const p of PROJETOS) for (const e of p.etapas) if (e.bem && this.feita(p.id + '.' + e.id)) fontes.push({ txt: p.nome, v: e.bem });
    if (this.ef.bem) fontes.push({ txt: 'Escolhas do Conselho', v: this.ef.bem }); const t = this._bemTemp(); if (t) fontes.push({ txt: 'Pedidos atendidos', v: t });
    fontes.sort((a, b) => b.v - a.v); return { total: this.bem, base: 35, fontes, pressao: Math.round(this.pop / PRESSAO_MORADIA) };
  }
  taxaRepasse() { // créditos por minuto
    return (REPASSE[0] + this.pop * REPASSE[1]) * (0.5 + this.bem / 100) * Math.max(0, 1 + this.ef.repasse);
  }
  vida() { // porcentagem da composição concluída
    let tot = 0, ok = 0;
    for (const p of PROJETOS) for (const e of p.etapas) { tot += 1; if (this.feita(p.id + '.' + e.id)) ok += 1; }
    for (const [f, arr] of Object.entries(this.S.modulos)) for (const m of arr) { tot += MODULOS[f].max * 0.5; ok += m.nivel * 0.5; }
    return (ok / tot) * 100;
  }
  _efeitos() { return efeitos(this.S); }
  _derivar() { this.ef = this._efeitos(); this.pop = this.populacao(); this.serv = this.servicos(); this.bem = this.bemEstar(); }
  // ---------------- relógio ----------------
  _rampa() { const m = this.S.migradoEm; return m ? clamp((this.agora - m) / RAMPA_MS, 0, 1) : 1; } // saves antigos entram no ritmo novo em 48 h
  fObra(cap) { const f = F_OBRA[cap] ?? F_OBRA[6]; return F_OBRA_ANTIGO + (f - F_OBRA_ANTIGO) * this._rampa(); }
  dur(seg, tipo, cap) {
    const S = this.S, ef = this.ef;
    if (tipo === 'usina') return (seg * 1000 * F_ITEM) / (S.ritmo * (1 + ef.usina));
    if (tipo === 'oficina') return (seg * 1000 * F_PRODUTO) / (S.ritmo * (1 + ef.oficina));
    if (tipo === 'obra') return (seg * 1000 * this.fObra(cap ?? S.cap)) / S.ritmo;
    if (tipo === 'modulo') return (seg * 1000 * F_MODULO) / S.ritmo;
    return (seg * 1000) / S.ritmo;
  }
  durItem(k) {
    const I = ITENS[k]; if (I.tipo === 'bruto') return this.dur(I.t, 'usina');
    const fT = 1 + ((I.fT || 1) - 1) * this._rampa(); const v = 1 + this.ef.oficina + (this.ef.oficinas[I.oficina] || 0) + (this.ef.itens[k] || 0);
    return ((I.t0 ?? I.t) * fT * 1000 * F_PRODUTO) / (this.S.ritmo * v);
  }
  tick(agora = Date.now()) {
    const S = this.S; const t0 = S.t; const dt = Math.max(0, agora - t0);
    // tempo fechado: as oficinas andam em passos (uma pode esperar o produto da outra), com teto de custo
    if (dt > PASSO_OFF * 1.5) { const n = Math.min(PASSOS_MAX, Math.ceil(dt / PASSO_OFF)); for (let i = 1; i < n; i++) { this.agora = t0 + (dt * i) / n; this._oficinas(this.agora); } }
    S.t = agora; this.agora = agora; S.stats.jogadoMs += Math.min(dt, 5000);
    this._oficinas(agora);
    // obras e módulos
    for (const [key, st] of Object.entries(S.etapas)) if (st.estado === 'obra' && st.fim <= agora) { st.estado = 'pronta'; this.emit('etapaPronta', { key }); }
    for (const [f, arr] of Object.entries(S.modulos)) arr.forEach((m, i) => { if (m.obra && m.obra.estado === 'obra' && m.obra.fim <= agora) { m.obra.estado = 'pronta'; this.emit('moduloPronto', { faixa: f, i }); } });
    // topógrafo
    const tp = S.topografo; if (tp && tp.fim <= agora) { S.itens[tp.k] = Math.min(MAX_ESPECIAL, S.itens[tp.k] + 1); S.topografo = null; this.emit('aviso', { texto: `Topógrafo: ${nomeIt(tp.k)} entregue`, icone: tp.k }); }
    // bem-estar temporário dos pedidos
    if (S.bemTemp.length && S.bemTemp.some((b) => b.fim <= agora)) { S.bemTemp = S.bemTemp.filter((b) => b.fim > agora); this._derivar(); }
    // repasses (acumulam até COFRE_H horas; o que já está no cofre nunca encolhe, nem quando a taxa cai)
    if (this.repassesAtivos()) { const r = S.repasse; const tx = this.taxaRepasse(), max = tx * 60 * COFRE_H; if (r.acum < max) r.acum = Math.min(max, r.acum + (tx * dt) / 60000); }
    this._pedidos(agora); this._pedidoModulos();
  }
  repassesAtivos() { return true; }
  // oficinas: fila em cadeia; o item da frente espera insumos sem segurar a fila; bandeja cheia para a fila
  _oficinas(ate) { for (const id of OFICINAS) if (this.S.predios[id].ok) this._oficina(id, ate); }
  _oficina(id, ate) {
    const o = this.S.predios[id]; let desde = ate;
    for (let j = o.fila.length - 1; j >= 0; j--) { const f = o.fila[j]; if (f.pend && ate - f.desde >= PEND_MS) { o.fila.splice(j, 1); this.emit('aviso', { texto: `${nomeIt(f.item)} saiu da fila ${noPredio(id)}: faltaram insumos por 12 h`, icone: f.item, predio: id }); } }
    for (let g = 0; g < 64; g++) {
      let f = o.fila[0]; if (!f) break;
      if (!f.fim) { if (o.prontos.length >= BANDEJA || !this._comecar(o, desde)) break; f = o.fila[0]; }
      if (f.fim > ate) break;
      o.fila.shift(); o.prontos.push(f.item); this.emit('produto', { predio: id, item: f.item, ini: f.ini, fim: f.fim }); desde = f.fim;
      if (o.prontos.length >= BANDEJA) break; // bandeja cheia: o próximo só começa (com o tempo inteiro) depois da coleta
    }
  }
  _comecar(o, quando) { // põe na frente o primeiro item que pode começar e liga o cronômetro
    for (let j = 0; j < o.fila.length; j++) {
      const g = o.fila[j]; if (g.pend && !this._puxar(g)) continue;
      if (j) { o.fila.splice(j, 1); o.fila.unshift(g); }
      delete g.pend; delete g.desde; g.ini = quando; g.fim = quando + this.durItem(g.item); return true;
    }
    return false;
  }
  _puxar(g) { // encomenda em cadeia: insumos do almoxarifado ou da bandeja da oficina que os produz
    const S = this.S, req = ITENS[g.item].req;
    for (const [k, n] of Object.entries(req)) { const tem = S.itens[k] || 0; if (tem >= n) continue; const I = ITENS[k]; if (I.tipo !== 'produto') return false; const src = S.predios[I.oficina]; let nb = 0; for (const x of src?.prontos || []) if (x === k) nb++; if (tem + nb < n) return false; }
    for (const [k, n] of Object.entries(req)) { let falta = n - Math.min(n, S.itens[k] || 0); if (falta > 0) { const src = S.predios[ITENS[k].oficina]; while (falta-- > 0) { src.prontos.splice(src.prontos.indexOf(k), 1); this._receber(k, 1, ITENS[k].oficina, true); } } S.itens[k] -= n; }
    return true;
  }
  // ---------------- ações ----------------
  _xp(n, motivo) {
    const S = this.S; const g = Math.round(n * (1 + this.ef.xp)); S.xp += g; this.emit('xp', { n: g, motivo });
    const de = S.nivel; let cr = 0; const especiais = [], vagas = [];
    while (S.nivel < XP_NIVEL.length - 1 && S.xp >= XP_NIVEL[S.nivel + 1]) {
      S.nivel++; const c = 300 + 50 * S.nivel; cr += c; S.creditos += c;
      const esp = ALMOX[(Math.random() * 3) | 0]; S.itens[esp] = Math.min(MAX_ESPECIAL, S.itens[esp] + 1); especiais.push(esp);
      if (NIVEIS_SELO.includes(S.nivel)) { const o = this._selo(); if (o) vagas.push(o); }
    }
    if (S.nivel === de) return;
    const novos = Object.keys(ITENS).filter((k) => ITENS[k].nivel > de && ITENS[k].nivel <= S.nivel && (ITENS[k].cap || 1) <= S.cap);
    const predios = Object.keys(PREDIOS).filter((k) => PREDIOS[k].nivel > de && PREDIOS[k].nivel <= S.nivel);
    this.emit('nivel', { de, para: S.nivel, nivel: S.nivel, creditos: cr, especiais, especial: especiais[0], novos, predios, vagas });
    this._pedidoModulos(); this._verCapitulo();
  }
  _selo() { // Selo de Mestre de Obras: +1 vaga na oficina de fila mais cheia
    let best = null; for (const id of OFICINAS) { const o = this.S.predios[id]; if (!o.ok || o.nFila >= FILA_SELO) continue; if (!best || o.fila.length > this.S.predios[best].fila.length) best = id; }
    if (best) { this.S.predios[best].nFila++; this.emit('aviso', { texto: `Selo de Mestre de Obras: +1 vaga ${noPredio(best)}`, icone: 'subir', predio: best }); } return best;
  }
  _sorteiaEspecial(licencaMais) { const g = Math.random() < (licencaMais ? 0.5 : 0.62) ? ALMOX : LICENCAS; return g[(Math.random() * g.length) | 0]; }
  _achar(k) { this.S.itens[k] = Math.min(MAX_ESPECIAL, this.S.itens[k] + 1); return k; }
  _receber(item, n = 1, origem = '', direto = false) { // entra no almoxarifado (com chance de item especial)
    const S = this.S, I = ITENS[item]; S.itens[item] += n; S.stats.coletas += n; let esp = null;
    for (let u = 0; u < n; u++) {
      for (const [k, [fonte, p]] of Object.entries(QUEDA)) if ((item === fonte || I.oficina === fonte) && Math.random() < p) esp = this._achar(k);
      if (Math.random() < 0.03) esp = this._achar(ALMOX[(Math.random() * 3) | 0]);
    }
    this._xp((I.tipo === 'bruto' ? 1 : 2 + Math.floor(I.nivel / 4)) * n, 'coleta');
    this.emit('coleta', { item, n, especial: esp, origem, direto });
    if (!direto && this.livre <= 0) this.emit('dica', { id: 'almoxCheio' });
    return true;
  }
  produzir(uid, item) {
    const u = this.S.predios[uid]; if (!u?.ok) return 'fechado'; if (ITENS[item].tipo !== 'bruto' || !this.liberado(item)) return 'bloqueado';
    const i = u.slots.findIndex((s, k) => k < u.nSlots && !s); if (i < 0) return 'cheio';
    const s = (u.slots[i] = { item, ini: this.agora, fim: this.agora + this.durItem(item) }); this.emit('produzir', { predio: uid, item, slot: i, ini: s.ini, fim: s.fim }); return 'ok';
  }
  coletarUsina(uid, i) {
    const u = this.S.predios[uid]; const s = u.slots[i]; if (!s || s.fim > this.agora) return 'nada'; if (this.livre < 1) { this.emit('dica', { id: 'almoxCheio' }); return 'almox'; }
    u.slots[i] = null; this._receber(s.item, 1, uid); return 'ok';
  }
  prontosUsina(uid) { const u = this.S.predios[uid]; return u.slots.map((s, i) => (s && s.fim <= this.agora ? i : -1)).filter((i) => i >= 0); }
  // encadear: aceita o item sem insumos; ele espera na fila e puxa os insumos quando ficarem prontos
  enfileirar(oid, item, encadear = false) {
    const o = this.S.predios[oid]; if (!o?.ok) return 'fechado'; if (ITENS[item].oficina !== oid || !this.liberado(item)) return 'bloqueado';
    if (o.fila.length >= this.vagasFila(oid)) return 'cheio';
    const req = ITENS[item].req; const tem = Object.entries(req).every(([k, n]) => this.temItem(k, n)); if (!tem && !encadear) return 'falta';
    const f = { item, ini: 0, fim: 0 }; if (tem) { for (const [k, n] of Object.entries(req)) this.S.itens[k] -= n; } else { f.pend = true; f.desde = this.agora; }
    o.fila.push(f); this._oficina(oid, this.agora); this.emit('enfileirar', { predio: oid, item, pend: !tem }); return 'ok';
  }
  coletarOficina(oid) {
    const o = this.S.predios[oid]; if (!o.prontos.length) return 'nada';
    let n = 0; while (o.prontos.length && this.livre >= 1) { this._receber(o.prontos.shift(), 1, oid); n++; }
    if (!n) { this.emit('dica', { id: 'almoxCheio' }); return 'almox'; }
    this._oficina(oid, this.agora); // a fila volta a andar se estava parada por bandeja cheia
    return 'ok';
  }
  construirPredio(id) {
    const p = PREDIOS[id], st = this.S.predios[id]; if (st.ok) return 'ja'; if (p.nivel > this.S.nivel) return 'nivel'; if (!this.predioLiberado(id)) return 'requer';
    if (this.S.creditos < (p.custo || 0)) return 'creditos'; this.S.creditos -= p.custo || 0; st.ok = true; this._xp(20 + (p.custo || 0) / 50, 'predio'); this.emit('predio', { id }); this._verCapitulo(); return 'ok';
  }
  vagasFila(id) { return this.S.predios[id].nFila + this.ef.fila; } // vagas da fila (as compradas e as das escolhas do Conselho)
  custoEspaco(id) { const st = this.S.predios[id]; const usina = PREDIOS[id].tipo === 'usina'; const n = usina ? st.nSlots - 1 : st.nFila - 1; return Math.round(300 * Math.pow(2.2, n - 2)); }
  ampliar(id) {
    const st = this.S.predios[id]; const usina = PREDIOS[id].tipo === 'usina'; const n = usina ? st.nSlots : st.nFila; if (n >= (usina ? USINA_MAX : FILA_MAX)) return 'max';
    const c = this.custoEspaco(id); if (this.S.creditos < c) return 'creditos'; this.S.creditos -= c;
    if (usina) { st.nSlots++; st.slots.push(null); } else st.nFila++; this.emit('ampliar', { id }); return 'ok';
  }
  pedidoAlmox() { const k = 1 + Math.floor((this.S.almoxNivel - 1) / 2); return { estrado: k, etiqueta: k, cadeado: k }; }
  ampliarAlmox() { const req = this.pedidoAlmox(); for (const [k, n] of Object.entries(req)) if (!this.temItem(k, n)) return 'falta'; for (const [k, n] of Object.entries(req)) this.S.itens[k] -= n; this.S.almoxNivel++; this._xp(40, 'almox'); this.emit('almox', {}); return 'ok'; }
  // prancha: entrega parcial de itens de uma etapa
  entregar(key, item, n = 99) {
    const [p, e] = this._pe(key); if (!e || !this.aceitaEntrega(p, e)) return 'bloqueada';
    const req = this.itensEtapa(p, e); const st = this.S.etapas[key] || { estado: 'prancha', entregue: {} };
    const falta = (req[item] || 0) - (st.entregue[item] || 0); const q = Math.min(falta, n, this.S.itens[item] || 0);
    if (q <= 0) return 'nada'; this.S.etapas[key] = st; st.estado = 'prancha'; this.S.itens[item] -= q; st.entregue[item] = (st.entregue[item] || 0) + q; this.emit('entregar', { key, item, n: q }); return 'ok';
  }
  entregarTudo(key) { const [p, e] = this._pe(key); if (!e) return 'nada'; let ok = false; for (const k of Object.keys(this.itensEtapa(p, e))) if (this.entregar(key, k) === 'ok') ok = true; return ok ? 'ok' : 'nada'; }
  faltaEtapa(key) { const [p, e] = this._pe(key); const st = this.etapa(key); const out = {}; for (const [k, n] of Object.entries(this.itensEtapa(p, e))) { const f = n - (st.entregue?.[k] || 0); if (f > 0) out[k] = f; } return out; }
  iniciarEtapa(key) {
    const [p, e] = this._pe(key); if (!e) return 'bloqueada'; const s = this.situacao(p, e);
    if (s !== 'disponivel' && s !== 'prancha') return 'bloqueada'; if (Object.keys(this.faltaEtapa(key)).length) return 'falta';
    const custo = this.custoEtapa(p, e); if (this.S.creditos < custo) return 'creditos';
    this.S.creditos -= custo; const st = this.S.etapas[key] || (this.S.etapas[key] = { entregue: {} });
    st.estado = 'obra'; st.pago = custo; st.ini = this.agora; st.fim = this.agora + this.durEtapa(p, e); this.emit('etapaIniciada', { key });
    if (!this.S.dicas.obraComecou) this.emit('dica', { id: 'obraComecou' }); return 'ok';
  }
  aprovarEtapa(key) {
    const st = this.S.etapas[key]; if (!st || st.estado !== 'pronta') return 'nada';
    const [p, e] = this._pe(key); const S = this.S;
    st.estado = 'feita'; st.entregue = {}; S.stats.obras++;
    const med = Math.round((st.pago ?? this.custoEtapa(p, e)) * MEDICAO[this.capEtapa(p, e)]); delete st.pago; S.creditos += med; // medição: a Holding paga pela etapa medida
    const xp = e.xp || Math.round(e.custo / 12 + Object.values(e.itens).reduce((a, b) => a + b, 0) * 12); this._xp(xp, 'etapa');
    this._derivar(); this.emit('etapaFeita', { key, p, e });
    this.emit('aviso', { texto: `Medição aprovada: +${fmtN(med)}`, icone: 'creditos', creditos: med });
    const fala = FALAS_ETAPA[key]; if (fala) this.emit('fala', { quem: fala[0], texto: fala[1], atraso: 1600, etapa: key });
    if (key === 'reflorestar.e1') { let k = 1; for (const n of [1, 5]) { const f = EPILOGO[S.capEscolhas[n]]; if (f) this.emit('fala', { quem: f[0], texto: f[1], atraso: 1600 + 7000 * k++ }); } }
    this._disposicao(DISP.etapa); this._pedidoModulos(); this._verCapitulo(); return 'ok';
  }
  // módulos (zonas residenciais)
  situacaoModulo(f, i) {
    const m = this.S.modulos[f][i]; if (m.obra) return m.obra.estado; if (!this.moduloAberto(f, i)) return 'bloqueado';
    if (m.nivel >= MODULOS[f].max) return 'max'; if (m.nivel >= this.limiteModulo(f)) return 'limite';
    return 'disponivel';
  }
  _pedidoModulos() { // o pedido do próximo pavimento é sorteado quando o módulo fica disponível (e não muda depois)
    for (const [f, arr] of Object.entries(this.S.modulos)) arr.forEach((m, i) => { if (m.pedido?.nivel === m.nivel + 1 || m.obra || this.situacaoModulo(f, i) !== 'disponivel') return; m.pedido = { nivel: m.nivel + 1, itens: this.pedidoModulo(f, i, m.nivel + 1) }; });
  }
  requisitosModulo(f, i) { // consulta pura
    const m = this.S.modulos[f][i]; const n = m.nivel + 1; const base = m.pedido?.nivel === n ? m.pedido.itens : this.pedidoModulo(f, i, n);
    const extra = this.ef.modulo[f]?.[n]; const itens = extra ? { ...base } : base; if (extra) for (const [k, q] of Object.entries(extra)) itens[k] = (itens[k] || 0) + q;
    const custo = CUSTO_NIVEL[n]; const servicos = servicosDoNivel(n);
    const popDepois = this.pop + Math.round(MODULOS[f].pop * ((POP_NIVEL[n] ?? 1) - POP_NIVEL[m.nivel]));
    const servOk = servicos.every((k) => this.serv[k] >= popDepois); const bemMin = bemMinimo(n); const bemOk = this.bem >= bemMin;
    return { nivel: n, itens, custo, servico: servicos.length ? servicos : null, servicos, servOk, bemOk, bemMin, tempo: TEMPO_NIVEL[n], popDepois };
  }
  melhorarModulo(f, i) {
    const s = this.situacaoModulo(f, i); if (s !== 'disponivel') return s; const r = this.requisitosModulo(f, i);
    if (!r.servOk) return 'servico'; if (!r.bemOk) return 'bem'; if (this.S.creditos < r.custo) return 'creditos';
    for (const [k, n] of Object.entries(r.itens)) if (!this.temItem(k, n)) return 'falta';
    for (const [k, n] of Object.entries(r.itens)) this.S.itens[k] -= n; this.S.creditos -= r.custo;
    this.S.modulos[f][i].obra = { estado: 'obra', para: r.nivel, ini: this.agora, fim: this.agora + this.dur(r.tempo, 'modulo') };
    this.emit('moduloIniciado', { faixa: f, i, nivel: r.nivel }); return 'ok';
  }
  aprovarModulo(f, i) {
    const m = this.S.modulos[f][i]; if (!m.obra || m.obra.estado !== 'pronta') return 'nada';
    m.nivel = m.obra.para; m.obra = null; delete m.pedido; const med = Math.round(CUSTO_NIVEL[m.nivel] * MEDICAO[this.S.cap]); this.S.creditos += med;
    this._xp(30 * m.nivel, 'modulo'); this._derivar(); this.emit('moduloFeito', { faixa: f, i, nivel: m.nivel });
    this.emit('aviso', { texto: `Medição aprovada: +${fmtN(med)}`, icone: 'creditos', creditos: med });
    this._disposicao(DISP.modulo); this._pedidoModulos(); this._verCapitulo(); return 'ok';
  }
  // Mutirão: a comunidade adianta até 2 horas de um cronômetro
  mutirao(alvo) {
    const S = this.S; if (S.mutirao < 1) return 'sem'; const a = this.agora; const adianta = (x) => { x.fim = Math.max(a, x.fim - MUTIRAO_MS); };
    if (alvo.etapa) { const st = S.etapas[alvo.etapa]; if (!st || st.estado !== 'obra') return 'nada'; adianta(st); }
    else if (alvo.modulo) { const m = S.modulos[alvo.modulo[0]][alvo.modulo[1]]; if (!m.obra || m.obra.estado !== 'obra') return 'nada'; adianta(m.obra); }
    else if (alvo.usina) { const u = S.predios[alvo.usina]; let ok = false; for (const s of u.slots) if (s && s.fim > a) { adianta(s); ok = true; } if (!ok) return 'nada'; }
    else if (alvo.oficina) { const o = S.predios[alvo.oficina]; const f = o.fila[0]; if (!f || !f.fim || f.fim <= a) return 'nada'; adianta(f); }
    else return 'nada';
    S.mutirao--; S.stats.mutiroes++; this._disposicao(0); this.tick(a); this.emit('mutirao', alvo); return 'ok';
  }
  _ficha(n) { const S = this.S; S.mutirao += n; if (S.mutirao > FICHAS_MAX) { const x = S.mutirao - FICHAS_MAX; S.mutirao = FICHAS_MAX; this._disposicao(100 * x); } }
  _disposicao(n) { // disposição da comunidade: 100 pontos viram 1 ficha de Mutirão (o que passa do teto se perde)
    const S = this.S; S.disposicao += n; S.stats.dispGanha += n;
    while (S.disposicao >= 100 && S.mutirao < FICHAS_MAX) { S.disposicao -= 100; S.mutirao++; this.emit('aviso', { texto: 'A comunidade se animou: +1 ficha de Mutirão', icone: 'mutirao' }); if (!S.dicas.disposicao) this.emit('dica', { id: 'disposicao' }); }
    if (S.disposicao > 100) { S.stats.dispPerdida += S.disposicao - 100; S.disposicao = 100; }
  }
  // topógrafo do Escritório: uma licença por vez, em troca de material e créditos
  encomendarLicenca(k) {
    const R = TOPOGRAFO[k], S = this.S; if (!R) return 'nada'; if (S.topografo) return 'ocupado';
    for (const [i, n] of Object.entries(R.itens)) if (!this.temItem(i, n)) return 'falta'; if (S.creditos < R.creditos) return 'creditos';
    for (const [i, n] of Object.entries(R.itens)) S.itens[i] -= n; S.creditos -= R.creditos;
    S.topografo = { k, ini: this.agora, fim: this.agora + this.dur(R.min * 60, 'topografo') }; this.emit('topografo', { k }); return 'ok';
  }
  // repasses da Holding (coletados na Sede ou, antes dela, no Escritório)
  coletarRepasse() { const r = this.S.repasse; const v = Math.floor(r.acum); if (v < 1) return 'nada'; r.acum -= v; this.S.creditos += v; this.emit('repasse', { v }); return 'ok'; }
  // depósito de trocas: estoque de 10 por matéria-prima a cada 4 h, preço sobe a cada compra; vendas limitadas
  _janela() { return Math.floor(this.agora / DEP.janela); }
  _dep() { const D = this.S.deposito, j = this._janela(); if (D.janela !== j) { D.janela = j; D.n = {}; D.vendas = 0; } return D; }
  estoqueDeposito(k) { const D = this.S.deposito; const n = D.janela === this._janela() ? D.n[k] || 0 : 0; return { n: Math.max(0, DEP.estoque - n), preco: Math.ceil(ITENS[k].valor * 3 * Math.pow(DEP.sobe, n)) }; }
  vendasDeposito() { const D = this.S.deposito; return { feitas: D.janela === this._janela() ? D.vendas : 0, max: DEP.vendas }; }
  precoCompra(k) { return this.estoqueDeposito(k).preco; }
  precoVenda(k) { return Math.max(1, Math.floor(ITENS[k].valor * DEP.venda)); }
  comprar(k) {
    if (ITENS[k].tipo !== 'bruto' || !this.liberado(k)) return 'bloqueado'; const est = this.estoqueDeposito(k); if (est.n < 1) return 'esgotado';
    if (this.S.creditos < est.preco) return 'creditos'; if (this.livre < 1) return 'almox';
    const D = this._dep(); D.n[k] = (D.n[k] || 0) + 1; this.S.creditos -= est.preco; this.S.itens[k]++; this.S.stats.compras++; this.emit('troca', { k, n: 1, creditos: -est.preco }); return 'ok';
  }
  vender(k, n = 1) {
    if (ITENS[k].tipo === 'especial') return 'nao'; const D = this._dep(); const q = Math.min(n, this.S.itens[k], DEP.vendas - D.vendas); if (this.S.itens[k] < 1) return 'nada'; if (q < 1) return 'limite';
    D.vendas += q; this.S.itens[k] -= q; this.S.creditos += q * this.precoVenda(k); this.S.stats.vendas += q; this.emit('troca', { k, n: -q }); return 'ok';
  }
  // pedidos da comunidade: 3 cartões no capítulo 2, 4 no 3, 6 depois
  _pedidos(agora) {
    const S = this.S; if (S.cap < CAP_PEDIDOS) return; const alvo = S.cap === 2 ? 3 : S.cap === 3 ? 4 : 6; const P = S.pedidos;
    while (P.length < alvo) P.push({ id: S.seq++, espera: agora, itens: null });
    for (const p of P) if (!p.itens && p.espera <= agora) this._gerarPedido(p);
  }
  _gerarPedido(p) {
    const S = this.S; const cap = Math.min(S.cap, 5);
    const ok = (k) => ITENS[k] && ITENS[k].tipo !== 'especial' && ITENS[k].nivel <= S.nivel - 2 && (ITENS[k].cap || 1) <= S.cap && this.liberado(k);
    let cands = PEDIDOS.map((m) => ({ m, op: (m.grupos[cap] || []).filter(ok) })).filter((x) => x.op.length);
    if (!cands.length) { p.espera = this.agora + 600000; return; }
    const usados = new Set(S.pedidos.filter((q) => q !== p && q.itens).map((q) => q.modelo)); const livres = cands.filter((x) => !usados.has(x.m.id)); if (livres.length) cands = livres;
    const { m, op } = cands[(Math.random() * cands.length) | 0];
    const tipos = Math.min(op.length, 1 + ((Math.random() * Math.min(3, 1 + S.nivel / 10)) | 0)); const ord = op.slice().sort(() => Math.random() - 0.5).slice(0, tipos);
    const itens = {}; let valor = 0; for (const k of ord) { const q = ITENS[k].tipo === 'bruto' ? 2 + ((Math.random() * 4) | 0) : 1 + ((Math.random() * 2) | 0); itens[k] = q; valor += ITENS[k].valor * q; }
    const rec = { creditos: Math.round(valor), xp: Math.round(valor / 9) }; const r = Math.random();
    const menos = (g) => g.slice().sort((a, b) => S.itens[a] - S.itens[b])[0];
    if (r < 0.3) rec.itens = { [menos(LICENCAS)]: 1 }; else if (r < 0.6) rec.itens = { [menos(ALMOX)]: 1 }; else if (r < 0.8) rec.bem = { n: 1, h: 24 }; else rec.disposicao = 15;
    Object.assign(p, { modelo: m.id, quem: m.quem, onde: m.onde, cor: m.cor, fala: m.fala, itens, recompensa: rec, creditos: rec.creditos, xp: rec.xp, especial: rec.itens ? Object.keys(rec.itens)[0] : null, mutirao: false });
  }
  entregarPedido(i) {
    const S = this.S; const p = S.pedidos[i]; if (!p?.itens) return 'nada'; for (const [k, n] of Object.entries(p.itens)) if (!this.temItem(k, n)) return 'falta';
    for (const [k, n] of Object.entries(p.itens)) S.itens[k] -= n;
    const R = p.recompensa || { creditos: p.creditos || 0, xp: p.xp || 0, itens: p.especial ? { [p.especial]: 1 } : null };
    S.creditos += R.creditos || 0; for (const [k, n] of Object.entries(R.itens || {})) S.itens[k] = Math.min(MAX_ESPECIAL, (S.itens[k] || 0) + n);
    if (R.bem) { S.bemTemp.push({ n: R.bem.n, fim: this.agora + R.bem.h * 3600e3 }); this._derivar(); }
    if (p.mutirao) this._ficha(1); this._disposicao(DISP.pedido + (R.disposicao || 0)); S.stats.pedidos++;
    this._xp(R.xp || 0, 'pedido'); this.emit('pedido', { ...p }); this._repor(i, 20000); return 'ok';
  }
  descartarPedido(i) { this._repor(i, 180000); return 'ok'; }
  _repor(i, ms) { if (this.S.cap < CAP_PEDIDOS) this.S.pedidos.splice(i, 1); else this.S.pedidos[i] = { id: this.S.seq++, espera: this.agora + ms, itens: null }; }
  // capítulos
  metaFeita(m) {
    if (m.tipo === 'etapa') return this.feita(m.id);
    if (m.tipo === 'predio') return this.S.predios[m.id]?.ok;
    if (m.tipo === 'modulos') return this.S.modulos[m.faixa].filter((x) => x.nivel >= m.nivel).length >= m.qtd;
    if (m.tipo === 'nivel') return this.S.nivel >= m.n;
    return false;
  }
  metaProgresso(m) {
    if (m.tipo === 'modulos') { const f = Math.min(m.qtd, this.S.modulos[m.faixa].filter((x) => x.nivel >= m.nivel).length); return { feito: f, total: m.qtd, txt: `${f}/${m.qtd}` }; }
    if (m.tipo === 'etapa') { const [p, e] = this._pe(m.id); const i = p.etapas.indexOf(e); let f = 0; for (let k = 0; k <= i; k++) if (this.feita(p.id + '.' + p.etapas[k].id)) f++; return { feito: f, total: i + 1, txt: i ? `etapa ${f}/${i + 1}` : `${f}/1` }; }
    if (m.tipo === 'nivel') { const f = Math.min(this.S.nivel, m.n); return { feito: f, total: m.n, txt: `nível ${this.S.nivel}/${m.n}` }; }
    const f = this.metaFeita(m) ? 1 : 0; return { feito: f, total: 1, txt: `${f}/1` };
  }
  capitulo() { return CAPITULOS[this.S.cap - 1]; }
  _verCapitulo() {
    const S = this.S, c = this.capitulo(); if (!c || S.capEscolhas[c.n] !== undefined) return;
    const n = c.metas.length, feitas = c.metas.filter((m) => this.metaFeita(m)).length;
    const M = MARCOS[c.n]; if (M) for (let k = (S.marcos[c.n] || 0) + 1; k <= 2; k++) { if (feitas < (k * n) / 3) break; S.marcos[c.n] = k; const cr = 1500 * c.n; S.creditos += cr; this.emit('fala', { quem: M[k - 1][0], texto: M[k - 1][1], atraso: 2400, marco: k }); this.emit('aviso', { texto: `Marco do capítulo: +${fmtN(cr)} créditos`, icone: 'creditos', creditos: cr }); this._disposicao(DISP.marco); }
    if (feitas === n) this.emit('capituloCompleto', { cap: c });
  }
  concluirCapitulo(escolha) {
    const S = this.S, c = this.capitulo(); if (!c || S.capEscolhas[c.n] !== undefined || !c.metas.every((m) => this.metaFeita(m))) return 'nada';
    const esc = (c.escolha || []).some((o) => o.id === escolha) ? escolha : null; S.capEscolhas[c.n] = esc;
    S.creditos += 2000 * c.n; this._ficha(1);
    if (S.cap >= CAPITULOS.length) { this._derivar(); this.emit('fimDeJogo', { cap: c, escolhas: { ...S.capEscolhas } }); return 'ok'; }
    S.cap++; this._derivar(); this._pedidoModulos(); const nv = this.capitulo();
    const novos = Object.keys(ITENS).filter((k) => ITENS[k].cap === nv.n && ITENS[k].nivel <= S.nivel);
    this.emit('novoCapitulo', { cap: nv, anterior: c, escolha: esc, novos, abre: nv.abre }); this._verCapitulo(); return 'ok';
  }
  // ---------------- próximo passo para as metas do capítulo (consulta pura) ----------------
  planoMeta() {
    const S = this.S, c = this.capitulo(); if (!c) return null;
    if (S.capEscolhas[c.n] === undefined && c.metas.every((m) => this.metaFeita(m))) return { acao: 'apresentar', alvo: { capitulo: c.n }, meta: null, texto: 'Apresentar o capítulo ao Conselho' };
    let espera = null;
    for (const m of c.metas) {
      if (this.metaFeita(m)) continue; let p = this._planoMeta(m); if (!p) continue; if (p.acao === 'coletar' && !p.alvo?.repasse && this.livre < 1) p = this._planoAlmox(); p.meta = m;
      if (p.acao !== 'aguardar') return p; if (!espera || (p.fim ?? Infinity) < (espera.fim ?? Infinity)) espera = p;
    }
    // tudo em espera: adiantar o que as metas ainda vão pedir (as filas trabalham enquanto o jogo está fechado)
    const ad = this._planoAdiantar(); if (ad) { ad.meta = espera?.meta ?? null; ad.adiantar = true; ad.fim = espera?.fim; ad.texto = 'Adiantar: ' + ad.texto; return ad; }
    return espera || { acao: 'aguardar', alvo: null, meta: null, texto: 'Produza materiais para as próximas obras' };
  }
  _planoAdiantar() { // itens das próximas etapas e pavimentos das metas abertas, menos o que já existe ou está a caminho
    const S = this.S, c = this.capitulo(); if (this.livre < Math.max(8, this.capacidade * 0.15)) return null; const falta = {};
    const add = (its) => { for (const [k, n] of Object.entries(its)) if (ITENS[k].tipo !== 'especial') falta[k] = (falta[k] || 0) + n; };
    for (const m of c.metas) {
      if (this.metaFeita(m)) continue;
      if (m.tipo === 'etapa') { const [p, e] = this._pe(m.id); for (const x of p.etapas) { const k = p.id + '.' + x.id; if (!['obra', 'pronta', 'feita'].includes(this.etapa(k).estado)) add(this.faltaEtapa(k)); if (x === e) break; } }
      else if (m.tipo === 'modulos') S.modulos[m.faixa].forEach((mm, i) => { if (!this.moduloAberto(m.faixa, i)) return; for (let lv = (mm.obra ? mm.obra.para : mm.nivel) + 1; lv <= Math.min(m.nivel, this.limiteModulo(m.faixa)); lv++) add(mm.pedido?.nivel === lv ? mm.pedido.itens : this.pedidoModulo(m.faixa, i, lv)); });
    }
    for (const [k, n] of Object.entries(falta)) { const r = n - (S.itens[k] || 0); if (r <= 0) continue; const pl = this._planoItem(k, r, 0); if (pl && (pl.acao === 'produzir' || pl.acao === 'coletar')) return pl; }
    // pranchas do capítulo seguinte que aceitam pré-entrega (o epílogo): recebem o que sobra das metas e a fila produz o resto
    for (const p of PROJETOS) { if (p.cap !== S.cap + 1) continue; for (const e of p.etapas) {
      const key = p.id + '.' + e.id; if (!e.preEntrega || S.cap < e.preEntrega || !this.aceitaEntrega(p, e)) continue;
      for (const [k, n] of Object.entries(this.faltaEtapa(key))) {
        if (ITENS[k].tipo === 'especial') continue; const sobra = (S.itens[k] || 0) - (falta[k] || 0);
        if (sobra > 0) return this._plano('entregar', { etapa: key }, `Entregar ${Math.min(n, sobra)} ${nomeIt(k)} em ${p.nome}`, { item: k, n: Math.min(n, sobra) });
        const pl = this._planoItem(k, n - sobra, 0); if (pl && (pl.acao === 'produzir' || pl.acao === 'coletar')) return pl;
      }
    } }
    return null;
  }
  _planoAlmox() { // almoxarifado cheio: ampliar se der, senão vender o que sobra
    if (Object.entries(this.pedidoAlmox()).every(([k, n]) => this.temItem(k, n))) return this._plano('construir', { almox: true }, 'Ampliar o Almoxarifado');
    return this._plano('vender', { deposito: true }, 'Almoxarifado cheio: vender sobras no Depósito de Trocas');
  }
  _planoMeta(m) {
    if (m.tipo === 'etapa') return this._planoEtapa(m.id, new Set());
    if (m.tipo === 'predio') return this._planoPredio(m.id, new Set());
    if (m.tipo === 'modulos') return this._planoModulo(m.faixa, m.nivel, new Set());
    return null;
  }
  _plano(acao, alvo, texto, o = {}) { return { acao, alvo, item: o.item ?? null, n: o.n ?? 0, meta: null, texto, fim: o.fim }; }
  _espera(a, b) { return !a || (b && (b.fim ?? Infinity) < (a.fim ?? Infinity)) ? b : a; }
  _planoReq(r, vistos) { if (vistos.has(r)) return null; vistos.add(r); const [a, b] = r.split('.'); return MODULOS[a] ? this._planoModulo(a, +b, vistos) : this._planoEtapa(r, vistos); }
  _planoEtapa(key, vistos) {
    const S = this.S; const [p0] = this._pe(key); if (!p0) return null; const nx = this.proximaEtapa(p0); if (!nx) return null;
    const p = p0, e = nx.e, k = p.id + '.' + e.id, s = nx.s, nome = `${p.nome}: ${e.nome}`;
    if (s === 'pronta') return this._plano('aprovar', { etapa: k }, `Aprovar ${nome}`);
    if (s === 'obra') { const st = this.etapa(k); return this._plano('aguardar', { etapa: k }, `Aguardar ${nome} (pronta às ${hhmm(st.fim)})`, { fim: st.fim }); }
    if (s === 'futura') return null;
    if (s === 'bloqueada') { for (const r of this.requerEtapa(p, e)) if (!this.feita(r)) { const pl = this._planoReq(r, vistos); if (pl) return pl; } return null; }
    const falta = this.faltaEtapa(k);
    if (!Object.keys(falta).length) { const custo = this.custoEtapa(p, e); return S.creditos >= custo ? this._plano('iniciar', { etapa: k }, `Iniciar ${nome}`) : this._planoCreditos(custo); }
    for (const [it, n] of Object.entries(falta)) if ((S.itens[it] || 0) > 0) { const q = Math.min(n, S.itens[it]); return this._plano('entregar', { etapa: k }, `Entregar ${q} ${nomeIt(it)} em ${p.nome}`, { item: it, n: q }); }
    return this._planoItens(falta);
  }
  _planoModulo(f, alvoNivel, vistos) {
    const S = this.S, arr = S.modulos[f], M = MODULOS[f]; let espera = null;
    for (let i = 0; i < arr.length; i++) if (arr[i].obra?.estado === 'pronta' && arr[i].nivel < alvoNivel) return this._plano('aprovar', { modulo: [f, i] }, `Aprovar ${M.nome}, módulo ${i + 1}`);
    const cands = arr.map((m, i) => i).filter((i) => arr[i].nivel < alvoNivel && this.situacaoModulo(f, i) === 'disponivel').sort((a, b) => arr[b].nivel - arr[a].nivel);
    // vários módulos em paralelo (as oficinas trabalham para todos): o estoque vai primeiro para os mais altos e o que
    // falta se soma, para a fila produzir para o seguinte o que já não está a caminho para o anterior
    const usado = {}, acum = {};
    for (const i of cands) {
      const r = this.requisitosModulo(f, i); const nome = `${M.nome}, módulo ${i + 1}`;
      if (!r.servOk) { const k = r.servicos.find((x) => this.serv[x] < r.popDepois); const pl = this._planoFonte((e) => e.servico?.[k], vistos); if (pl) return pl; continue; }
      if (!r.bemOk) { const pl = this._planoFonte((e) => e.bem, vistos); if (pl) return pl; continue; }
      const falta = {}; for (const [k, n] of Object.entries(r.itens)) { const tem = Math.max(0, (S.itens[k] || 0) - (usado[k] || 0)); if (tem < n) falta[k] = n - tem; usado[k] = (usado[k] || 0) + n; }
      if (!Object.keys(falta).length) return S.creditos >= r.custo ? this._plano('iniciar', { modulo: [f, i] }, `Subir ${nome} ao nível ${r.nivel}`) : this._planoCreditos(r.custo);
      for (const [k, n] of Object.entries(falta)) acum[k] = (acum[k] || 0) + n;
      const pl = this._planoItens(acum); if (pl.acao !== 'aguardar') return pl; espera = this._espera(espera, pl);
    }
    for (let i = 0; i < arr.length; i++) { const o = arr[i].obra; if (o?.estado === 'obra' && arr[i].nivel < alvoNivel) espera = this._espera(espera, this._plano('aguardar', { modulo: [f, i] }, `Aguardar ${M.nome}, módulo ${i + 1} (pronto às ${hhmm(o.fim)})`, { fim: o.fim })); }
    return espera;
  }
  _planoFonte(teste, vistos) { // etapa que dá o serviço ou o bem-estar que falta
    let espera = null;
    for (const p of PROJETOS) { if (p.cap > this.S.cap) continue; for (const e of p.etapas) { const k = p.id + '.' + e.id; if (!teste(e) || this.feita(k) || this.capEtapa(p, e) > this.S.cap || vistos.has(k)) continue; vistos.add(k); const pl = this._planoEtapa(k, vistos); if (pl && pl.acao !== 'aguardar') return pl; espera = this._espera(espera, pl); } }
    return espera;
  }
  _planoPredio(id, vistos) {
    const S = this.S, P = PREDIOS[id]; if (S.predios[id].ok) return null;
    if (P.nivel > S.nivel) return this._plano('aguardar', { predio: id }, `${P.nome} libera no nível ${P.nivel}`);
    if (!this.predioLiberado(id)) return this._planoReq(P.requer, vistos);
    return S.creditos >= (P.custo || 0) ? this._plano('construir', { predio: id }, `Construir ${P.nome}`) : this._planoCreditos(P.custo);
  }
  _planoEspaco(ids) { // produção travada por falta de espaço: uma usina nova ou uma vaga a mais, se sobra dinheiro para isso
    const S = this.S;
    for (const id of ids) { const P = PREDIOS[id]; if (!S.predios[id].ok && this.predioLiberado(id) && S.creditos >= (P.custo || 0) * 2) return this._plano('construir', { predio: id }, `Construir ${P.nome}`); }
    for (const id of ids) { const st = S.predios[id]; const usina = PREDIOS[id].tipo === 'usina'; if (!st.ok || (usina ? st.nSlots >= USINA_MAX : st.nFila >= FILA_MAX)) continue; const c = this.custoEspaco(id); if (S.creditos >= c * 3) return this._plano('construir', { ampliar: id }, `Ampliar ${PREDIOS[id].nome}: +1 ${usina ? 'espaço' : 'vaga na fila'} por ${fmtN(c)} créditos`); }
    return null;
  }
  _planoCreditos(v) {
    const r = this.S.repasse; if (r.acum >= 1 && this.S.creditos + r.acum >= v) return this._plano('coletar', { repasse: true }, 'Coletar os repasses da Holding');
    const tx = this.taxaRepasse(); const fim = this.agora + (Math.max(0, v - this.S.creditos - r.acum) / Math.max(0.01, tx)) * 60000;
    return this._plano('aguardar', { repasse: true }, `Juntar ${fmtN(v)} créditos (repasses e medições)`, { fim });
  }
  _planoItens(falta) { let espera = null; for (const [k, n] of Object.entries(falta)) { const pl = this._planoItem(k, n, 0); if (pl && pl.acao !== 'aguardar') return pl; espera = this._espera(espera, pl); } return espera || this._plano('aguardar', null, 'Aguardar a produção'); }
  _emProducao(k) { // quanto de k está pronto para coletar, a caminho e na fila à espera de insumos que ainda não existem
    const S = this.S; let pronto = 0, curso = 0, pend = 0, fim = Infinity, onde = null;
    for (const u of USINAS) { const st = S.predios[u]; if (!st.ok) continue; for (const s of st.slots) if (s?.item === k) { if (s.fim <= this.agora) { pronto++; onde = u; } else { curso++; fim = Math.min(fim, s.fim); } } }
    const I = ITENS[k]; if (I.oficina) { const o = S.predios[I.oficina]; if (o.ok) { const tem = Object.entries(I.req).every(([r, q]) => (S.itens[r] || 0) >= q);
      for (const x of o.prontos) if (x === k) { pronto++; onde = I.oficina; } for (const f of o.fila) if (f.item === k) { if (f.pend && !tem) pend++; else { curso++; if (f.fim) fim = Math.min(fim, f.fim); } } } }
    return { pronto, curso, pend, fim, onde };
  }
  _planoItem(k, n, prof) {
    const S = this.S, I = ITENS[k]; if (prof > 6) return null;
    if (I.tipo === 'especial') {
      if (I.grupo !== 'licenca') return null; const tp = S.topografo;
      if (tp) return this._plano('aguardar', { topografo: tp.k }, `Aguardar o Topógrafo (${nomeIt(tp.k)} às ${hhmm(tp.fim)})`, { fim: tp.fim });
      const R = TOPOGRAFO[k]; for (const [i, q] of Object.entries(R.itens)) if (!this.temItem(i, q)) return this._planoItem(i, q - (S.itens[i] || 0), prof + 1);
      return S.creditos >= R.creditos ? this._plano('produzir', { topografo: k }, `Encomendar ${nomeIt(k)} ao Topógrafo`, { item: k, n: 1 }) : this._planoCreditos(R.creditos);
    }
    const ep = this._emProducao(k);
    if (ep.pronto) return this._plano('coletar', { predio: ep.onde }, `Coletar ${nomeIt(k)} ${noPredio(ep.onde)}`, { item: k, n: ep.pronto });
    // bandeja cheia (de outro produto): a fila está parada e nada do que for pedido começa antes da coleta
    const of = I.oficina ? S.predios[I.oficina] : null;
    if (of?.ok && of.prontos.length >= BANDEJA) return this._plano('coletar', { predio: I.oficina }, `Coletar a bandeja cheia ${noPredio(I.oficina)} (a fila está parada)`, { item: of.prontos[0], n: of.prontos.length });
    if (ep.curso >= n) return this._plano('aguardar', { predio: I.oficina || null }, `Aguardar ${nomeIt(k)}${ep.fim < Infinity ? ` (pronto às ${hhmm(ep.fim)})` : ''}`, { item: k, fim: ep.fim < Infinity ? ep.fim : undefined });
    const faltam = n - ep.curso, novos = faltam - Math.min(ep.pend, faltam); // as encomendas que esperam insumos só pedem os insumos
    if (I.nivel > S.nivel || ((I.cap || 1) > S.cap && !S.legado?.includes(k))) return this._plano('aguardar', null, `${nomeIt(k)} libera no nível ${I.nivel}`, { item: k });
    if (I.tipo === 'bruto') {
      const u = USINAS.find((id) => { const st = S.predios[id]; return st.ok && st.slots.some((s, j) => j < st.nSlots && !s); });
      if (u) return this._plano('produzir', { predio: u }, `Produzir ${faltam} ${nomeIt(k)} ${noPredio(u)}`, { item: k, n: faltam });
      const mais = this._planoEspaco(USINAS); if (mais) return mais;
      let fim = Infinity; for (const id of USINAS) for (const s of S.predios[id].slots) if (s) fim = Math.min(fim, s.fim);
      return this._plano('aguardar', { predio: 'usina1' }, `Aguardar um espaço livre na Usina${fim < Infinity ? ` (às ${hhmm(fim)})` : ''}`, { item: k, fim: fim < Infinity ? fim : undefined });
    }
    const o = S.predios[I.oficina]; if (!o.ok) return this._planoPredio(I.oficina, new Set());
    if (novos > 0 && Object.entries(I.req).every(([r, q]) => (S.itens[r] || 0) >= q)) {
      if (o.fila.length < this.vagasFila(I.oficina)) return this._plano('produzir', { predio: I.oficina }, `Produzir ${novos} ${nomeIt(k)} ${noPredio(I.oficina)}`, { item: k, n: novos });
      const mais = this._planoEspaco([I.oficina]); if (mais) return mais;
      const fim = o.fila[0]?.fim || undefined; return this._plano('aguardar', { predio: I.oficina }, `Aguardar vaga na fila ${noPredio(I.oficina)}${fim ? ` (às ${hhmm(fim)})` : ''}`, { item: k, fim });
    }
    let espera = null;
    for (const [r, q] of Object.entries(I.req)) { const precisa = q * faltam - (S.itens[r] || 0); if (precisa <= 0) continue; const pl = this._planoItem(r, precisa, prof + 1); if (pl && pl.acao !== 'aguardar') return pl; espera = this._espera(espera, pl); }
    return espera;
  }
}
export { N_MODULOS };
