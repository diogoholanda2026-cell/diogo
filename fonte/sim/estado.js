// Simulação do jogo (sem gráficos): estado, relógio, produção, obras, módulos, serviços,
// repasses, pedidos e capítulos. Tudo é calculado por horários, então o progresso continua
// com o jogo fechado. Os eventos avisam a interface e o mundo 3D.
import { ITENS, PREDIOS, USINAS, OFICINAS, BRUTOS, XP_NIVEL, receitas } from '../data/itens.js';
import { PROJETOS, PROJ, MODULOS, LIMITE_CAP, POP_NIVEL, POOL_NIVEL, CUSTO_NIVEL, TEMPO_NIVEL, SERVICO_NIVEL } from '../data/obras.js';
import { CAPITULOS } from '../data/historia.js';

export const VERSAO_SAVE = 1;
const N_MODULOS = { anel: 8, uni: 4, anelBib: 3, casas: 6, santuario: 5 };
const MAX_ESPECIAL = 999;
// ajuste global de ritmo (o jogador ainda escolhe 1x, 2x ou 4x nas configurações)
const F_ITEM = 0.65, F_OBRA = 0.7, F_MODULO = 0.8;
const hashS = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

export function novoEstado(agora = Date.now()) {
  const S = {
    v: VERSAO_SAVE, criado: agora, t: agora, creditos: 2500, xp: 0, nivel: 1, mutirao: 2, cap: 1, capEscolhas: {},
    bonus: { usina: 0, oficina: 0, almox: 0, repasse: 0, bem: 0, xp: 0 }, ritmo: 1,
    itens: {}, almoxNivel: 1,
    predios: {}, etapas: {}, modulos: {}, pedidos: [], repasse: { acum: 0, t: agora }, dicas: {}, desbloq: {},
    stats: { coletas: 0, obras: 0, jogadoMs: 0 }, seq: 1,
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

export class Jogo {
  constructor(S) { this.S = S; this.ouvintes = []; this.agora = S.t; this._derivar(); }
  on(fn) { this.ouvintes.push(fn); }
  emit(tipo, dados = {}) { for (const f of this.ouvintes) f(tipo, dados); }
  // ---------------- consultas ----------------
  get capacidade() { return 60 + 20 * (this.S.almoxNivel - 1) + this.S.bonus.almox; }
  get ocupado() { let n = 0; for (const [k, v] of Object.entries(this.S.itens)) if (ITENS[k].tipo !== 'especial') n += v; return n; }
  get livre() { return this.capacidade - this.ocupado; }
  temItem(k, n = 1) { return (this.S.itens[k] || 0) >= n; }
  liberado(item) { return ITENS[item].nivel <= this.S.nivel && (!ITENS[item].oficina || this.S.predios[ITENS[item].oficina]?.ok); }
  etapa(key) { return this.S.etapas[key] || { estado: 'nada', entregue: {} }; }
  feita(key) {
    if (!key) return true;
    const [a, b] = key.split('.');
    if (MODULOS[a] || N_MODULOS[a]) { const n = +b; return this.S.modulos[a].some((m) => m.nivel >= n); }
    return this.etapa(key).estado === 'feita';
  }
  capEtapa(p, e) { return e.cap || p.cap; }
  projAberto(p) { return (p.cap <= this.S.cap) && (p.requer || []).every((r) => this.feita(r)); }
  // estado de disponibilidade de uma etapa: 'feita' | 'obra' | 'pronta' | 'prancha' | 'disponivel' | 'bloqueada' | 'futura'
  situacao(p, e) {
    const key = p.id + '.' + e.id; const st = this.etapa(key);
    if (st.estado === 'feita' || st.estado === 'obra' || st.estado === 'pronta') return st.estado;
    if (this.capEtapa(p, e) > this.S.cap) return 'futura';
    const i = p.etapas.indexOf(e); if (i > 0 && !this.feita(p.id + '.' + p.etapas[i - 1].id)) return 'bloqueada';
    if (!(p.requer || []).every((r) => this.feita(r)) || !(e.requer || []).every((r) => this.feita(r))) return 'bloqueada';
    return st.estado === 'prancha' ? 'prancha' : 'disponivel';
  }
  proximaEtapa(p) { for (const e of p.etapas) { const s = this.situacao(p, e); if (s !== 'feita') return { e, s }; } return null; }
  // módulos
  limiteModulo(f) { const L = LIMITE_CAP[f]; if (!L) return MODULOS[f].max; let v = 0; for (const [c, n] of Object.entries(L)) if (this.S.cap >= +c) v = n; return v; }
  moduloAberto(f, i) {
    const M = MODULOS[f]; if (M.cap > this.S.cap) return false; if (!(M.requer || []).every((r) => this.feita(r))) return false;
    if (f === 'anel' && this.S.cap === 1 && i >= M.inicio) return false; return true;
  }
  pedidoModulo(f, i, nivel) { // itens pedidos para subir ao "nivel" (sorteio fixo por módulo e nível)
    const pool = POOL_NIVEL[nivel].filter((k) => ITENS[k].nivel <= Math.max(this.S.nivel, 1) && (!ITENS[k].oficina || this.S.predios[ITENS[k].oficina]?.ok || ITENS[k].tipo === 'bruto'));
    const base = pool.length ? pool : ['viga'];
    const n = Math.min(nivel === 1 ? 2 : 3, base.length); const out = {}; let s = 0;
    const ord = base.slice().sort((a, b) => hashS(f + i + nivel + a) - hashS(f + i + nivel + b));
    for (const k of ord.slice(0, n)) { out[k] = 1 + ((hashS(f + i + nivel + k + 'q') * (nivel >= 4 ? 3 : 2)) | 0); s++; }
    return out;
  }
  populacao() { let p = 0; for (const [f, arr] of Object.entries(this.S.modulos)) for (const m of arr) p += Math.round(MODULOS[f].pop * POP_NIVEL[m.nivel]); return p; }
  servicos() {
    const s = { agua: 0, energia: 0, saneamento: 0 };
    for (const p of PROJETOS) for (const e of p.etapas) if (e.servico && this.feita(p.id + '.' + e.id)) for (const [k, v] of Object.entries(e.servico)) s[k] += v;
    return s;
  }
  bemEstar() { let b = 35 + this.S.bonus.bem; for (const p of PROJETOS) for (const e of p.etapas) if (e.bem && this.feita(p.id + '.' + e.id)) b += e.bem; return Math.min(100, b); }
  taxaRepasse() { // créditos por minuto
    const pop = this.populacao(); return (4 + pop * 0.025) * (0.5 + this.bemEstar() / 100) * (1 + this.S.bonus.repasse);
  }
  vida() { // porcentagem da composição concluída
    let tot = 0, ok = 0;
    for (const p of PROJETOS) for (const e of p.etapas) { tot += 1; if (this.feita(p.id + '.' + e.id)) ok += 1; }
    for (const [f, arr] of Object.entries(this.S.modulos)) for (const m of arr) { tot += MODULOS[f].max * 0.5; ok += m.nivel * 0.5; }
    return (ok / tot) * 100;
  }
  _derivar() { this.pop = this.populacao(); this.serv = this.servicos(); this.bem = this.bemEstar(); }
  // ---------------- relógio ----------------
  dur(seg, tipo) { const b = tipo === 'usina' ? this.S.bonus.usina : tipo === 'oficina' ? this.S.bonus.oficina : 0; const f = tipo === 'obra' ? F_OBRA : tipo === 'modulo' ? F_MODULO : F_ITEM; return (seg * 1000 * f) / (this.S.ritmo * (1 + b)); }
  tick(agora = Date.now()) {
    const S = this.S; const dt = Math.max(0, agora - S.t); S.t = agora; this.agora = agora; S.stats.jogadoMs += Math.min(dt, 5000);
    // oficinas: processa a fila em cadeia (também o tempo em que o jogo ficou fechado)
    for (const id of OFICINAS) {
      const o = S.predios[id]; if (!o.ok) continue;
      while (o.fila.length && o.fila[0].fim && o.fila[0].fim <= agora && o.prontos.length < 6) {
        const f = o.fila.shift(); o.prontos.push(f.item); this.emit('produto', { predio: id, item: f.item });
        if (o.fila.length) { o.fila[0].ini = f.fim; o.fila[0].fim = f.fim + this.dur(ITENS[o.fila[0].item].t, 'oficina'); }
      }
      if (o.fila.length && !o.fila[0].fim && o.prontos.length < 6) { o.fila[0].ini = agora; o.fila[0].fim = agora + this.dur(ITENS[o.fila[0].item].t, 'oficina'); }
    }
    // obras e módulos
    for (const [key, st] of Object.entries(S.etapas)) if (st.estado === 'obra' && st.fim <= agora) { st.estado = 'pronta'; this.emit('etapaPronta', { key }); }
    for (const [f, arr] of Object.entries(S.modulos)) arr.forEach((m, i) => { if (m.obra && m.obra.estado === 'obra' && m.obra.fim <= agora) { m.obra.estado = 'pronta'; this.emit('moduloPronto', { faixa: f, i }); } });
    // repasses (acumulam até 8 horas)
    if (this.repassesAtivos()) { const r = S.repasse; const max = this.taxaRepasse() * 60 * 8; r.acum = Math.min(max, r.acum + (this.taxaRepasse() * dt) / 60000); }
    // pedidos
    if (S.nivel >= 4) this._pedidos(agora);
  }
  repassesAtivos() { return true; }
  // ---------------- ações ----------------
  _xp(n, motivo) {
    const S = this.S; S.xp += Math.round(n * (1 + S.bonus.xp)); this.emit('xp', { n, motivo });
    while (S.nivel < XP_NIVEL.length - 1 && S.xp >= XP_NIVEL[S.nivel + 1]) {
      S.nivel++; const cr = 150 * S.nivel; S.creditos += cr; S.mutirao = Math.min(5, S.mutirao + 1);
      const esp = this._sorteiaEspecial(true); S.itens[esp] = Math.min(MAX_ESPECIAL, S.itens[esp] + 1);
      this.emit('nivel', { nivel: S.nivel, creditos: cr, especial: esp, novos: Object.keys(ITENS).filter((k) => ITENS[k].nivel === S.nivel), predios: Object.keys(PREDIOS).filter((k) => PREDIOS[k].nivel === S.nivel) });
    }
  }
  _sorteiaEspecial(licencaMais) { const r = Math.random(); const g = r < (licencaMais ? 0.5 : 0.62) ? ['estrado', 'etiqueta', 'cadeado'] : ['estaca', 'baliza', 'trena']; return g[(Math.random() * g.length) | 0]; }
  _receber(item, n = 1, origem = '') { // entra no almoxarifado (com chance de item especial)
    this.S.itens[item] += n; this.S.stats.coletas += n;
    let esp = null; if (Math.random() < 0.07) { esp = this._sorteiaEspecial(); this.S.itens[esp]++; }
    this._xp((ITENS[item].tipo === 'bruto' ? 1 : 2 + Math.floor(ITENS[item].nivel / 4)) * n, 'coleta');
    this.emit('coleta', { item, n, especial: esp, origem });
    if (this.livre <= 0) this.emit('dica', { id: 'almoxCheio' });
    return true;
  }
  produzir(uid, item) {
    const u = this.S.predios[uid]; if (!u?.ok) return 'fechado'; if (ITENS[item].tipo !== 'bruto' || !this.liberado(item)) return 'bloqueado';
    const i = u.slots.findIndex((s, k) => k < u.nSlots && !s); if (i < 0) return 'cheio';
    u.slots[i] = { item, ini: this.agora, fim: this.agora + this.dur(ITENS[item].t, 'usina') }; this.emit('produzir', { predio: uid, item, slot: i }); return 'ok';
  }
  coletarUsina(uid, i) {
    const u = this.S.predios[uid]; const s = u.slots[i]; if (!s || s.fim > this.agora) return 'nada'; if (this.livre < 1) { this.emit('dica', { id: 'almoxCheio' }); return 'almox'; }
    u.slots[i] = null; this._receber(s.item, 1, uid); return 'ok';
  }
  prontosUsina(uid) { const u = this.S.predios[uid]; return u.slots.map((s, i) => (s && s.fim <= this.agora ? i : -1)).filter((i) => i >= 0); }
  enfileirar(oid, item) {
    const o = this.S.predios[oid]; if (!o?.ok) return 'fechado'; if (ITENS[item].oficina !== oid || !this.liberado(item)) return 'bloqueado';
    if (o.fila.length >= o.nFila) return 'cheio';
    const req = ITENS[item].req; for (const [k, n] of Object.entries(req)) if (!this.temItem(k, n)) return 'falta';
    for (const [k, n] of Object.entries(req)) this.S.itens[k] -= n;
    const f = { item, ini: 0, fim: 0 }; o.fila.push(f); if (o.fila.length === 1 && o.prontos.length < 6) { f.ini = this.agora; f.fim = this.agora + this.dur(ITENS[item].t, 'oficina'); }
    this.emit('enfileirar', { predio: oid, item }); return 'ok';
  }
  coletarOficina(oid) {
    const o = this.S.predios[oid]; if (!o.prontos.length) return 'nada';
    let n = 0; while (o.prontos.length && this.livre >= 1) { this._receber(o.prontos.shift(), 1, oid); n++; }
    if (!n) { this.emit('dica', { id: 'almoxCheio' }); return 'almox'; }
    // a fila volta a andar se estava parada por falta de espaço
    if (o.fila.length && !o.fila[0].fim) { o.fila[0].ini = this.agora; o.fila[0].fim = this.agora + this.dur(ITENS[o.fila[0].item].t, 'oficina'); }
    return 'ok';
  }
  construirPredio(id) {
    const p = PREDIOS[id], st = this.S.predios[id]; if (st.ok) return 'ja'; if (p.nivel > this.S.nivel) return 'nivel'; if (p.requer && !this.feita(p.requer)) return 'requer';
    if (this.S.creditos < (p.custo || 0)) return 'creditos'; this.S.creditos -= p.custo || 0; st.ok = true; this._xp(20 + (p.custo || 0) / 50, 'predio'); this.emit('predio', { id }); return 'ok';
  }
  custoEspaco(id) { const st = this.S.predios[id]; const usina = PREDIOS[id].tipo === 'usina'; const n = usina ? st.nSlots - 1 : st.nFila - 1; return Math.round(300 * Math.pow(2.2, n - 2)); }
  ampliar(id) {
    const st = this.S.predios[id]; const usina = PREDIOS[id].tipo === 'usina'; const n = usina ? st.nSlots : st.nFila; if (n >= 6) return 'max';
    const c = this.custoEspaco(id); if (this.S.creditos < c) return 'creditos'; this.S.creditos -= c;
    if (usina) { st.nSlots++; st.slots.push(null); } else st.nFila++; this.emit('ampliar', { id }); return 'ok';
  }
  pedidoAlmox() { const k = 1 + Math.floor((this.S.almoxNivel - 1) / 2); return { estrado: k, etiqueta: k, cadeado: k }; }
  ampliarAlmox() { const req = this.pedidoAlmox(); for (const [k, n] of Object.entries(req)) if (!this.temItem(k, n)) return 'falta'; for (const [k, n] of Object.entries(req)) this.S.itens[k] -= n; this.S.almoxNivel++; this._xp(40, 'almox'); this.emit('almox', {}); return 'ok'; }
  // prancha: entrega parcial de itens de uma etapa
  entregar(key, item, n = 99) {
    const [pid, eid] = key.split('.'); const p = PROJ[pid]; const e = p.etapas.find((x) => x.id === eid); const s = this.situacao(p, e);
    if (s !== 'disponivel' && s !== 'prancha') return 'bloqueada';
    const st = this.S.etapas[key] || (this.S.etapas[key] = { estado: 'prancha', entregue: {} }); st.estado = 'prancha';
    const req = { ...e.itens, ...(e.licencas || {}) }; const falta = (req[item] || 0) - (st.entregue[item] || 0); const q = Math.min(falta, n, this.S.itens[item]);
    if (q <= 0) return 'nada'; this.S.itens[item] -= q; st.entregue[item] = (st.entregue[item] || 0) + q; this.emit('entregar', { key, item, n: q }); return 'ok';
  }
  entregarTudo(key) { const [pid, eid] = key.split('.'); const e = PROJ[pid].etapas.find((x) => x.id === eid); let ok = false; for (const k of Object.keys({ ...e.itens, ...(e.licencas || {}) })) if (this.entregar(key, k) === 'ok') ok = true; return ok ? 'ok' : 'nada'; }
  faltaEtapa(key) { const [pid, eid] = key.split('.'); const e = PROJ[pid].etapas.find((x) => x.id === eid); const st = this.etapa(key); const out = {}; for (const [k, n] of Object.entries({ ...e.itens, ...(e.licencas || {}) })) { const f = n - (st.entregue?.[k] || 0); if (f > 0) out[k] = f; } return out; }
  iniciarEtapa(key) {
    const [pid, eid] = key.split('.'); const p = PROJ[pid]; const e = p.etapas.find((x) => x.id === eid); const s = this.situacao(p, e);
    if (s !== 'disponivel' && s !== 'prancha') return 'bloqueada'; if (Object.keys(this.faltaEtapa(key)).length) return 'falta';
    if (this.S.creditos < e.custo) return 'creditos';
    this.S.creditos -= e.custo; const st = this.S.etapas[key] || (this.S.etapas[key] = { entregue: {} });
    st.estado = 'obra'; st.ini = this.agora; st.fim = this.agora + this.dur(e.t, 'obra'); this.emit('etapaIniciada', { key }); return 'ok';
  }
  aprovarEtapa(key) {
    const st = this.S.etapas[key]; if (!st || st.estado !== 'pronta') return 'nada';
    const [pid, eid] = key.split('.'); const p = PROJ[pid]; const e = p.etapas.find((x) => x.id === eid);
    st.estado = 'feita'; st.entregue = {}; this.S.stats.obras++;
    let xp = e.xp || Math.round(e.custo / 12 + Object.values(e.itens).reduce((a, b) => a + b, 0) * 12); this._xp(xp, 'etapa');
    this._derivar(); this.emit('etapaFeita', { key, p, e }); this._verCapitulo(); return 'ok';
  }
  // módulos (zonas residenciais)
  situacaoModulo(f, i) {
    const m = this.S.modulos[f][i]; if (m.obra) return m.obra.estado; if (!this.moduloAberto(f, i)) return 'bloqueado';
    if (m.nivel >= MODULOS[f].max) return 'max'; if (m.nivel >= this.limiteModulo(f)) return 'limite';
    return 'disponivel';
  }
  requisitosModulo(f, i) {
    const m = this.S.modulos[f][i]; const n = m.nivel + 1; if (!m.pedido || m.pedido.nivel !== n) m.pedido = { nivel: n, itens: this.pedidoModulo(f, i, n) }; const itens = m.pedido.itens; const custo = CUSTO_NIVEL[n];
    const serv = SERVICO_NIVEL[n]; let servOk = true; const popDepois = this.pop + Math.round(MODULOS[f].pop * (POP_NIVEL[n] - POP_NIVEL[m.nivel]));
    if (serv) for (const [lv, k] of Object.entries(SERVICO_NIVEL)) if (+lv <= n && this.serv[k] < popDepois) servOk = false;
    const bemOk = n < 5 || this.bem >= 60;
    return { nivel: n, itens, custo, servico: serv, servOk, bemOk, tempo: TEMPO_NIVEL[n], popDepois };
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
    m.nivel = m.obra.para; m.obra = null; this._xp(30 * m.nivel, 'modulo'); this._derivar(); this.emit('moduloFeito', { faixa: f, i, nivel: m.nivel }); this._verCapitulo(); return 'ok';
  }
  // Mutirão: termina um cronômetro na hora
  mutirao(alvo) {
    if (this.S.mutirao < 1) return 'sem'; const S = this.S; const a = this.agora;
    if (alvo.etapa) { const st = S.etapas[alvo.etapa]; if (!st || st.estado !== 'obra') return 'nada'; st.fim = a; }
    else if (alvo.modulo) { const m = S.modulos[alvo.modulo[0]][alvo.modulo[1]]; if (!m.obra || m.obra.estado !== 'obra') return 'nada'; m.obra.fim = a; }
    else if (alvo.usina) { const u = S.predios[alvo.usina]; let ok = false; for (const s of u.slots) if (s && s.fim > a) { s.fim = a; ok = true; } if (!ok) return 'nada'; }
    else if (alvo.oficina) { const o = S.predios[alvo.oficina]; if (!o.fila.length || !o.fila[0].fim) return 'nada'; const d = o.fila[0].fim - a; for (const f of o.fila) { if (f.fim) { f.ini -= d; f.fim -= d; } } }
    S.mutirao--; this.tick(a); this.emit('mutirao', alvo); return 'ok';
  }
  // repasses da Holding (coletados na Sede ou, antes dela, no Escritório)
  coletarRepasse() { const r = this.S.repasse; const v = Math.floor(r.acum); if (v < 1) return 'nada'; r.acum -= v; this.S.creditos += v; this.emit('repasse', { v }); return 'ok'; }
  // depósito de trocas
  precoCompra(k) { return Math.ceil(ITENS[k].valor * 3); }
  precoVenda(k) { return Math.max(1, Math.floor(ITENS[k].valor * 0.6)); }
  comprar(k) { if (ITENS[k].tipo !== 'bruto' || !this.liberado(k)) return 'bloqueado'; const c = this.precoCompra(k); if (this.S.creditos < c) return 'creditos'; if (this.livre < 1) return 'almox'; this.S.creditos -= c; this.S.itens[k]++; this.emit('troca', { k, n: 1 }); return 'ok'; }
  vender(k, n = 1) { if (ITENS[k].tipo === 'especial') return 'nao'; const q = Math.min(n, this.S.itens[k]); if (q < 1) return 'nada'; this.S.itens[k] -= q; this.S.creditos += q * this.precoVenda(k); this.emit('troca', { k, n: -q }); return 'ok'; }
  // pedidos da comunidade (6 cartões)
  _pedidos(agora) {
    const P = this.S.pedidos; while (P.length < 6) P.push({ id: this.S.seq++, espera: agora + 1000 * (P.length ? 0 : 0), itens: null });
    for (const p of P) if (!p.itens && p.espera <= agora) this._gerarPedido(p);
  }
  _gerarPedido(p) {
    const op = Object.keys(ITENS).filter((k) => ITENS[k].tipo !== 'especial' && this.liberado(k) && (ITENS[k].tipo === 'bruto' || this.S.predios[ITENS[k].oficina]?.ok));
    const n = 1 + ((Math.random() * Math.min(3, 1 + this.S.nivel / 6)) | 0); const itens = {}; let valor = 0;
    for (let i = 0; i < n; i++) { const k = op[(Math.random() * op.length) | 0]; const q = 1 + ((Math.random() * (ITENS[k].tipo === 'bruto' ? 4 : 2)) | 0); itens[k] = (itens[k] || 0) + q; valor += ITENS[k].valor * q; }
    p.itens = itens; p.creditos = Math.round(valor * 1.35); p.xp = Math.round(valor / 9); p.especial = Math.random() < 0.22 ? this._sorteiaEspecial(true) : null; p.mutirao = Math.random() < 0.05;
  }
  entregarPedido(i) {
    const p = this.S.pedidos[i]; if (!p?.itens) return 'nada'; for (const [k, n] of Object.entries(p.itens)) if (!this.temItem(k, n)) return 'falta';
    for (const [k, n] of Object.entries(p.itens)) this.S.itens[k] -= n; this.S.creditos += p.creditos; if (p.especial) this.S.itens[p.especial]++; if (p.mutirao) this.S.mutirao = Math.min(5, this.S.mutirao + 1);
    this._xp(p.xp, 'pedido'); this.emit('pedido', { ...p }); this.S.pedidos[i] = { id: this.S.seq++, espera: this.agora + 20000, itens: null }; return 'ok';
  }
  descartarPedido(i) { this.S.pedidos[i] = { id: this.S.seq++, espera: this.agora + 180000, itens: null }; return 'ok'; }
  // capítulos
  metaFeita(m) {
    if (m.tipo === 'etapa') return this.feita(m.id);
    if (m.tipo === 'predio') return this.S.predios[m.id]?.ok;
    if (m.tipo === 'modulos') return this.S.modulos[m.faixa].filter((x) => x.nivel >= m.nivel).length >= m.qtd;
    if (m.tipo === 'nivel') return this.S.nivel >= m.n;
    return false;
  }
  capitulo() { return CAPITULOS[this.S.cap - 1]; }
  _verCapitulo() { const c = this.capitulo(); if (!c || this.S.capEscolhas[c.n] !== undefined) return; if (c.metas.every((m) => this.metaFeita(m))) this.emit('capituloCompleto', { cap: c }); }
  concluirCapitulo(escolha) {
    const c = this.capitulo(); if (!c || !c.metas.every((m) => this.metaFeita(m))) return 'nada';
    this.S.capEscolhas[c.n] = escolha || null;
    const B = this.S.bonus; if (escolha === 'usina+') B.usina += 0.15; else if (escolha === 'almox+') B.almox += 25; else if (escolha === 'repasse+') B.repasse += 0.15; else if (escolha === 'mutirao2') this.S.mutirao = Math.min(5, this.S.mutirao + 2); else if (escolha === 'oficina+') B.oficina += 0.15; else if (escolha === 'bem+') B.bem += 5; else if (escolha === 'xp+') B.xp += 0.2;
    this.S.creditos += 2000 * c.n; this.S.mutirao = Math.min(5, this.S.mutirao + 1);
    if (this.S.cap < CAPITULOS.length) this.S.cap++;
    this._derivar(); this.emit('novoCapitulo', { cap: this.capitulo(), anterior: c }); this._verCapitulo(); return 'ok';
  }
}
export { N_MODULOS };
