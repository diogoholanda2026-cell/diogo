// Painéis da folha inferior: usinas, oficinas, almoxarifado, prancha da obra, módulos,
// lista de obras, produção, pedidos, depósito de trocas, escritório/sede e prédios novos.
import { el, fmt, dur } from '../core/util.js';
import { img } from './icones.js';
import { ITENS, PREDIOS, USINAS, OFICINAS, BRUTOS, receitas } from '../data/itens.js';
import { PROJETOS, PROJ, MODULOS, POP_NIVEL, LIMITE_CAP } from '../data/obras.js';

const nomeIt = (k) => ITENS[k]?.nome || k;
const nomeProj = (id) => PROJ[id]?.nome || MODULOS[id]?.nome || id;
function reqTxt(r) { const [a, b] = r.split('.'); if (MODULOS[a]) return `${MODULOS[a].nome} com um módulo no nível ${b}`; const p = PROJ[a]; const e = p?.etapas.find((x) => x.id === b); return `${p?.nome}: ${e?.nome}`; }

export class Paineis {
  constructor(raiz, C) { this.raiz = raiz; this.C = C; this.atual = null; this.el = null; this.aba = {}; }
  get J() { return this.C.J; }
  abrir(tipo, arg) {
    const mesmo = this.atual && this.atual.tipo === tipo && JSON.stringify(this.atual.arg) === JSON.stringify(arg);
    this.fechar(true); if (mesmo && !this._reabrir) return; this._reabrir = false;
    this.atual = { tipo, arg }; this.el = el('div', 'folha'); this.raiz.appendChild(this.el); this.raiz.classList.add('painel-aberto');
    this.el.addEventListener('click', (e) => this._clique(e)); this.render(); this.C.som.abrir(); this.C.aoAbrir?.(tipo, arg);
  }
  fechar(silencio) { if (!this.el) return; this.el.remove(); this.el = null; this.raiz.classList.remove('painel-aberto'); const a = this.atual; this.atual = null; if (!silencio) this.C.som.fechar(); this.C.aoFechar?.(a); }
  render() {
    if (!this.el) return; const { tipo, arg } = this.atual; const r = this['r_' + tipo](arg); if (!r) { this.fechar(true); return; }
    const sc = this.el.querySelector('.corpo')?.scrollTop || 0;
    this.el.innerHTML = `<header><div class="ic">${img(r.icone)}</div><div><h2>${r.titulo}</h2><small>${r.sub || ''}</small></div><button class="x" data-a="fechar" aria-label="Fechar">×</button></header><div class="corpo">${r.corpo}</div>`;
    const c = this.el.querySelector('.corpo'); if (c) c.scrollTop = sc;
    this.tick();
  }
  tick() { // atualiza cronômetros e barras sem redesenhar
    if (!this.el) return; const agora = this.J.agora;
    for (const n of this.el.querySelectorAll('[data-fim]')) { const ini = +n.dataset.ini, fim = +n.dataset.fim; const p = Math.max(0, Math.min(1, (agora - ini) / (fim - ini || 1))); const b = n.querySelector('.pb, .barra i'); if (b) b.style.width = (p * 100).toFixed(1) + '%'; const t = n.querySelector('.tt'); if (t) t.textContent = fim > agora ? dur((fim - agora) / 1000) : 'pronto'; if (fim <= agora && !n.dataset.feito) { n.dataset.feito = 1; this._precisa = true; } }
    if (this._precisa) { this._precisa = false; setTimeout(() => this.render(), 50); }
  }
  _clique(e) {
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a; const d = b.dataset; const C = this.C; const J = this.J;
    if (a === 'fechar') return this.fechar();
    C.som.toque(); C.vibra.tique();
    const res = (r, ok, fx) => { if (r === 'ok') { ok && ok(); } else C.falha(r, fx); this.render(); C.hud.atualizar(); };
    switch (a) {
      case 'produzir': res(J.produzir(d.p, d.k)); C.agendar(); break;
      case 'coletarU': C.coletarUsina(d.p, +d.i, b); this.render(); break;
      case 'coletarO': C.coletarOficina(d.p, b); this.render(); break;
      case 'enfileirar': { const r = J.enfileirar(d.p, d.k); if (r === 'falta') { this._falta = d.k; this.render(); C.falha('falta'); } else res(r); C.agendar(); break; }
      case 'cadeia': C.produzirCadeia(d.k); this._falta = null; this.render(); break;
      case 'ampliar': res(J.ampliar(d.p), () => C.hud.brinde('Novo espaço de produção!', 'subir')); break;
      case 'mutirao': res(J.mutirao(JSON.parse(d.alvo)), () => { C.hud.brinde('Mutirão! Pronto na hora.', 'mutirao'); C.sincronizar(); }); break;
      case 'entregar': if (!(J.S.itens[d.k] > 0)) { C.irProdutor(d.k); break; } res(J.entregar(d.key, d.k), () => C.som.coleta()); C.sincronizar(); break;
      case 'produtor': C.irProdutor(d.k); break;
      case 'entregarTudo': res(J.entregarTudo(d.key), () => C.som.coleta()); C.sincronizar(); break;
      case 'iniciar': res(J.iniciarEtapa(d.key), () => { C.som.obra(); C.vibra.sucesso(); }); C.sincronizar(); break;
      case 'aprovar': C.aprovarEtapa(d.key); break;
      case 'melhorar': { const r = J.melhorarModulo(d.f, +d.i); if (r === 'servico') { const q = J.requisitosModulo(d.f, +d.i); C._dica(q.nivel >= 5 ? 'servicoSaneamento' : q.nivel >= 4 ? 'servicoEnergia' : 'servicoAgua'); } res(r, () => { C.som.obra(); C.vibra.sucesso(); }); C.sincronizar(); break; }
      case 'aprovarMod': C.aprovarModulo(d.f, +d.i); break;
      case 'ir': C.irPara(JSON.parse(d.alvo)); break;
      case 'aba': this.aba[this.atual.tipo] = d.v; this.render(); break;
      case 'ampliarAlmox': res(J.ampliarAlmox(), () => C.hud.brinde('Almoxarifado ampliado: +20 vagas', 'almox')); break;
      case 'deposito': this.abrir('deposito'); break;
      case 'comprar': res(J.comprar(d.k), () => C.som.moedas()); break;
      case 'vender': res(J.vender(d.k, 1), () => C.som.moedas()); break;
      case 'pedido': res(J.entregarPedido(+d.i), () => { C.som.moedas(); C.vibra.sucesso(); }); break;
      case 'descartar': res(J.descartarPedido(+d.i)); break;
      case 'construir': res(J.construirPredio(d.p), () => { C.som.obra(); C.predioConstruido(d.p); }); break;
      case 'repasse': C.coletarRepasse(b); this.render(); break;
      case 'abrir': this.abrir(d.t, d.arg ? JSON.parse(d.arg) : undefined); break;
    }
  }
  // ---------- componentes ----------
  ficha(k, o = {}) {
    const it = ITENS[k]; return `<button class="ficha ${o.cls || ''}" ${o.data || ''}>${o.cad ? `<span class="cad">${o.cad}</span>` : ''}${img(k)}<b>${o.nome ?? nomeIt(k)}</b>${o.sub ? `<small class="qtd">${o.sub}</small>` : ''}${o.extra || ''}</button>`;
  }
  chips(req) { return `<div class="req">${Object.entries(req).map(([k, n]) => `<span class="${this.J.temItem(k, n) ? '' : 'f'}">${img(k)}${this.J.S.itens[k] || 0}/${n}</span>`).join('')}</div>`; }
  vaga(o) { return `<div class="vaga ${o.cls || ''}" ${o.fim ? `data-ini="${o.ini}" data-fim="${o.fim}"` : ''} ${o.data || ''}>${o.icone ? img(o.icone) : ''}${o.txt ? `<small>${o.txt}</small>` : ''}${o.fim ? '<i class="pb" style="width:0"></i><small class="tt"></small>' : ''}</div>`; }
  // ---------- usina ----------
  r_usina(id) {
    const J = this.J, st = J.S.predios[id], P = PREDIOS[id]; if (!st.ok) return this.r_predio(id);
    let v = ''; for (let i = 0; i < st.nSlots; i++) { const s = st.slots[i]; if (!s) v += this.vaga({ txt: 'livre' }); else if (s.fim <= J.agora) v += `<button class="vaga pronto" data-a="coletarU" data-p="${id}" data-i="${i}">${img(s.item)}<small>coletar</small></button>`; else v += this.vaga({ icone: s.item, ini: s.ini, fim: s.fim }); }
    if (st.nSlots < 6) v += `<button class="vaga mais" data-a="ampliar" data-p="${id}">+ espaço<br>${fmt(J.custoEspaco(id))}</button>`;
    const produzindo = st.slots.some((s) => s && s.fim > J.agora);
    const g = BRUTOS.map((k) => { const it = ITENS[k]; const lib = J.liberado(k); return this.ficha(k, { cls: lib ? '' : 'bloq', sub: lib ? dur(J.dur(it.t, 'usina') / 1000) : '', cad: lib ? '' : 'Nível ' + it.nivel, data: lib ? `data-a="produzir" data-p="${id}" data-k="${k}"` : '' }); }).join('');
    return { icone: 'producao', titulo: P.nome, sub: `${st.slots.filter(Boolean).length}/${st.nSlots} espaços em uso · toque num material para produzir`, corpo: `<div class="vagas">${v}</div>${produzindo ? `<div class="linha" style="margin:-4px 0 10px"><button class="botao sec" data-a="mutirao" data-alvo='{"usina":"${id}"}'>${img('mutirao')} Terminar tudo agora (1 Mutirão)</button></div>` : ''}<div class="grade">${g}</div>` };
  }
  // ---------- oficina ----------
  r_oficina(id) {
    const J = this.J, st = J.S.predios[id], P = PREDIOS[id]; if (!st.ok) return this.r_predio(id);
    let v = ''; for (let i = 0; i < st.nFila; i++) { const f = st.fila[i]; if (!f) v += this.vaga({ txt: 'livre' }); else if (i === 0 && f.fim) v += this.vaga({ icone: f.item, ini: f.ini, fim: f.fim }); else v += this.vaga({ icone: f.item, txt: 'na fila' }); }
    if (st.nFila < 6) v += `<button class="vaga mais" data-a="ampliar" data-p="${id}">+ fila<br>${fmt(J.custoEspaco(id))}</button>`;
    const prontos = st.prontos.length ? `<div class="linha" style="margin:-2px 0 10px"><button class="botao" data-a="coletarO" data-p="${id}">${img(st.prontos[0])} Coletar ${st.prontos.length} pronto${st.prontos.length > 1 ? 's' : ''}</button>${st.prontos.length >= 6 ? '<span class="etiq nao">Bandeja cheia: a fila parou</span>' : ''}</div>` : '';
    const falta = this._falta && ITENS[this._falta]?.oficina === id ? `<div class="cartao" style="margin:0 0 10px;display:flex;gap:10px;align-items:center">${img(this._falta)}<div style="flex:1;font-size:13px">Faltam materiais para <b>${nomeIt(this._falta)}</b>.</div><button class="botao ouro" data-a="cadeia" data-k="${this._falta}">Produzir o que falta</button></div>` : '';
    const g = receitas(id).map((k) => { const it = ITENS[k]; const lib = it.nivel <= J.S.nivel; return this.ficha(k, { cls: lib ? '' : 'bloq', sub: lib ? dur(J.dur(it.t, 'oficina') / 1000) : '', cad: lib ? '' : 'Nível ' + it.nivel, extra: lib ? this.chips(it.req) : '', data: lib ? `data-a="enfileirar" data-p="${id}" data-k="${k}"` : '' }); }).join('');
    const rodando = st.fila.length && st.fila[0].fim;
    return { icone: 'producao', titulo: P.nome, sub: `Fila ${st.fila.length}/${st.nFila} · um de cada vez`, corpo: `<div class="vagas">${v}</div>${prontos}${falta}${rodando ? `<div class="linha" style="margin:-4px 0 10px"><button class="botao sec" data-a="mutirao" data-alvo='{"oficina":"${id}"}'>${img('mutirao')} Adiantar o item atual (1 Mutirão)</button></div>` : ''}<div class="grade">${g}</div>` };
  }
  // ---------- prédio ainda não construído ----------
  r_predio(id) {
    const J = this.J, P = PREDIOS[id]; const lib = P.nivel <= J.S.nivel && (!P.requer || J.feita(P.requer));
    return { icone: 'grua', titulo: P.nome, sub: lib ? 'Pronto para construir' : P.requer && !J.feita(P.requer) ? 'Requer: ' + reqTxt(P.requer) : 'Libera no nível ' + P.nivel,
      corpo: `<p class="desc">${P.desc}</p><div class="linha"><button class="botao ouro" data-a="construir" data-p="${id}" ${lib ? '' : 'disabled'}>${img('creditos')} Construir · ${fmt(P.custo || 0)}</button></div>` };
  }
  // ---------- almoxarifado ----------
  r_almox() {
    const J = this.J; const cap = J.capacidade, oc = J.ocupado; const p = oc / cap; const aba = this.aba.almox || 'bruto';
    const lista = Object.keys(ITENS).filter((k) => ITENS[k].tipo === aba && (J.S.itens[k] > 0 || aba === 'especial'));
    const g = lista.length ? lista.map((k) => this.ficha(k, { sub: '×' + (J.S.itens[k] || 0) })).join('') : '<p class="desc">Nada guardado aqui ainda.</p>';
    const req = J.pedidoAlmox(); const pode = Object.entries(req).every(([k, n]) => J.temItem(k, n));
    return { icone: 'almox', titulo: 'Almoxarifado', sub: `${oc}/${cap} vagas ocupadas`,
      corpo: `<div class="linha" style="margin-bottom:10px"><div class="barra ${p >= 0.95 ? 'cheia' : p >= 0.8 ? 'alerta' : ''}"><i style="width:${Math.min(100, p * 100)}%"></i></div><b>${Math.round(p * 100)}%</b></div>
      <div class="abas">${[['bruto', 'Matérias-primas'], ['produto', 'Produtos'], ['especial', 'Especiais']].map(([v, t]) => `<button class="${aba === v ? 'on' : ''}" data-a="aba" data-v="${v}">${t}</button>`).join('')}</div>
      <div class="grade">${g}</div>
      <div class="cartao" style="margin-top:12px"><b>Ampliar (+20 vagas)</b>${this.chips(req)}<div class="linha" style="margin-top:8px"><button class="botao" data-a="ampliarAlmox" ${pode ? '' : 'disabled'}>${img('subir')} Ampliar</button>${J.S.nivel >= 3 ? `<button class="botao sec" data-a="deposito">${img('troca')} Depósito de Trocas</button>` : ''}</div><p class="desc" style="margin-top:6px">Estrados, etiquetas e cadeados caem ao coletar produção e ao subir de nível.</p></div>` };
  }
  // ---------- prancha da etapa ----------
  r_etapa(key) {
    const J = this.J; const [pid, eid] = key.split('.'); const p = PROJ[pid]; const e = p.etapas.find((x) => x.id === eid); const i = p.etapas.indexOf(e); const s = J.situacao(p, e); const st = J.etapa(key);
    const passos = `<div class="passos">${p.etapas.map((x, k) => `<i class="${J.feita(pid + '.' + x.id) ? 'f' : k === i ? 'a' : ''}"></i>`).join('')}</div>`;
    let corpo = passos + `<p class="desc"><b>${e.nome}.</b> ${e.desc}</p>`;
    const extras = []; if (e.servico) for (const [k, v] of Object.entries(e.servico)) extras.push(`<span class="etiq ok">${img(k)}+${fmt(v)} ${k === 'agua' ? 'água' : k}</span>`); if (e.bem) extras.push(`<span class="etiq ok">${img('bem')}+${e.bem}% bem-estar</span>`);
    if (extras.length) corpo += `<div class="linha" style="margin:-4px 0 10px">${extras.join('')}</div>`;
    if (s === 'futura') corpo += `<p class="desc">Abre no capítulo ${J.capEtapa(p, e)}.</p>`;
    else if (s === 'bloqueada') { const req = [...(i > 0 && !J.feita(pid + '.' + p.etapas[i - 1].id) ? [pid + '.' + p.etapas[i - 1].id] : []), ...(p.requer || []), ...(e.requer || [])].filter((r) => !J.feita(r)); corpo += `<p class="desc">Antes, conclua: ${req.map(reqTxt).join(' · ')}</p>`; }
    else if (s === 'disponivel' || s === 'prancha') {
      const req = { ...e.itens, ...(e.licencas || {}) }; const falta = J.faltaEtapa(key);
      corpo += `<div class="grade">${Object.entries(req).map(([k, n]) => { const ent = st.entregue?.[k] || 0; const ok = ent >= n; const tem = J.S.itens[k] || 0; return this.ficha(k, { cls: ok ? 'ok' : tem > 0 ? '' : 'falta', sub: `${ent}/${n} entregue`, extra: ok ? '' : `<small>no almox.: ${tem}</small>`, data: ok ? '' : `data-a="entregar" data-key="${key}" data-k="${k}"` }); }).join('')}</div>`;
      const pode = Object.keys(falta).every((k) => !J.temItem(k, 1)) ? false : true; const tudo = !Object.keys(falta).length;
      corpo += `<div class="linha" style="margin-top:12px">${!tudo ? `<button class="botao azul" data-a="entregarTudo" data-key="${key}" ${pode ? '' : 'disabled'}>${img('almox')} Entregar o que tenho</button>` : ''}<button class="botao ouro ${tudo && J.S.creditos >= e.custo ? '' : 'fraco'}" data-a="iniciar" data-key="${key}">${img('grua')} Iniciar obra · ${fmt(e.custo)} · ${dur(J.dur(e.t, 'obra') / 1000)}</button></div>`;
      if (!tudo) corpo += `<p class="desc" style="margin-top:8px">A entrega pode ser feita aos poucos: a prancha guarda o que já chegou. Toque num material que falta para ir até quem o produz.</p>`;
    } else if (s === 'obra') corpo += `<div class="linha" data-ini="${st.ini}" data-fim="${st.fim}"><div class="barra"><i style="width:0"></i></div><b class="tt tempo"></b></div><div class="linha" style="margin-top:10px"><button class="botao sec" data-a="mutirao" data-alvo='{"etapa":"${key}"}'>${img('mutirao')} Mutirão: terminar agora</button></div>`;
    else if (s === 'pronta') corpo += `<div class="linha"><button class="botao" data-a="aprovar" data-key="${key}">${img('ok')} Aprovar a etapa</button></div>`;
    else if (s === 'feita') { const nx = J.proximaEtapa(p); corpo += `<p class="desc">Etapa concluída.</p>${nx ? `<button class="botao sec" data-a="abrir" data-t="etapa" data-arg='"${pid}.${nx.e.id}"'>Próxima etapa: ${nx.e.nome}</button>` : ''}`; }
    return { icone: p.icone || 'obras', titulo: p.nome, sub: `Etapa ${i + 1} de ${p.etapas.length} · ${e.nome}`, corpo };
  }
  // ---------- módulo ----------
  r_modulo([f, i]) {
    const J = this.J, M = MODULOS[f], m = J.S.modulos[f][i]; const s = J.situacaoModulo(f, i);
    const popAgora = Math.round(M.pop * POP_NIVEL[m.nivel]);
    let corpo = `<div class="passos">${Array.from({ length: M.max }, (_, k) => `<i class="${k < m.nivel ? 'f' : k === m.nivel ? 'a' : ''}"></i>`).join('')}</div><p class="desc">${M.sub}. Cada nível acrescenta um pavimento com terraço.</p>`;
    if (s === 'disponivel') {
      const r = J.requisitosModulo(f, i); const temTudo = Object.entries(r.itens).every(([k, n]) => J.temItem(k, n));
      corpo += `<div class="grade">${Object.entries(r.itens).map(([k, n]) => this.ficha(k, { cls: J.temItem(k, n) ? 'ok' : 'falta', sub: `${J.S.itens[k] || 0}/${n}`, data: J.temItem(k, n) ? '' : `data-a="produtor" data-k="${k}"` })).join('')}</div>`;
      const et = []; if (r.servico) for (const [lv, k] of Object.entries({ 3: 'agua', 4: 'energia', 5: 'saneamento' })) if (+lv <= r.nivel) { const ok = J.serv[k] >= r.popDepois; et.push(`<span class="etiq ${ok ? 'ok' : 'nao'}">${img(k)}${k === 'agua' ? 'Água' : k === 'energia' ? 'Energia' : 'Saneamento'} ${fmt(J.serv[k])}/${fmt(r.popDepois)}</span>`); }
      if (r.nivel >= 5) et.push(`<span class="etiq ${r.bemOk ? 'ok' : 'nao'}">${img('bem')}Bem-estar ${J.bem}% (mín. 60%)</span>`);
      et.push(`<span class="etiq">${img('pop')}+${fmt(Math.round(M.pop * (POP_NIVEL[r.nivel] - POP_NIVEL[m.nivel])))} moradores</span>`);
      corpo += `<div class="linha" style="margin:10px 0">${et.join('')}</div><div class="linha"><button class="botao ouro ${temTudo && r.servOk && r.bemOk && J.S.creditos >= r.custo ? '' : 'fraco'}" data-a="melhorar" data-f="${f}" data-i="${i}">${img('subir')} ${m.nivel ? 'Subir para o nível ' + r.nivel : 'Construir'} · ${fmt(r.custo)} · ${dur(J.dur(r.tempo, 'modulo') / 1000)}</button></div>`;
      if (!r.servOk) corpo += `<p class="desc" style="margin-top:8px">Faltam serviços para os novos moradores. Conclua obras que dão água, energia ou saneamento.</p>`;
    } else if (s === 'limite') { const L = LIMITE_CAP[f]; let prox = ''; for (const [c, n] of Object.entries(L || {})) if (n > m.nivel && !prox) prox = c; corpo += `<p class="desc">Nível máximo por enquanto. O próximo pavimento abre no capítulo ${prox}.</p>`; }
    else if (s === 'bloqueado') corpo += `<p class="desc">${M.cap > J.S.cap ? 'Abre no capítulo ' + M.cap + '.' : f === 'anel' && J.S.cap === 1 ? 'Este lote abre no capítulo 2.' : 'Antes, conclua: ' + (M.requer || []).map(reqTxt).join(' · ')}</p>`;
    else if (s === 'obra') corpo += `<div class="linha" data-ini="${m.obra.ini}" data-fim="${m.obra.fim}"><div class="barra"><i style="width:0"></i></div><b class="tt tempo"></b></div><div class="linha" style="margin-top:10px"><button class="botao sec" data-a="mutirao" data-alvo='{"modulo":["${f}",${i}]}'>${img('mutirao')} Mutirão: terminar agora</button></div>`;
    else if (s === 'pronta') corpo += `<button class="botao" data-a="aprovarMod" data-f="${f}" data-i="${i}">${img('ok')} Aprovar o pavimento</button>`;
    else if (s === 'max') corpo += `<p class="desc">Módulo completo, igual à maquete.</p>`;
    return { icone: 'pop', titulo: `${M.nome} · módulo ${i + 1}`, sub: `Nível ${m.nivel}/${M.max} · ${fmt(popAgora)} moradores`, corpo };
  }
  // ---------- lista de obras ----------
  r_obras() {
    const J = this.J; const itens = [];
    for (const p of PROJETOS) {
      if (p.cap > J.S.cap) continue; const nx = J.proximaEtapa(p); let st, cls = '';
      if (!nx) st = 'Concluída'; else if (nx.s === 'pronta') { st = 'Pronta para aprovar'; cls = 'ok'; } else if (nx.s === 'obra') st = 'Em obra: ' + dur((J.etapa(p.id + '.' + nx.e.id).fim - J.agora) / 1000); else if (nx.s === 'futura') st = 'Próxima etapa no capítulo ' + J.capEtapa(p, nx.e); else if (nx.s === 'bloqueada') st = 'Aguardando outra obra'; else st = `Etapa ${p.etapas.indexOf(nx.e) + 1}/${p.etapas.length}: ${nx.e.nome}`;
      const feitas = p.etapas.filter((e) => J.feita(p.id + '.' + e.id)).length;
      itens.push(`<button class="item-lista" data-a="ir" data-alvo='{"etapa":"${p.id}.${(nx ? nx.e : p.etapas[p.etapas.length - 1]).id}"}'>${img(p.icone || 'obras')}<div class="tx"><b>${p.nome}</b><small>${st}</small></div><span class="etiq ${cls || (nx ? '' : 'ok')}">${feitas}/${p.etapas.length}</span></button>`);
    }
    const mods = Object.entries(MODULOS).filter(([f, M]) => M.cap <= J.S.cap).map(([f, M]) => { const arr = J.S.modulos[f]; const i = Math.max(0, arr.findIndex((m, k) => ['disponivel', 'pronta'].includes(J.situacaoModulo(f, k)))); return `<button class="item-lista" data-a="ir" data-alvo='{"modulo":["${f}",${i}]}'>${img('pop')}<div class="tx"><b>${M.nome}</b><small>Níveis: ${arr.map((m) => m.nivel).join(' · ')}</small></div><span class="etiq">${arr.reduce((a, m) => a + m.nivel, 0)}/${arr.length * M.max}</span></button>`; });
    return { icone: 'obras', titulo: 'Obras da composição', sub: `Capítulo ${J.S.cap} · ${J.vida().toFixed(1)}% da composição total`, corpo: `<div class="lista">${itens.join('')}</div><h3 style="margin:14px 0 8px;font-size:13px;color:var(--ouro);letter-spacing:.1em;text-transform:uppercase">Módulos</h3><div class="lista">${mods.join('')}</div>` };
  }
  // ---------- produção (atalhos) ----------
  r_producao() {
    const J = this.J; const lin = [...USINAS, ...OFICINAS].map((id) => {
      const P = PREDIOS[id], st = J.S.predios[id]; let txt;
      if (!st.ok) txt = P.nivel > J.S.nivel ? 'Libera no nível ' + P.nivel : P.requer && !J.feita(P.requer) ? 'Requer: ' + reqTxt(P.requer) : 'Construir: ' + fmt(P.custo || 0) + ' créditos';
      else if (P.tipo === 'usina') { const pr = J.prontosUsina(id).length; const uso = st.slots.filter(Boolean).length; txt = pr ? pr + ' pronto(s) para coletar' : uso ? `${uso}/${st.nSlots} produzindo` : 'Parada: toque para produzir'; }
      else txt = st.prontos.length ? st.prontos.length + ' pronto(s) para coletar' : st.fila.length ? `${st.fila.length}/${st.nFila} na fila` : 'Parada: toque para produzir';
      return `<button class="item-lista" data-a="ir" data-alvo='{"predio":"${id}"}'>${img(st.ok ? 'producao' : 'grua')}<div class="tx"><b>${P.nome}</b><small>${txt}</small></div></button>`;
    });
    return { icone: 'producao', titulo: 'Produção', sub: 'Usinas e oficinas do canteiro', corpo: `<div class="lista">${lin.join('')}</div>` };
  }
  // ---------- pedidos ----------
  r_pedidos() {
    const J = this.J; if (J.S.nivel < 4) return { icone: 'pedidos', titulo: 'Pedidos da comunidade', sub: 'Libera no nível 4', corpo: '<p class="desc">Vizinhos, cooperativas e escolas vão pedir materiais em troca de créditos e itens especiais.</p>' };
    const cards = J.S.pedidos.map((p, i) => {
      if (!p.itens) return `<div class="cartao" data-ini="${p.espera - 180000}" data-fim="${p.espera}" style="opacity:.6"><b>Novo pedido chegando</b><div class="linha"><div class="barra"><i style="width:0"></i></div><small class="tt"></small></div></div>`;
      const ok = Object.entries(p.itens).every(([k, n]) => J.temItem(k, n));
      return `<div class="cartao"><div class="linha" style="justify-content:space-between"><div>${this.chips(p.itens)}</div><div class="linha"><span class="etiq">${img('creditos')}${fmt(p.creditos)}</span><span class="etiq">${img('xp')}${p.xp}</span>${p.especial ? `<span class="etiq">${img(p.especial)}</span>` : ''}${p.mutirao ? `<span class="etiq">${img('mutirao')}</span>` : ''}</div></div><div class="linha" style="margin-top:8px"><button class="botao" data-a="pedido" data-i="${i}" ${ok ? '' : 'disabled'}>Entregar</button><button class="botao sec" data-a="descartar" data-i="${i}">Descartar</button></div></div>`;
    });
    return { icone: 'pedidos', titulo: 'Pedidos da comunidade', sub: 'Troque materiais por créditos, experiência e itens especiais', corpo: `<div class="lista">${cards.join('')}</div>` };
  }
  // ---------- depósito ----------
  r_deposito() {
    const J = this.J; const aba = this.aba.deposito || 'comprar';
    const g = aba === 'comprar' ? BRUTOS.filter((k) => J.liberado(k)).map((k) => this.ficha(k, { sub: fmt(J.precoCompra(k)) + ' créditos', data: `data-a="comprar" data-k="${k}"` })).join('')
      : Object.keys(ITENS).filter((k) => ITENS[k].tipo !== 'especial' && J.S.itens[k] > 0).map((k) => this.ficha(k, { sub: `×${J.S.itens[k]} · ${fmt(J.precoVenda(k))} cada`, data: `data-a="vender" data-k="${k}"` })).join('') || '<p class="desc">Nada para vender.</p>';
    return { icone: 'troca', titulo: 'Depósito de Trocas', sub: 'Compre matéria-prima ou venda o que sobrou', corpo: `<div class="abas">${[['comprar', 'Comprar'], ['vender', 'Vender']].map(([v, t]) => `<button class="${aba === v ? 'on' : ''}" data-a="aba" data-v="${v}">${t}</button>`).join('')}</div><div class="grade">${g}</div>` };
  }
  // ---------- escritório / sede: repasses e serviços ----------
  r_escritorio() {
    const J = this.J; const r = J.S.repasse; const sede = J.feita('sede.e2'); const t = J.taxaRepasse();
    const serv = [['agua', 'Água'], ['energia', 'Energia'], ['saneamento', 'Saneamento']].map(([k, n]) => { const c = J.serv[k], d = J.pop; const p = c ? Math.min(1, d / c) : d ? 1 : 0; return `<div class="linha" style="margin:6px 0">${img(k)}<b style="width:96px">${n}</b><div class="barra ${d > c ? 'cheia' : p > 0.85 ? 'alerta' : ''}"><i style="width:${(p * 100).toFixed(0)}%"></i></div><small>${fmt(d)}/${fmt(c)}</small></div>`; }).join('');
    return { icone: sede ? 'sede' : 'repasse', titulo: sede ? 'Sede da Holding Guarda-Chuva' : 'Escritório de Obra', sub: `Repasses: ${fmt(t * 60)} créditos por hora · bem-estar ${J.bem}%`,
      corpo: `<div class="linha"><span class="etiq">${img('repasse')}Acumulado: <b class="cred">${fmt(r.acum)}</b></span><button class="botao ouro" data-a="repasse" ${r.acum >= 1 ? '' : 'disabled'}>${img('creditos')} Coletar</button></div><p class="desc" style="margin-top:8px">A Holding repassa créditos conforme os moradores e o bem-estar. O cofre guarda até 8 horas.</p><h3 style="margin:12px 0 4px;font-size:13px;color:var(--ouro);letter-spacing:.1em;text-transform:uppercase">Serviços</h3>${serv}` };
  }
}
