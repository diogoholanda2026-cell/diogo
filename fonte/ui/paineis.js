// Painéis da folha lateral esquerda: a "prancheta da maquete" (papel quente com cabeçalho azul-noite e fio de aurora,
// miniatura da foto de referência por obra, cartões brancos com fio fino e botões com volume: verde para a ação
// principal, azul para a secundária, laranja para compra e aceleração; um botão de estado por prancha):
// usinas, oficinas, almoxarifado, prancha da obra (itens em círculos com o check), módulos, lista de obras,
// produção, pedidos, depósito de trocas, escritório/sede (repasses, serviços, bem-estar, topógrafo) e prédios
// novos. O HTML só é trocado quando muda (e nunca com o dedo na tela: o redesenho espera 30 ms depois de soltar);
// cronômetros e barras andam no tick(). Nada fica "disabled": o que não pode ser feito aparece esmaecido e o
// toque diz o motivo. Painéis abertos de dentro da folha empilham (até 5) e o '‹' volta na mesma rolagem.
// Economia nova (contrato de sim/estado.js, com chamadas tolerantes para funcionar antes e depois dela):
// lotes de 1 a 10 por ficha (− / + e "Produzir N"), cartão do lote em andamento ("3/10 · 12 min", Auto e x),
// coleta automática (Coletar só sobra com o Almoxarifado cheio), aceleradores ("Acelerar 1 h"), Depósito com o
// preço de venda em destaque e as vendas da janela, Escritório com a aba Finanças (valuation, renda, empréstimo),
// Pedidos com os totais por item e "Fabricar na Usina de Pedidos", e a fila da Usina de Pedidos da Comunidade.
import { el, fmt, dur } from '../core/util.js';
import { img, icone } from './icones.js';
import { ITENS, PREDIOS, USINAS, OFICINAS, BRUTOS, receitas } from '../data/itens.js';
import { PROJETOS, PROJ, MODULOS, POP_NIVEL, LIMITE_CAP } from '../data/obras.js';
import { REGRAS, TOPOGRAFO } from '../sim/estado.js';
import { depositoAberto, calendarioDe, rendaHoraDe } from './hud.js';

const nomeIt = (k) => ITENS[k]?.nome || k;
const NOME_SERV = { agua: 'Água', energia: 'Energia', saneamento: 'Saneamento' };
const hhmm = (t) => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
function reqTxt(r) { const [a, b] = r.split('.'); if (MODULOS[a]) return `${MODULOS[a].nome} com um módulo no nível ${b}`; const p = PROJ[a]; const e = p?.etapas.find((x) => x.id === b); return `${p?.nome}: ${e?.nome}`; }
const titulo = (t) => `<h3 class="secao">${t}</h3>`;
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
// miniatura da foto de referência no cabeçalho: recorte foto:[x,y,w,h] (coordenadas da foto de 1376x768) em 56x40 por
// background-position sobre a mesma foto do Comparar, já decodificada (sem arquivo novo)
const FOTO_W = 1376;
const miniFoto = (f) => { if (!f) return ''; const k = 56 / f[2]; return `<div class="mini-foto" style="background-size:${(FOTO_W * k).toFixed(1)}px auto;background-position:${(-f[0] * k).toFixed(1)}px ${(-f[1] * k).toFixed(1)}px" aria-hidden="true"></div>`; };
// formato único de custo nos botões: verbo em cima, moeda e relógio embaixo
const custoTx = (cr, ms, extra = '') => `<span class="custo">${cr != null ? `${img('creditos')}<b>${fmt(cr)}</b>` : ''}${ms != null ? `${img('relogio')}<b>${dur(ms / 1000)}</b>` : ''}${extra}</span>`;
const rot = (verbo, custo = '') => `<span class="rot"><span class="verbo">${verbo}</span>${custo}</span>`;
// obra que dá cada serviço (a primeira etapa com esse serviço ainda não concluída; senão a primeira que o dá)
function obraServico(J, k) { let prim = null; for (const p of PROJETOS) for (const e of p.etapas) { if (!e.servico?.[k]) continue; const key = p.id + '.' + e.id; if (!prim) prim = key; if (!J.feita(key) && J.capEtapa(p, e) <= J.S.cap) return key; } return prim; }
// obra que dá bem-estar e ainda não foi feita (para o "Ir" do motivo)
function obraBem(J) { for (const p of PROJETOS) { if (p.cap > J.S.cap) continue; for (const e of p.etapas) { const key = p.id + '.' + e.id; if (e.bem && !J.feita(key) && J.capEtapa(p, e) <= J.S.cap) return key; } } return null; }
// duração curta (vagas de 56 px): 39 s, 1m 18s, 2h 05
const durCurta = (s) => { s = Math.max(0, Math.ceil(s)); if (s < 60) return s + ' s'; if (s < 3600) { const m = Math.floor(s / 60), r = s % 60; return m + 'm' + (r ? ' ' + String(r).padStart(2, '0') + 's' : ''); } const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h + 'h ' + String(m).padStart(2, '0'); };
// valores de dinheiro por extenso (finanças: 512.345, e não "512 mil") e porcentagens
const numEx = (n) => Math.round(n || 0).toLocaleString('pt-BR');
const pctTx = (f) => Math.round((f || 0) * 100) + '%';
// números da economia nova, com os padrões do contrato enquanto a simulação não os exportar
const LOTE_MAX = () => REGRAS.loteMax ?? 10, F_LOTE = () => REGRAS.fLote ?? REGRAS.loteFator ?? 0.8, ACELERA_H = () => REGRAS.aceleraH ?? 1;
const EMP = () => ({ passo: REGRAS.empPasso ?? 1000, ano: REGRAS.empAno ?? 50000, max: REGRAS.empMax ?? 500000, taxa: REGRAS.empTaxa ?? 0.1, prazo: REGRAS.empPrazoAnos ?? 10, mora: REGRAS.empMora ?? 0.2 });
const NOME_VAL = { obras: 'Obras aprovadas', modulos: 'Módulos residenciais', predios: 'Prédios do canteiro', moradores: 'Moradores', caixa: 'Caixa (créditos − dívida)' };
// avisos das ações novas (os códigos que o Controle não conhece)
const MSG = () => ({ limiteAno: `Limite do ano: cada ano do jogo permite tomar até ${numEx(EMP().ano)}`, limiteDivida: `Dívida máxima de ${numEx(EMP().max)} alcançada: pague uma parte antes`, valor: 'O valor vai em passos de 1.000', nadaPagar: 'Nada a pagar por enquanto', semAcelerador: 'Sem aceleradores: cada etapa aprovada dá um de obra e um de produção', nadaAcelerar: 'Nada para acelerar aqui', usinaPedidos: 'Construa a Usina de Pedidos da Comunidade primeiro', filaPedidos: 'A fila da Usina de Pedidos está cheia' });

export class Paineis {
  constructor(raiz, C) {
    this.raiz = raiz; this.C = C; this.atual = null; this.el = null; this.aba = {}; this.pilha = []; this.destaque = null;
    this._segura = false; this._pend = false; this._ultimoHtml = null; this._falta = null; this._faltaPed = null; this._lixo = null;
    this._confirma = null; this._resumo = null; this._mais = null; this._voo = null; this._entrada = false; // dois toques, resumo do pedido, "+N" da ficha, voo até o espaço, stagger
    this.qtd = {}; this.emp = null; // quantidade escolhida por ficha ("predio|item") e o valor do empréstimo a tomar
    const solta = () => { if (!this._segura) return; this._segura = false; if (this._pend) setTimeout(() => this.render(), 30); };
    window.addEventListener('pointerup', solta); window.addEventListener('pointercancel', solta);
    this._medir(); window.addEventListener('resize', () => { this._medir(); if (this.el) this.C.painelMudou?.(true); });
  }
  // largura da folha: até 412 px e 44% da largura, e a área (largura x altura útil, abaixo do selo do nível) em no
  // máximo 36% da tela; vai para o CSS em --folhaW (a doca de falas se centra no que sobra)
  _medir() { const W = innerWidth, H = innerHeight; this._w = Math.floor(Math.min(412, W * 0.44, (0.36 * W * H) / Math.max(1, H - 80))); document.documentElement.style.setProperty('--folhaW', this._w + 'px'); return this._w; }
  get J() { return this.C.J; }
  get largura() { return this._w || this._medir(); }
  abrir(tipo, arg, o = {}) {
    const mesmo = this.atual && this.atual.tipo === tipo && JSON.stringify(this.atual.arg) === JSON.stringify(arg);
    if (mesmo && !o.forcar && !this._reabrir) { this._reabrir = false; if (o.destaque) this.destacar(o.destaque); else this.fechar(); return; }
    this._reabrir = false; const empilha = o.pilha || this._empilhar; this._empilhar = false;
    let pilha = []; if (empilha && this.atual) pilha = [...this.pilha, { tipo: this.atual.tipo, arg: this.atual.arg, rol: this.el?.querySelector('.corpo')?.scrollTop || 0 }].slice(-5); else if (o.manter) pilha = this.pilha;
    this.fechar(true, true); this.pilha = pilha; this._falta = null; this._faltaPed = null; this._lixo = null; this._confirma = null; this._resumo = null; this.destaque = o.destaque || null; this._rolar = o.rol || 0; this._entrada = true;
    this.atual = { tipo, arg }; this.el = el('div', 'folha'); this.el.setAttribute('role', 'dialog'); this.raiz.appendChild(this.el); this.raiz.classList.add('painel-aberto');
    this.el.addEventListener('click', (e) => this._clique(e)); this.el.addEventListener('pointerdown', () => { this._segura = true; });
    this.render(true); this.C.som.abrir(); this.C.aoAbrir?.(tipo, arg); this.C.painelMudou?.(true);
  }
  // imediato: troca de painel (sem animação de saída)
  fechar(silencio, imediato) {
    if (!this.el) return; const f = this.el; this.el = null; this._ultimoHtml = null; this.pilha = []; this.destaque = null; clearTimeout(this._tDest);
    if (imediato) f.remove(); else { f.classList.add('sai'); const fim = () => f.remove(); f.addEventListener('animationend', fim, { once: true }); setTimeout(fim, 200); }
    const a = this.atual; this.atual = null; if (!imediato) { this.raiz.classList.remove('painel-aberto'); this.C.painelMudou?.(false); }
    if (!silencio) this.C.som.fechar(); this.C.aoFechar?.(a);
  }
  voltar() { const p = this.pilha.pop(); if (!p) return; const resto = this.pilha; this.abrir(p.tipo, p.arg, { forcar: true, rol: p.rol }); this.pilha = resto; this._ultimoHtml = null; this.render(true); this.C.som.toque(); }
  // pedir um redesenho (eventos da simulação): junta os pedidos e respeita o dedo na tela
  agendar() { if (!this.el || this._tAg) return; this._tAg = setTimeout(() => { this._tAg = 0; this.render(); }, 30); }
  render(forcar) {
    if (!this.el) return; if (this._segura && !forcar) { this._pend = true; return; } this._pend = false; this._precisa = false;
    const { tipo, arg } = this.atual; const r = this['r_' + tipo](arg); if (!r) { this.fechar(true); return; }
    const html = `<header>${this.pilha.length ? '<button class="voltar" data-a="voltar" aria-label="Voltar">‹</button>' : ''}<div class="ic">${img(r.icone)}</div>${miniFoto(r.foto)}<div class="tt"><h2>${r.titulo}</h2><small>${r.sub || ''}</small></div><button class="x" data-a="fechar" aria-label="Fechar"></button></header><div class="corpo">${r.corpo}</div>`;
    if (html !== this._ultimoHtml) {
      const sc = this._rolar || this.el.querySelector('.corpo')?.scrollTop || 0; this._rolar = 0;
      this.el.innerHTML = html; this._ultimoHtml = html; this.el.setAttribute('aria-label', r.nome || r.titulo); const c = this.el.querySelector('.corpo');
      // barra fixa (ações da prancha, resumo do pedido, aviso de falta): sai do corpo e vira o rodapé sólido da folha; a
      // altura vai para --acoesH (o corpo rola por cima dela, e a licença que falta fica sempre à vista)
      const fixos = [...c.children].filter((e) => e.matches('.linha.acoes.fixa, .cartao.fixo, .cartao.resumo, .linha.licenca.fixo'));
      if (fixos.length) { const rod = el('div', 'rodape'); for (const e of fixos) rod.appendChild(e); this.el.appendChild(rod); }
      this.el.style.setProperty('--acoesH', (fixos.length ? this.el.lastElementChild.offsetHeight : 0) + 'px');
      if (c && sc) c.scrollTop = sc;
      // entrada escalonada dos 8 primeiros cartões, só na abertura da folha (os redesenhos não repetem)
      if (this._entrada) { this._entrada = false; [...c.querySelectorAll('.cartao, .ficha, .vaga, .item-lista, .pedido, .lote, .contrato')].slice(0, 8).forEach((e, i) => { e.style.setProperty('--i', i); e.classList.add('entra-i'); }); }
      this._aplicarDestaque();
    }
    this.tick(); this._voar();
  }
  // ícone que voa da ficha até o espaço que recebeu o lote (usina e oficina): arco curto, pulso no destino e som de encaixe
  _voar() {
    const v = this._voo; this._voo = null; if (!v || !this.el) return; const dest = this.el.querySelector(`[data-slot="${v.slot}"]`); if (!dest) return;
    const r = dest.getBoundingClientRect(); if (!r.width) return; const x1 = r.left + r.width / 2, y1 = r.top + r.height / 2; const C = this.C;
    const im = el('img', 'voa'); im.src = icone(v.k); im.alt = ''; im.draggable = false; document.body.appendChild(im); const t0 = performance.now(), D = 560; const xm = (v.x + x1) / 2, ym = Math.min(v.y, y1) - 70;
    const step = (t) => { const k = Math.min(1, (t - t0) / D); const e = k * (2 - k), u = 1 - e; const x = u * u * v.x + 2 * u * e * xm + e * e * x1, y = u * u * v.y + 2 * u * e * ym + e * e * y1; im.style.transform = `translate(${(x - 19).toFixed(1)}px,${(y - 19).toFixed(1)}px) scale(${(1.2 - 0.6 * e).toFixed(3)})`; if (k < 1) requestAnimationFrame(step); else { im.remove(); C.hud.pulsa?.(dest); if (C.som.encaixe) C.som.encaixe(); else C.som.coleta?.(); } };
    requestAnimationFrame(step);
  }
  _conf(chave) { return !!this._confirma && this._confirma.chave === chave && performance.now() - this._confirma.t < 2600; }
  // dois toques (compra acima de 10% dos créditos, Novo espaço, Mutirão, ampliar o Almoxarifado): o primeiro vira
  // "Confirmar" por 2,6 s; devolve true quando o segundo chegou e a ação pode rodar
  _dois(chave) {
    if (this._conf(chave)) { this._confirma = null; return true; }
    this._confirma = { chave, t: performance.now() }; this.C.vibra.tique(); this.render(true);
    setTimeout(() => { if (this._confirma?.chave === chave) { this._confirma = null; this.render(); } }, 2600); return false;
  }
  // destaque (anel dourado) no elemento que a Meta em foco ou o Próximo indicaram
  destacar(sel, ms = 6000) { this.destaque = sel; clearTimeout(this._tDest); if (sel) this._tDest = setTimeout(() => { this.destaque = null; this.el?.querySelector('.alvo')?.classList.remove('alvo'); }, ms); this._aplicarDestaque(); }
  // (controle esmaecido depois de uma ação, como 'Entregar o que tenho (0 de n)': o destaque sai dele)
  _aplicarDestaque() { if (!this.el) return; this.el.querySelector('.alvo')?.classList.remove('alvo'); if (!this.destaque) return; const e = this.el.querySelector(this.destaque); if (e?.classList.contains('fraco')) { this.destaque = null; return; } if (e) { e.classList.add('alvo'); e.scrollIntoView?.({ block: 'nearest' }); } }
  tick() { // cronômetros e barras sem redesenhar
    if (!this.el) return; const agora = this.J.agora;
    for (const n of this.el.querySelectorAll('[data-fim]')) { const ini = +n.dataset.ini, fim = +n.dataset.fim; const p = Math.max(0, Math.min(1, (agora - ini) / (fim - ini || 1))); const b = n.querySelector('.pb, .barra i'); if (b) b.style.width = (p * 100).toFixed(1) + '%'; const t = n.querySelector('.tt'); if (t) t.textContent = fim > agora ? (n.classList.contains('vaga') ? durCurta : dur)((fim - agora) / 1000) : 'pronto'; if (fim <= agora && !n.dataset.feito) { n.dataset.feito = 1; this._precisa = true; }
      const f = n.querySelector('.feitos'); if (f) { const q = +n.dataset.n || 1; const tx = String(Math.min(q, Math.floor(p * q))); if (f.textContent !== tx) f.textContent = tx; } } // lote: unidades já feitas
    if (this._precisa) { this._precisa = false; this.agendar(); }
  }
  // a simulação nova (lotes, automático, aceleradores, finanças) está presente?
  get nova() { return typeof this.J.loteMax === 'function'; }
  // quantidade escolhida numa ficha e o máximo dela (usina: 10; oficina: o que os insumos permitem)
  _n(id, k) { return Math.max(1, Math.min(LOTE_MAX(), this.qtd[id + '|' + k] || 1)); }
  _loteMax(id, k) { return PREDIOS[id]?.tipo === 'usina' ? LOTE_MAX() : Math.min(LOTE_MAX(), this.J.loteMax?.(id, k) ?? LOTE_MAX()); }
  _durLote(k, n) { const J = this.J; return J.durLote?.(k, n) ?? J.durItem(k) * (n > 1 ? n * F_LOTE() : 1); }
  // enfileirar com a assinatura nova (oid, item, n, auto, encadear) ou a antiga (oid, item, encadear)
  _enfileirar(oid, k, n, auto, encadear) { return this.nova ? this.J.enfileirar(oid, k, n, auto, encadear) : this.J.enfileirar(oid, k, encadear); }
  _aviso(codigo, icone = null) { const C = this.C, m = MSG()[codigo]; if (m) { C.som.erro(); C.vibra.erro(); C.hud.brinde(m, icone, 2800); } else C.falha(codigo); }
  _acelerar(alvo) {
    const J = this.J, C = this.C; const r = J.acelerar ? J.acelerar(alvo) ?? 'ok' : 'bloqueado';
    if (r === 'ok') { const A = J.S.aceleradores || {}; const prod = !!alvo.predio; C.vibra.tique(); C.som.obra?.(); C.hud.brinde(`Acelerado ${ACELERA_H()} h · restam ${A[prod ? 'producao' : 'obra'] ?? 0} de ${prod ? 'produção' : 'obra'}`, 'acelerar', 2600); C.sincronizar(); }
    else this._aviso(r === 'sem' ? 'semAcelerador' : r === 'nada' ? 'nadaAcelerar' : r, 'acelerar');
    this.render(true); C.hud.atualizar();
  }
  _clique(e) {
    const b = e.target.closest('[data-a]'); if (!b || !this.el?.contains(b)) return; const a = b.dataset.a; const d = b.dataset; const C = this.C; const J = this.J;
    if (a === 'fechar') return this.fechar();
    if (a === 'voltar') return this.voltar();
    C.som.toque();
    const res = (r, ok, fx) => { if (r === 'ok') { C.vibra.tique(); ok && ok(); } else C.falha(r, fx); this.render(true); C.hud.atualizar(); };
    // voo da ficha até o espaço que recebeu o lote (consumido no próximo render)
    const voo = (k, slot) => { const [x, y] = C._pontoTela(b); this._voo = { k, x, y, slot }; };
    switch (a) {
      case 'produzir': { const antes = J.S.predios[d.p].slots.map((s) => !!s); res(J.produzir(d.p, d.k, this._n(d.p, d.k), false), () => voo(d.k, J.S.predios[d.p].slots.findIndex((s, k) => s && !antes[k]))); C.agendar(); break; }
      case 'coletarU': C.coletarUsina(d.p, +d.i, b); this.render(true); break;
      case 'coletarO': C.coletarOficina(d.p, b); this.render(true); break;
      case 'enfileirar': { const n = Math.max(1, Math.min(this._n(d.p, d.k), this._loteMax(d.p, d.k))); const r = this._enfileirar(d.p, d.k, n, false, false); if (r === 'falta') { this._falta = d.k; this.render(true); C.falha('falta'); } else res(r, () => voo(d.k, J.S.predios[d.p].fila.length - 1)); C.agendar(); break; }
      case 'cadeia': { const r = this._enfileirar(d.p, d.k, 1, false, true); C.produzirCadeia(d.k, r === 'ok'); this._falta = null; this.render(true); C._dica('cadeia'); break; }
      // lotes: quantidade por ficha (1 a 10), modo automático e cancelar (usina: espaço i; oficina: trabalho j)
      case 'loteMenos': case 'loteMais': { const n = this._n(d.p, d.k) + (a === 'loteMais' ? 1 : -1); this.qtd[d.p + '|' + d.k] = Math.max(1, Math.min(LOTE_MAX(), n)); this.render(true); break; }
      case 'autoSlot': { const on = d.on === '1'; const r = J.setAuto ? J.setAuto(d.p, +d.i, on) ?? 'ok' : 'bloqueado'; res(r, () => C.hud.brinde(on ? 'Automático: este espaço repete o mesmo lote' : 'Manual: para quando o lote terminar', on ? 'acelerar' : null, 2400)); break; }
      case 'autoFila': { const on = d.on === '1'; const r = J.setAutoFila ? J.setAutoFila(d.p, on, d.k, +d.n || 1) ?? 'ok' : 'bloqueado'; res(r, () => C.hud.brinde(on ? `Automático: ${nomeIt(d.k)} em lotes de ${d.n || 1} enquanto houver insumos` : 'Manual: a fila para quando esvaziar', on ? 'acelerar' : null, 2600)); break; }
      case 'cancelarSlot': res(J.cancelarSlot ? J.cancelarSlot(d.p, +d.i) ?? 'ok' : 'bloqueado', () => C.hud.brinde('Lote cancelado', null, 1800)); C.agendar(); break;
      case 'cancelarFila': res(J.cancelarFila ? J.cancelarFila(d.p, +d.j) ?? 'ok' : 'bloqueado', () => C.hud.brinde('Trabalho cancelado: os insumos voltaram ao Almoxarifado', 'almox', 2400)); C.agendar(); break;
      case 'acelerar': this._acelerar(JSON.parse(d.alvo)); break;
      // finanças: empréstimo (− / + em passos de 1.000), pagar juros, parcela ou quitar
      case 'empMenos': case 'empMais': { const E = EMP(); this.emp = (this._empValor() || 0) + (a === 'empMais' ? E.passo : -E.passo); this.render(true); break; }
      case 'emprestar': { const v = +d.v; if (!(v > 0)) { this._aviso('limiteAno', 'emprestimo'); break; } const r = J.emprestar ? J.emprestar(v) : 'bloqueado';
        if (r === 'ok') { C.vibra.sucesso(); C.som.moedas(); const [x, y] = C._pontoTela(b); C._moedas?.(v, x, y, 6); } else this._aviso(r, 'emprestimo'); this.render(true); C.hud.atualizar(); break; } // (o aviso vem da simulação)
      case 'pagarJuros': case 'pagarParcela': case 'quitar': { const antes = J.S.creditos; const r = J[a] ? J[a]() : 'bloqueado';
        if (r === 'ok') { C.vibra.tique(); C.som.moedas(); C.hud.brinde(`${a === 'quitar' ? 'Dívida quitada' : a === 'pagarJuros' ? 'Juros pagos' : 'Parcela e juros pagos'}: −${numEx(antes - J.S.creditos)}`, 'emprestimo', 2600); } else this._aviso(r === 'nada' ? 'nadaPagar' : r, 'emprestimo'); this.render(true); C.hud.atualizar(); break; }
      // pedidos: fabricar (ou parar) na Usina de Pedidos da Comunidade
      case 'fabricarPedido': { const r = J.fabricarPedido ? J.fabricarPedido(+d.i) ?? 'ok' : 'bloqueado'; if (r === 'ok') { C.vibra.tique(); C.hud.brinde('Usina de Pedidos: fabricando o que falta', 'predio:usina2', 2400); } else this._aviso(r === 'fechado' ? 'usinaPedidos' : r === 'cheio' ? 'filaPedidos' : r, 'predio:usina2'); this.render(true); break; }
      case 'pararPedido': res(J.pararPedido ? J.pararPedido(+d.i) ?? 'ok' : 'bloqueado'); break;
      case 'ampliar': if (J.S.creditos >= J.custoEspaco(d.p) && !this._dois('ampliar|' + d.p)) break; res(J.ampliar(d.p), () => C.hud.brinde(PREDIOS[d.p].tipo === 'usina' ? 'Novo espaço de produção' : 'Mais uma vaga na fila', 'subir')); break;
      case 'mutirao': if (J.S.mutirao > 0 && !this._dois('mutirao|' + d.alvo)) break; res(J.mutirao(JSON.parse(d.alvo)), () => { C.hud.brinde(`Mutirão: ${REGRAS.mutiraoH} h adiantadas`, 'mutirao'); C.sincronizar(); }); break;
      case 'entregar': { if (!(J.S.itens[d.k] > 0)) { C.irProdutor(d.k); break; } const e0 = J.etapa(d.key).entregue?.[d.k] || 0; res(J.entregar(d.key, d.k), () => { C.som.coleta(); const n = (J.etapa(d.key).entregue?.[d.k] || 0) - e0; if (n > 0) { this._mais = { key: d.key, k: d.k, n, t: performance.now() }; clearTimeout(this._tMais); this._tMais = setTimeout(() => { this._mais = null; }, 800); } }); C.sincronizar(); break; }
      case 'produtor': C.irProdutor(d.k); break;
      case 'entregarTudo': { const r = J.entregarTudo(d.key); res(r === 'nada' ? 'nadaEntregar' : r, () => C.som.coleta()); C.sincronizar(); break; }
      // um botão só na prancha: entrega o que há e inicia; se ainda falta material, a entrega parcial vale (sem erro) e o
      // botão passa a dizer quanto falta; sem nada para entregar, o aviso explica
      case 'entregarIniciar': case 'iniciar': {
        const entregou = a === 'entregarIniciar' && J.entregarTudo(d.key) === 'ok'; const r = J.iniciarEtapa(d.key);
        if (r === 'ok') { C.vibra.sucesso(); C.som.obra(); C.sincronizar(); this.render(true); C.hud.atualizar(); setTimeout(() => { if (this.atual?.tipo === 'etapa' && this.atual.arg === d.key) this.fechar(true); C.irPara({ etapa: d.key }, false); }, 250); }
        else if (r === 'falta' && entregou) { C.som.coleta(); C.vibra.tique(); this.render(true); C.sincronizar(); C.hud.atualizar(); }
        else { C.falha(r === 'falta' ? 'faltaPrancha' : r); this.render(true); C.sincronizar(); }
        break; }
      case 'topografo': res(J.encomendarLicenca(d.k), () => C.hud.brinde(`Topógrafo: ${nomeIt(d.k)} encomendada`, d.k)); C._dica('topografo'); break;
      case 'aprovar': C.aprovarEtapa(d.key); break;
      case 'melhorar': { const r = J.melhorarModulo(d.f, +d.i); const q = J.requisitosModulo(d.f, +d.i); if (r === 'servico') C._dica(q.servicos.includes('energia') ? 'servicoEnergia' : 'servicoAgua'); else if (r === 'bem') C._dica('bemNivel');
        res(r, () => { C.som.obra(); C.vibra.sucesso(); }, { bemMin: q.bemMin, servicos: q.servicos }); C.sincronizar(); if (r === 'ok') setTimeout(() => { if (this.atual?.tipo === 'modulo') this.fechar(true); C.irPara({ modulo: [d.f, +d.i] }, false); }, 250); break; }
      case 'aprovarMod': C.aprovarModulo(d.f, +d.i); break;
      case 'ir': this._empilhar = true; C.irPara(JSON.parse(d.alvo)); this._empilhar = false; break;
      case 'aba': this.aba[this.atual.tipo] = d.v; this.destaque = null; this.render(true); break;
      case 'ampliarAlmox': { if (!this._dois('ampliarAlmox')) break; const cap0 = J.capacidade; res(J.ampliarAlmox(), () => C.hud.brinde(`Almoxarifado ampliado: +${J.capacidade - cap0} vagas`, 'almox')); break; }
      case 'deposito': this.abrir('deposito', undefined, { pilha: true }); break;
      case 'comprar': { const preco = (J.estoqueDeposito ? J.estoqueDeposito(d.k).preco : J.precoCompra?.(d.k)) || 0; if (preco > 0.1 * J.S.creditos && J.S.creditos >= preco && !this._dois('comprar|' + d.k)) break; res(J.comprar(d.k), () => { C.som.moedas(); const [x, y] = C._pontoTela(b); C.hud.voar(d.k, x, y, 'almox'); }); break; }
      case 'vender': res(J.vender(d.k, 1), () => C.som.moedas()); break;
      case 'pedido': this._pedido(+d.i, b); break;
      case 'entregarPedido': this._entregarPedido(+d.i, b); break;
      case 'descartar': {
        const i = +d.i; if (this._lixo?.i === i && performance.now() - this._lixo.t < 2500) { this._lixo = null; if (this._resumo?.i === i) this._resumo = null; res(J.descartarPedido(i)); break; }
        this._lixo = { i, t: performance.now() }; this.render(true); setTimeout(() => { if (this._lixo?.i === i) { this._lixo = null; this.render(); } }, 2500); break; }
      case 'construir': res(J.construirPredio(d.p), () => { C.som.obra(); C.predioConstruido(d.p); }); break;
      case 'repasse': C.coletarRepasse(b); this.render(true); break;
      case 'abrir': this.abrir(d.t, d.arg ? JSON.parse(d.arg) : undefined, { pilha: true }); break;
      case 'fraco': C.falha(d.motivo || 'bloqueado'); break;
    }
  }
  // pedido: completo abre o resumo no rodapé (o que entrega e o que rende, com Entregar e a lixeira); o segundo toque no
  // cartão também entrega; incompleto treme e diz o que falta
  _pedido(i, b) {
    const J = this.J, C = this.C; const p = J.S.pedidos[i]; if (!p?.itens) return;
    const falta = Object.entries(p.itens).filter(([k, n]) => !J.temItem(k, n)).map(([k, n]) => [k, n - (J.S.itens[k] || 0)]);
    if (falta.length) { this._faltaPed = { i, falta, t: performance.now() }; this._resumo = null; C.som.erro(); C.vibra.erro(); this.render(true); return; }
    if (this._resumo?.i === i) return this._entregarPedido(i, b);
    this._resumo = { i }; this._faltaPed = null; C.vibra.tique(); this.render(true);
  }
  _entregarPedido(i, b) {
    const J = this.J, C = this.C; const p = J.S.pedidos[i]; if (!p?.itens) return;
    const R = p.recompensa || { creditos: p.creditos || 0, xp: p.xp || 0 }; const [x, y] = C._pontoTela(b);
    const r = J.entregarPedido(i); if (r !== 'ok') { C.falha(r); this.render(true); return; }
    C.som.moedas(); C.vibra.sucesso(); this._faltaPed = null; this._resumo = null; C.recompensa({ creditos: R.creditos, xp: R.xp, itens: R.itens }, x, y);
    this.render(true); C.calcBolhas();
  }
  // o que um pedido rende, por extenso ("260 créditos, 29 XP, +15 de disposição")
  _ganhosPedido(p) { const R = p.recompensa || { creditos: p.creditos || 0, xp: p.xp || 0, itens: p.especial ? { [p.especial]: 1 } : null }; return [R.creditos ? `${fmt(R.creditos)} créditos` : '', R.xp ? `${R.xp} XP` : '', ...Object.entries(R.itens || {}).map(([k, n]) => `${n} ${nomeIt(k)}`), R.bem ? `+${R.bem.n}% de bem-estar` : '', R.disposicao ? `+${R.disposicao} de disposição` : ''].filter(Boolean).join(', '); }
  // números que a interface mostra medidos na própria simulação (sem copiar constantes): vagas que a próxima
  // ampliação dá, hora em que a janela do Depósito vira e o início da espera de um pedido que está chegando
  _passoAlmox() { const J = this.J; const P = Object.create(J); P.S = { ...J.S, almoxNivel: J.S.almoxNivel + 1 }; return P.capacidade - J.capacidade; }
  _renovaDeposito() {
    const J = this.J; if (typeof J._janela !== 'function') return null; const P = Object.create(J); const j0 = J._janela(); let a = J.agora, b = a + 36e5;
    for (let k = 0; k < 8; k++) { P.agora = b; if (P._janela() !== j0) break; const d = b - a; a = b; b += d * 2; } P.agora = b; if (P._janela() === j0) return null;
    while (b - a > 1000) { const m = (a + b) / 2; P.agora = m; if (P._janela() === j0) a = m; else b = m; } return b;
  }
  _iniPedido(p) { const M = (this._iniPed ||= new Map()); let t = M.get(p.id); if (t == null || t > p.espera) { t = Math.min(this.J.agora, p.espera); M.set(p.id, t); } return t; }
  // ---------- componentes ----------
  // o = {cls, data, tem (chip azul de estoque), selo ok|falta, aro (% entregue, prancha), sub, extra, cad (motivo do
  // cadeado: "Nível 10", "Cap. 3", "Esgotado"), mais ("+N" que sobe ao entregar)}
  ficha(k, o = {}) {
    const tem = o.tem != null ? `<span class="tem">${o.tem}</span>` : '';
    const selo = o.selo === 'ok' ? '<i class="selo ok" aria-hidden="true"></i>' : o.selo === 'falta' ? '<i class="selo falta" aria-hidden="true">!</i>' : '';
    const cad = o.cad ? `<span class="cadeado" aria-hidden="true">${/^(Nível|Cap\.)/.test(o.cad) ? img('cadeado') : ''}<b>${o.cad.replace('Nível ', '')}</b></span>` : '';
    return `<button class="ficha ${o.cls || ''} ${o.mais ? 'mais-n' : ''}" data-k="${k}" ${o.data || ''}${o.mais ? ` data-mais="+${o.mais}"` : ''}${o.cad ? ` aria-label="${o.nome ?? nomeIt(k)}: ${o.cad}"` : ''}>${cad}${tem}${selo}${o.aro != null ? `<span class="aro" style="--e:${o.aro}%">${img(k)}</span>` : img(k)}<b>${o.nome ?? nomeIt(k)}</b>${o.sub ? `<small class="qtd">${o.sub}</small>` : ''}${o.extra || ''}</button>`;
  }
  // chips de receita: ícone, "×2" e um símbolo (check verde se tem, ponto de exclamação se falta) com o que há ao lado.
  // vezes: insumos do lote inteiro (n × req)
  chips(req, treme, vezes = 1) { return `<div class="req">${Object.entries(req).map(([k, n]) => { const t = this.J.S.itens[k] || 0; const q = n * vezes; const ok = t >= q; return `<span class="${ok ? 'ok' : 'f'} ${!ok && treme ? 'treme' : ''}" title="${nomeIt(k)}: ${t} no Almoxarifado">${img(k)}×${q}<i class="${ok ? 'sim' : 'nao'}" aria-hidden="true"></i><small>${t}</small></span>`; }).join('')}</div>`; }
  vaga(o) { return `<div class="vaga ${o.cls || ''}" ${o.fim ? `data-ini="${o.ini}" data-fim="${o.fim}"` : ''} ${o.slot != null ? `data-slot="${o.slot}"` : ''} ${o.data || ''}>${o.icone ? img(o.icone) : ''}${o.n > 1 ? `<i class="nn">×${o.n}</i>` : ''}${o.txt ? `<small>${o.txt}</small>` : ''}${o.fim ? '<i class="pb" style="width:0"></i><small class="tt"></small>' : ''}</div>`; }
  // "Novo espaço" (usina) ou "Nova vaga" (oficina): moeda com o valor; dois toques (o primeiro vira Confirmar)
  vagaMais(id) { const J = this.J; const c = J.custoEspaco(id); const conf = this._conf('ampliar|' + id); const usina = PREDIOS[id].tipo === 'usina'; return `<button class="vaga mais ${J.S.creditos >= c ? '' : 'fraco'} ${conf ? 'conf' : ''}" data-a="ampliar" data-p="${id}" aria-label="${usina ? 'Novo espaço' : 'Nova vaga'} por ${fmt(c)} créditos${conf ? ': toque de novo para confirmar' : ''}"><b>+</b><small>${conf ? 'Confirmar' : usina ? 'Novo espaço' : 'Nova vaga'}</small><small class="preco">${img('creditos')}${fmt(c)}</small></button>`; }
  motivoItem(k) { const I = ITENS[k], S = this.J.S; if ((I.cap || 1) > S.cap && !S.legado?.includes(k)) return `Cap. ${I.cap}`; if (I.nivel > S.nivel) return `Nível ${I.nivel}`; return ''; }
  // "Mutirão: adiantar 2 h" com o selo de ficha separado; dois toques (a ficha é rara)
  mutiraoBt(alvo, txt) { const S = this.J.S; const conf = this._conf('mutirao|' + JSON.stringify(alvo)); return `<button class="botao ouro ${S.mutirao > 0 ? '' : 'fraco'} ${conf ? 'conf' : ''}" data-a="mutirao" data-alvo='${JSON.stringify(alvo)}'>${img('mutirao')}${rot(conf ? 'Confirmar o Mutirão' : S.mutirao > 0 ? txt : 'Sem ficha', `<span class="custo"><b class="selo-ficha">1 ficha</b><small>${S.mutirao} de ${REGRAS.fichasMax}</small></span>`)}</button>`; }
  // "Acelerar 1 h": só quando a simulação tem aceleradores; tipo 'obra' (etapa, módulo) ou 'producao' (usina, oficina)
  aceleraBt(alvo, tipo) { const A = this.J.S.aceleradores; if (!A) return ''; const n = A[tipo] || 0; return `<button class="botao azul ${n > 0 ? '' : 'fraco'}" data-a="acelerar" data-alvo='${JSON.stringify(alvo)}'>${img('acelerar')}${rot(n > 0 ? `Acelerar ${ACELERA_H()} h` : 'Sem acelerador', `<span class="custo"><b class="selo-ficha">1 acelerador</b><small>${plural(n, 'restante', 'restantes')}</small></span>`)}</button>`; }
  // ficha com o seletor de lote (− n +) e "Produzir N · tempo"; nas oficinas, "até N" pelo que os insumos permitem.
  // Sem a simulação nova, a ficha de sempre (um por toque).
  fichaLote(k, o) {
    const J = this.J, S = J.S; const lib = J.liberado(k); const oficina = o.acao === 'enfileirar';
    if (!lib) return this.ficha(k, { cls: 'bloq', cad: this.motivoItem(k), data: 'data-a="fraco" data-motivo="nivel"' });
    if (!this.nova) return this.ficha(k, { sub: dur(J.durItem(k) / 1000), tem: S.itens[k] ? '×' + S.itens[k] : null, extra: oficina ? this.chips(ITENS[k].req) : '', data: `data-a="${o.acao}" data-p="${o.id}" data-k="${k}"` });
    const max = this._loteMax(o.id, k); const n = this._n(o.id, k); const eff = Math.max(1, Math.min(n, max || 1)); const tempo = dur(this._durLote(k, eff) / 1000);
    const ate = oficina ? (max <= 0 ? '<small class="ate nao">faltam insumos</small>' : max < LOTE_MAX() ? `<small class="ate">até ${max}</small>` : '') : '';
    const passo = `<span class="passo"><button class="pm" data-a="loteMenos" data-p="${o.id}" data-k="${k}" aria-label="Menos: lote de ${Math.max(1, n - 1)}">−</button><b class="n">${n}</b><button class="pm" data-a="loteMais" data-p="${o.id}" data-k="${k}" aria-label="Mais: lote de ${Math.min(LOTE_MAX(), n + 1)}">+</button></span>`;
    return `<div class="ficha lote-f ${oficina && max <= 0 ? 'falta' : ''}" role="button" data-a="${o.acao}" data-p="${o.id}" data-k="${k}" data-n="${eff}" aria-label="Produzir ${eff} ${nomeIt(k)} em ${tempo}">${S.itens[k] ? `<span class="tem">×${S.itens[k]}</span>` : ''}${img(k)}<b>${nomeIt(k)}</b>${oficina ? this.chips(ITENS[k].req, false, eff) : ''}${passo}${ate}<small class="qtd">${tempo}</small><small class="prod">Produzir ${eff}</small></div>`;
  }
  // lote em andamento (usina: espaço i; oficina: o trabalho da frente): ícone, feitas/n, tempo, barra, Auto e x
  lote(o) {
    const n = o.n || 1; const usina = o.tipo === 'usina';
    const autoD = usina ? `data-a="autoSlot" data-p="${o.id}" data-i="${o.i}"` : `data-a="autoFila" data-p="${o.id}" data-k="${o.item}" data-n="${n}"`;
    const cancD = usina ? `data-a="cancelarSlot" data-p="${o.id}" data-i="${o.i}"` : `data-a="cancelarFila" data-p="${o.id}" data-j="${o.j}"`;
    const bts = o.fixo ? '' : `<button class="auto" ${autoD} data-on="${o.auto ? 0 : 1}" aria-pressed="${o.auto ? 'true' : 'false'}" aria-label="${o.auto ? 'Automático: toque para voltar ao manual' : 'Manual: toque para repetir o lote sempre'}"><i></i><span>Auto</span></button><button class="canc" ${cancD} aria-label="Cancelar este lote">×</button>`;
    return `<div class="lote ${o.auto ? 'auto' : ''}" data-ini="${o.ini}" data-fim="${o.fim}" data-n="${n}" data-slot="${usina ? o.i : o.j}" title="${nomeIt(o.item)}">${img(o.item)}<div class="tx"><b><span class="feitos">0</span>/${n}</b><small class="tt"></small><div class="barra"><i style="width:0"></i></div></div>${bts}</div>`;
  }
  _empValor() { const E = EMP(), I = this.J.emprestimoInfo?.(); const max = I ? Math.floor(Math.max(0, Math.min(I.disponivelAno, I.limiteDivida - I.divida)) / E.passo) * E.passo : 0; const v = this.emp ?? Math.min(max, 10 * E.passo); return Math.max(max ? E.passo : 0, Math.min(max, Math.round(v / E.passo) * E.passo)); }
  // ---------- usina ----------
  r_usina(id) {
    const J = this.J, st = J.S.predios[id], P = PREDIOS[id]; if (!st.ok) return this.r_predio(id);
    if (P.pedidos) return this._usinaPedidos(id, st, P);
    let v = '', lotes = '', sobra = 0;
    for (let i = 0; i < st.nSlots; i++) { const s = st.slots[i]; if (!s) v += this.vaga({ txt: 'livre', cls: 'livre', slot: i }); else if (s.fim <= J.agora) { sobra++; v += `<button class="vaga pronto" data-a="coletarU" data-p="${id}" data-i="${i}" data-slot="${i}">${img(s.item)}${(s.n ?? 1) > 1 ? `<i class="nn">×${s.n}</i>` : ''}<small>Coletar</small></button>`; } else lotes += this.lote({ id, i, item: s.item, n: s.n ?? 1, ini: s.ini, fim: s.fim, auto: !!s.auto, tipo: 'usina' }); }
    if (st.nSlots < REGRAS.usinaMax) v += this.vagaMais(id);
    const produzindo = st.slots.some((s) => s && s.fim > J.agora);
    // com a coleta automática, um espaço só fica "pronto" quando o Almoxarifado não coube o lote
    const cheio = sobra && this.nova ? `<div class="linha etiqs"><span class="etiq nao">${img('almox')}Almoxarifado cheio: o lote espera vaga</span></div>` : '';
    const g = BRUTOS.map((k) => this.fichaLote(k, { id, acao: 'produzir' })).join('');
    const uso = st.slots.filter(Boolean).length;
    return { icone: 'predio:' + id, titulo: P.nome, sub: `${uso}/${st.nSlots} espaços · ${this.nova ? 'lotes até 10, coleta automática' : 'toque num material para produzir'}`, corpo: `${lotes ? `<div class="lotes">${lotes}</div>` : ''}<div class="vagas">${v}</div>${cheio}${produzindo ? `<div class="linha acoes">${this.mutiraoBt({ usina: id }, `Mutirão: adiantar ${REGRAS.mutiraoH} h`)}${this.aceleraBt({ predio: id }, 'producao')}</div>` : ''}${titulo('Produzir')}<div class="grade">${g}</div>` };
  }
  // Usina de Pedidos da Comunidade: só fabrica o que está nos pedidos (a fila vem de J.fabricarPedido)
  _usinaPedidos(id, st, P) {
    const J = this.J; let v = '', lotes = '';
    for (let i = 0; i < st.nSlots; i++) { const s = st.slots[i]; if (!s) v += this.vaga({ txt: 'livre', cls: 'livre', slot: i }); else if (s.fim <= J.agora) v += `<button class="vaga pronto" data-a="coletarU" data-p="${id}" data-i="${i}" data-slot="${i}">${img(s.item)}${(s.n ?? 1) > 1 ? `<i class="nn">×${s.n}</i>` : ''}<small>Coletar</small></button>`; else lotes += this.lote({ id, i, item: s.item, n: s.n ?? 1, ini: s.ini, fim: s.fim, tipo: 'usina', fixo: true }); }
    const fila = (st.fila || []).map((f) => `<span class="etiq">${img(f.item)}${f.n} ${nomeIt(f.item)}</span>`).join('');
    const peds = (J.S.pedidos || []).filter((p) => p?.itens && p.auto).length; const produzindo = st.slots.some((s) => s && s.fim > J.agora); const uso = st.slots.filter(Boolean).length;
    return { icone: 'predio:' + id, titulo: P.nome, sub: `${peds} pedido(s) em fabricação · ${uso}/${st.nSlots} espaços`, corpo: `<p class="desc">${P.desc}</p>${lotes ? `<div class="lotes">${lotes}</div>` : ''}<div class="vagas">${v}</div>${titulo('Fila de fabricação')}${fila ? `<div class="linha etiqs">${fila}</div>` : '<p class="desc">Nada na fila. Em <b>Pedidos</b>, toque em "Fabricar na Usina de Pedidos" para esta usina fazer o que falta.</p>'}<div class="linha acoes"><button class="botao sec" data-a="abrir" data-t="pedidos">${img('pedidos')} Ver os pedidos</button>${produzindo ? this.aceleraBt({ predio: id }, 'producao') : ''}</div>` };
  }
  // ---------- oficina ----------
  r_oficina(id) {
    const J = this.J, st = J.S.predios[id], P = PREDIOS[id]; if (!st.ok) return this.r_predio(id);
    const vagas = J.vagasFila?.(id) ?? st.nFila; let v = '', lotes = '';
    for (let i = 0; i < vagas; i++) { const f = st.fila[i]; if (!f) v += this.vaga({ txt: 'livre', cls: 'livre', slot: i }); else if (i === 0 && f.fim) { if (this.nova) lotes += this.lote({ id, j: 0, item: f.item, n: f.n ?? 1, ini: f.ini, fim: f.fim, auto: !!st.auto && st.auto.item === f.item, tipo: 'oficina' }); else v += this.vaga({ icone: f.item, ini: f.ini, fim: f.fim, slot: 0 }); } else v += this.vaga({ icone: f.item, n: f.n, txt: f.pend ? 'espera' : 'na fila', cls: f.pend ? 'espera' : '', slot: i }); }
    if (st.nFila < REGRAS.filaMax) v += this.vagaMais(id);
    const cheia = st.prontos.length >= REGRAS.bandeja;
    const prontos = st.prontos.length ? `<div class="linha acoes"><button class="botao" data-a="coletarO" data-p="${id}">${img(st.prontos[0])} Coletar ${st.prontos.length}</button>${this.nova ? `<span class="etiq nao">${img('almox')}Almoxarifado cheio</span>` : cheia ? '<span class="etiq nao">Bandeja cheia: a fila parou</span>' : ''}</div>` : '';
    const auto = st.auto?.item ? `<div class="linha etiqs"><span class="etiq ok">${img('acelerar')}Automático: ${st.auto.n || 1} ${nomeIt(st.auto.item)} enquanto houver insumos</span></div>` : '';
    const falta = this._falta && ITENS[this._falta]?.oficina === id ? `<div class="cartao aviso-falta">${img(this._falta)}<div class="tx">Faltam insumos para <b>${nomeIt(this._falta)}</b>. Na cadeia, o item espera na fila e puxa os insumos quando ficarem prontos.</div><button class="botao" data-a="cadeia" data-p="${id}" data-k="${this._falta}">Encomendar em cadeia</button></div>` : '';
    const g = receitas(id).map((k) => this.fichaLote(k, { id, acao: 'enfileirar' })).join('');
    const rodando = st.fila.length && st.fila[0].fim && st.fila[0].fim > J.agora;
    return { icone: 'predio:' + id, titulo: P.nome, sub: `Fila ${st.fila.length}/${vagas} · um trabalho de cada vez${this.nova ? ', em lotes' : ''}`, corpo: `${lotes ? `<div class="lotes">${lotes}</div>` : ''}<div class="vagas">${v}</div>${prontos}${auto}${falta}${rodando ? `<div class="linha acoes">${this.mutiraoBt({ oficina: id }, 'Mutirão: adiantar o item')}${this.aceleraBt({ predio: id }, 'producao')}</div>` : ''}${titulo('Fabricar')}<div class="grade">${g}</div>` };
  }
  // ---------- prédio ainda não construído ----------
  r_predio(id) {
    const J = this.J, P = PREDIOS[id]; const lib = J.predioLiberado ? J.predioLiberado(id) : P.nivel <= J.S.nivel && (!P.requer || J.feita(P.requer));
    const motivo = P.nivel > J.S.nivel ? 'nivel' : lib ? (J.S.creditos >= (P.custo || 0) ? '' : 'creditos') : 'requer';
    return { icone: 'predio:' + id, titulo: P.nome, sub: lib ? 'Pronto para construir' : P.requer && !J.feita(P.requer) && P.nivel <= J.S.nivel ? 'Requer: ' + reqTxt(P.requer) : 'Libera no nível ' + P.nivel,
      corpo: `<p class="desc">${P.desc}</p><div class="linha acoes fixa"><button class="botao grande ouro ${motivo ? 'fraco' : ''}" data-a="construir" data-p="${id}">${img('grua')}${rot(motivo === 'creditos' ? 'Sem créditos' : motivo === 'nivel' ? `Libera no nível ${P.nivel}` : motivo === 'requer' ? 'Requer outra obra' : 'Construir', custoTx(P.custo || 0))}</button></div>` };
  }
  // ---------- almoxarifado ----------
  r_almox() {
    const J = this.J; const cap = J.capacidade, oc = J.ocupado; const p = oc / cap; const aba = this.aba.almox || 'bruto';
    const lista = Object.keys(ITENS).filter((k) => ITENS[k].tipo === aba && (J.S.itens[k] > 0 || aba === 'especial'));
    const VAZIO = { bruto: ['predio:usina1', 'Nenhuma matéria-prima guardada. As usinas produzem madeira, brita, aço e argila.'], produto: ['predio:carpintaria', 'Nenhum produto ainda. As oficinas fazem vigas, deques e treliças.'], especial: ['estrado', 'Estrados, etiquetas e cadeados caem ao coletar produção, ao subir de nível e em pedidos da comunidade.'] };
    const g = lista.length ? `<div class="grade">${lista.map((k) => this.ficha(k, { sub: '×' + (J.S.itens[k] || 0), data: ITENS[k].tipo !== 'especial' ? `data-a="produtor" data-k="${k}"` : '' })).join('')}</div>` : `<div class="cartao vazio">${img(VAZIO[aba][0])}<p>${VAZIO[aba][1]}</p></div>`;
    const req = J.pedidoAlmox(); const pode = Object.entries(req).every(([k, n]) => J.temItem(k, n)); const conf = this._conf('ampliarAlmox');
    return { icone: 'almox', titulo: 'Almoxarifado', sub: `${oc}/${cap} vagas · toque num item: quem produz`,
      corpo: `<div class="linha ocupacao"><div class="barra ${p >= 0.95 ? 'cheia' : p >= 0.8 ? 'alerta' : ''}"><i style="width:${Math.min(100, p * 100)}%"></i></div><b class="num">${Math.round(p * 100)}%</b><button class="botao mini-bt ${pode ? '' : 'fraco'} ${conf ? 'conf' : ''}" data-a="${pode ? 'ampliarAlmox' : 'fraco'}" data-motivo="falta" aria-label="Ampliar o Almoxarifado em ${this._passoAlmox()} vagas">${img('subir')} ${conf ? 'Confirmar' : `Ampliar (+${this._passoAlmox()} vagas)`}</button></div>
      <div class="linha etiqs para-ampliar"><small class="rotulo">Para ampliar</small>${this.chips(req)}</div>
      <div class="abas">${[['bruto', 'Matérias-primas'], ['produto', 'Produtos'], ['especial', 'Especiais']].map(([v, t]) => `<button class="${aba === v ? 'on' : ''}" data-a="aba" data-v="${v}">${t}</button>`).join('')}</div>${g}${depositoAberto(J.S) ? `<div class="linha acoes"><button class="botao sec" data-a="deposito">${img('troca')} Depósito de Trocas</button></div>` : ''}` };
  }
  // ---------- prancha da etapa ----------
  r_etapa(key) {
    const J = this.J, S = J.S; const [pid, eid] = key.split('.'); const p = PROJ[pid]; const e = p.etapas.find((x) => x.id === eid); const i = p.etapas.indexOf(e); const s = J.situacao(p, e); const st = J.etapa(key);
    const passos = `<div class="passos">${p.etapas.map((x, k) => `<i class="${J.feita(pid + '.' + x.id) ? 'f' : k === i ? 'a' : ''}"></i>`).join('')}</div>`;
    const desc = `<p class="desc">${p.nomeCurto ? `<span class="nome-longo">${p.nome}</span>` : ''}<b>${e.nome}.</b> ${e.desc}</p>`; let corpo = passos;
    const extras = []; if (e.servico) for (const [k, v] of Object.entries(e.servico)) extras.push(`<span class="etiq ok">${img(k)}+${fmt(v)} ${NOME_SERV[k].toLowerCase()}</span>`); if (e.bem) extras.push(`<span class="etiq ok">${img('bem')}+${e.bem}% bem-estar</span>`);
    if (extras.length) corpo += `<div class="linha etiqs">${extras.join('')}</div>`;
    const custo = J.custoEtapa ? J.custoEtapa(p, e) : e.custo, tempo = J.durEtapa ? J.durEtapa(p, e) : J.dur(e.t, 'obra');
    if (s === 'futura') corpo += `<p class="desc">Abre no capítulo ${J.capEtapa(p, e)}.</p>`;
    if (s === 'bloqueada') { const req = [...(i > 0 && !J.feita(pid + '.' + p.etapas[i - 1].id) ? [pid + '.' + p.etapas[i - 1].id] : []), ...(J.requerEtapa ? J.requerEtapa(p, e) : [...(p.requer || []), ...(e.requer || [])])].filter((r) => !J.feita(r)); corpo += `<p class="desc">Antes, conclua: ${[...new Set(req)].map(reqTxt).join(' · ')}</p>`; }
    const aceita = J.aceitaEntrega ? J.aceitaEntrega(p, e) : s === 'disponivel' || s === 'prancha';
    if (aceita && s !== 'obra' && s !== 'pronta' && s !== 'feita') {
      const req = J.itensEtapa ? J.itensEtapa(p, e) : { ...e.itens, ...(e.licencas || {}) }; let faltam = 0, posso = 0, podeTudo = true; const lic = [];
      const fichas = Object.entries(req).map(([k, n]) => {
        const ent = st.entregue?.[k] || 0; const tem = S.itens[k] || 0; const f = Math.max(0, n - ent); faltam += f; posso += Math.min(f, tem); const ok = ent >= n; const real = ent + tem < n; if (real) podeTudo = false;
        if (real && ITENS[k]?.grupo === 'licenca') lic.push([k, n - ent - tem]);
        const mais = this._mais && this._mais.key === key && this._mais.k === k && performance.now() - this._mais.t < 800 ? this._mais.n : 0;
        return this.ficha(k, { cls: 'redonda ' + (ok ? 'ok' : real ? 'falta' : ''), selo: ok ? 'ok' : real ? 'falta' : '', aro: (Math.min(1, ent / n) * 100).toFixed(0), tem: !ok && tem > 0 ? '×' + tem : null, sub: `${ent}/${n}`, mais, data: ok ? '' : tem > 0 ? `data-a="entregar" data-key="${key}" data-k="${k}"` : `data-a="produtor" data-k="${k}"` });
      }).join('');
      corpo += `<div class="grade">${fichas}</div>` + desc;
      // licença que falta: o topógrafo do Escritório faz uma por vez
      const tp = S.topografo;
      for (const [k, n] of lic) { const R = TOPOGRAFO?.[k]; if (!R) continue;
        if (tp?.k === k) corpo += `<div class="linha licenca fixo" data-ini="${tp.ini}" data-fim="${tp.fim}">${img(k)}<span class="tx">Topógrafo fazendo ${nomeIt(k)}</span><div class="barra"><i style="width:0"></i></div><b class="tt tempo"></b></div>`;
        else corpo += `<div class="linha licenca fixo">${img(k)}<span class="tx"><small>Falta ${n}</small>${nomeIt(k)}</span><button class="botao ouro ${tp ? 'fraco' : ''}" data-a="topografo" data-k="${k}">${tp ? `Topógrafo ocupado até ${hhmm(tp.fim)}` : `Encomendar ao topógrafo · ${fmt(R.creditos)}`}</button></div>`; }
      if (s === 'disponivel' || s === 'prancha') {
        // um botão de estado: verde "Iniciar obra" com tudo entregue ou em estoque; azul "Entregar N materiais" enquanto há o
        // que entregar; cinza com o motivo ("Faltam N materiais", "Sem créditos"); o custo (moeda e relógio) na segunda linha
        const caro = S.creditos < custo; let cls = '', verbo, ic = 'grua';
        if (podeTudo) { if (caro) { cls = 'fraco'; verbo = 'Sem créditos'; } else verbo = faltam ? 'Entregar e iniciar' : 'Iniciar obra'; }
        else if (posso > 0) { cls = 'azul'; verbo = `Entregar ${plural(posso, 'material', 'materiais')}`; ic = 'almox'; }
        else { cls = 'fraco'; verbo = `${faltam === 1 ? 'Falta' : 'Faltam'} ${plural(faltam, 'material', 'materiais')}`; ic = 'placa'; }
        corpo += `<div class="linha acoes fixa"><button class="botao grande ${cls}" data-a="entregarIniciar" data-key="${key}" aria-label="${verbo}. Custo: ${fmt(custo)} créditos e ${dur(tempo / 1000)}">${img(ic)}${rot(verbo, custoTx(custo, tempo))}</button></div>`;
      } else corpo += `<p class="desc">A prancha já aceita materiais: a obra abre no capítulo ${J.capEtapa(p, e)}.</p>`;
    } else if (s === 'obra') corpo += `<div class="linha" data-ini="${st.ini}" data-fim="${st.fim}"><div class="barra"><i style="width:0"></i></div><b class="tt tempo"></b></div><div class="linha acoes">${this.mutiraoBt({ etapa: key }, `Mutirão: adiantar ${REGRAS.mutiraoH} h`)}${this.aceleraBt({ etapa: key }, 'obra')}</div>`;
    else if (s === 'pronta') corpo += `<div class="linha acoes fixa"><button class="botao grande" data-a="aprovar" data-key="${key}">${img('ok')} Aprovar a etapa</button></div>`;
    else if (s === 'feita') { const nx = J.proximaEtapa(p); corpo += `<p class="desc">Etapa concluída.</p>${nx ? `<button class="botao sec" data-a="abrir" data-t="etapa" data-arg='"${pid}.${nx.e.id}"'>Próxima etapa: ${nx.e.nome}</button>` : ''}`; }
    if (!corpo.includes(desc)) corpo = corpo.replace(passos, () => passos + desc);
    return { icone: p.icone || 'obras', foto: p.foto, titulo: p.nomeCurto || p.nome, nome: p.nome, sub: `Etapa ${i + 1} de ${p.etapas.length} · ${e.nome}`, corpo };
  }
  // ---------- módulo ----------
  // barrinhas de serviço no topo do módulo: uso/capacidade de água, energia e saneamento (vermelho quando o pavimento
  // pedido não é atendido); o toque leva à obra que dá o serviço
  _servicosHtml(r) {
    const J = this.J; return `<div class="servicos">${['agua', 'energia', 'saneamento'].map((k) => { const si = J.servicoInfo ? J.servicoInfo(k) : { cap: J.serv[k] || 0, uso: J.pop }; const pede = r?.servicos?.includes(k); const alvo = pede ? r.popDepois : si.uso; const ok = pede ? si.cap >= r.popDepois : si.cap >= si.uso || !si.uso; const p = si.cap ? Math.min(1, alvo / si.cap) : alvo ? 1 : 0; const key = obraServico(J, k);
      return `<button class="serv ${ok ? 'ok' : 'nao'} ${pede ? 'pede' : ''}" ${key ? `data-a="ir" data-alvo='${JSON.stringify({ etapa: key })}'` : 'data-a="fraco" data-motivo="nada"'} aria-label="${NOME_SERV[k]}: ${fmt(alvo)} de ${fmt(si.cap)}${ok ? '' : ', falta'}">${img(k)}<b>${fmt(alvo)}/${fmt(si.cap)}</b><span class="barra"><i style="width:${(p * 100).toFixed(0)}%"></i></span></button>`; }).join('')}</div>`;
  }
  r_modulo([f, i]) {
    const J = this.J, M = MODULOS[f], m = J.S.modulos[f][i]; const s = J.situacaoModulo(f, i);
    const popAgora = Math.round(M.pop * POP_NIVEL[m.nivel]);
    const r0 = s === 'disponivel' ? J.requisitosModulo(f, i) : null;
    let corpo = this._servicosHtml(r0) + `<div class="passos">${Array.from({ length: M.max }, (_, k) => `<i class="${k < m.nivel ? 'f' : k === m.nivel ? 'a' : ''}"></i>`).join('')}</div><p class="desc">${M.nomeCurto ? `<span class="nome-longo">${M.nome}</span>` : ''}${M.sub}. Cada nível acrescenta um pavimento com terraço.</p>`;
    if (s === 'disponivel') {
      const r = r0; const temTudo = Object.entries(r.itens).every(([k, n]) => J.temItem(k, n));
      corpo += `<div class="grade">${Object.entries(r.itens).map(([k, n]) => this.ficha(k, { cls: J.temItem(k, n) ? 'ok' : 'falta', sub: `${J.S.itens[k] || 0}/${n}`, data: J.temItem(k, n) ? '' : `data-a="produtor" data-k="${k}"` })).join('')}</div>`;
      const et = [];
      if (r.bemMin) et.push(`<span class="etiq ${r.bemOk ? 'ok' : 'nao'}">${img('bem')}Bem-estar ${J.bem}% (mín. ${r.bemMin}%)</span>`);
      et.push(`<span class="etiq">${img('pop')}+${fmt(Math.round(M.pop * (POP_NIVEL[r.nivel] - POP_NIVEL[m.nivel])))} moradores</span>`);
      const caro = J.S.creditos < r.custo; const pode = temTudo && r.servOk && r.bemOk && !caro;
      // motivo do bloqueio em um cartão com "Ir" para quem resolve; o botão diz o motivo em uma ou duas palavras
      let motivo = '';
      if (!pode) {
        let ic, frase, ir, verbo;
        if (!temTudo) { const [k, n] = Object.entries(r.itens).find(([k, n]) => !J.temItem(k, n)); ic = k; frase = `Faltam materiais: ${n - (J.S.itens[k] || 0)} ${nomeIt(k)}`; ir = `data-a="produtor" data-k="${k}"`; verbo = 'Faltam materiais'; }
        else if (!r.servOk) { const k = (r.servicos || []).find((x) => (J.servicoInfo ? J.servicoInfo(x).cap : J.serv[x]) < r.popDepois) || 'agua'; const key = obraServico(J, k); ic = k; frase = `Falta ${NOME_SERV[k].toLowerCase()} para os novos moradores: conclua uma obra que dá ${NOME_SERV[k].toLowerCase()}`; ir = key ? `data-a="ir" data-alvo='${JSON.stringify({ etapa: key })}'` : ''; verbo = `Falta ${NOME_SERV[k].toLowerCase()}`; }
        else if (!r.bemOk) { const key = obraBem(J); ic = 'bem'; frase = `O último pavimento pede ${r.bemMin}% de bem-estar: praças, escola e verde ajudam`; ir = key ? `data-a="ir" data-alvo='${JSON.stringify({ etapa: key })}'` : `data-a="abrir" data-t="escritorio"`; verbo = 'Falta bem-estar'; }
        else { ic = 'creditos'; frase = `Faltam ${fmt(r.custo - J.S.creditos)} créditos: a renda dos moradores e os pedidos ajudam`; ir = `data-a="abrir" data-t="escritorio"`; verbo = 'Sem créditos'; }
        motivo = `<div class="cartao motivo">${img(ic)}<div class="tx">${frase}</div>${ir ? `<button class="botao azul" ${ir}>Ir</button>` : ''}</div>`; this._verboMod = verbo;
      }
      corpo = corpo.replace('<div class="passos">', () => motivo + '<div class="passos">');
      corpo += `<div class="linha etiqs">${et.join('')}</div><div class="linha acoes fixa"><button class="botao grande ${pode ? '' : 'fraco'}" data-a="melhorar" data-f="${f}" data-i="${i}" aria-label="${pode ? (m.nivel ? 'Subir ao nível ' + r.nivel : 'Construir') : this._verboMod}. Custo: ${fmt(r.custo)} créditos e ${dur(J.dur(r.tempo, 'modulo') / 1000)}">${img('subir')}${rot(pode ? (m.nivel ? 'Subir ao nível ' + r.nivel : 'Construir') : this._verboMod, custoTx(r.custo, J.dur(r.tempo, 'modulo')))}</button></div>`;
    } else if (s === 'limite') { const L = LIMITE_CAP[f]; let prox = ''; for (const [c, n] of Object.entries(L || {})) if (n > m.nivel && !prox) prox = c; corpo += `<p class="desc">Nível máximo por enquanto. O próximo pavimento abre no capítulo ${prox}.</p>`; }
    else if (s === 'bloqueado') corpo += `<p class="desc">${M.cap > J.S.cap ? 'Abre no capítulo ' + M.cap + '.' : f === 'anel' && J.S.cap === 1 ? 'Este lote abre no capítulo 2.' : 'Antes, conclua: ' + (M.requer || []).map(reqTxt).join(' · ')}</p>`;
    else if (s === 'obra') corpo += `<div class="linha" data-ini="${m.obra.ini}" data-fim="${m.obra.fim}"><div class="barra"><i style="width:0"></i></div><b class="tt tempo"></b></div><div class="linha acoes">${this.mutiraoBt({ modulo: [f, i] }, `Mutirão: adiantar ${REGRAS.mutiraoH} h`)}${this.aceleraBt({ modulo: [f, i] }, 'obra')}</div>`;
    else if (s === 'pronta') corpo += `<div class="linha acoes fixa"><button class="botao grande" data-a="aprovarMod" data-f="${f}" data-i="${i}">${img('ok')} Aprovar o pavimento</button></div>`;
    else if (s === 'max') corpo += `<p class="desc">Módulo completo, igual ao projeto.</p>`;
    return { icone: 'modulo', foto: M.foto, titulo: `${M.nomeCurto || M.nome} · módulo ${i + 1}`, nome: `${M.nome}, módulo ${i + 1}`, sub: `Nível ${m.nivel} de ${M.max} · ${fmt(popAgora)} moradores`, corpo };
  }
  // ---------- lista de obras (o que pede ação primeiro) ----------
  // três estados com verbo e cor: pronta para aprovar (verde, check), pronta para iniciar (verde), faltam N materiais
  // (laranja, com os ícones do que falta), em obra (azul, cronômetro), aguardando outra obra (cinza, cadeado), futura e
  // concluída. Cartão de 64 px: ícone num círculo na cor do estado com o progresso das etapas em anel fino.
  r_obras() {
    const J = this.J, S = J.S; const itens = []; const ORD = { pronta: 0, 'pronta-ini': 1, falta: 2, obra: 3, bloq: 4, futura: 5, fim: 6 };
    const card = (o) => `<button class="item-lista st-${o.cls}" data-a="ir" data-alvo='${o.alvo}' ${o.extra || ''} aria-label="${o.nome}: ${o.stTx || o.st}"><span class="anel-ic" style="--p:${o.p.toFixed(0)}%">${img(o.icone)}${o.cls === 'bloq' || o.cls === 'futura' ? img('cadeado', 'cad') : ''}</span><div class="tx"><b>${o.curto}</b><small class="st">${o.cls === 'pronta' ? img('check') : ''}${o.st}</small><small class="cont">${o.cont}</small>${o.minis || ''}</div></button>`;
    for (const p of PROJETOS) {
      if (p.cap > S.cap) continue; const nx = J.proximaEtapa(p); const s = nx ? nx.s : 'fim'; let st, cls, minis = '', extra = '', stTx = '';
      const feitas = p.etapas.filter((e) => J.feita(p.id + '.' + e.id)).length; const key = `${p.id}.${(nx ? nx.e : p.etapas[p.etapas.length - 1]).id}`;
      if (!nx) { st = 'Concluída'; cls = 'fim'; } else if (s === 'pronta') { st = 'Pronta para aprovar'; cls = 'pronta'; }
      else if (s === 'obra') { const e = J.etapa(key); st = `Em obra: <span class="tt">${dur((e.fim - J.agora) / 1000)}</span>`; stTx = 'Em obra'; cls = 'obra'; extra = `data-ini="${e.ini}" data-fim="${e.fim}"`; }
      else if (s === 'futura') { st = 'Abre no capítulo ' + J.capEtapa(p, nx.e); cls = 'futura'; } else if (s === 'bloqueada') { st = 'Aguardando outra obra'; cls = 'bloq'; }
      else { const req = J.itensEtapa ? J.itensEtapa(p, nx.e) : { ...nx.e.itens, ...(nx.e.licencas || {}) }; const ent = J.etapa(key).entregue || {}; const faltas = []; let n = 0; for (const [k, q] of Object.entries(req)) { const f = q - (ent[k] || 0) - (S.itens[k] || 0); if (f > 0) { n += f; faltas.push(k); } }
        if (!n) { st = 'Pronta para iniciar'; cls = 'pronta-ini'; } else { st = `${n === 1 ? 'Falta' : 'Faltam'} ${plural(n, 'material', 'materiais')}`; cls = 'falta'; minis = `<span class="minis">${faltas.slice(0, 3).map((k) => `<span class="mini nao" title="${nomeIt(k)}">${img(k)}</span>`).join('')}</span>`; } }
      itens.push([ORD[cls], card({ cls, icone: p.icone || 'obras', curto: p.nomeCurto || p.nome, nome: p.nome, st, stTx, cont: `${feitas}/${p.etapas.length} etapas${nx ? ' · ' + nx.e.nome : ''}`, p: (feitas / p.etapas.length) * 100, alvo: JSON.stringify({ etapa: key }), minis, extra })]);
    }
    itens.sort((a, b) => a[0] - b[0]);
    const mods = Object.entries(MODULOS).filter(([, M]) => M.cap <= S.cap).map(([f, M]) => {
      const arr = S.modulos[f]; const sits = arr.map((m, k) => J.situacaoModulo(f, k)); let i = -1; for (const x of ['pronta', 'disponivel', 'obra']) if (i < 0) i = sits.indexOf(x); if (i < 0) i = 0;
      const soma = arr.reduce((a, m) => a + m.nivel, 0), tot = arr.length * M.max; let cls, st;
      if (sits.includes('pronta')) { cls = 'pronta'; st = 'Pavimento pronto para aprovar'; } else if (sits.includes('obra')) { cls = 'obra'; st = 'Pavimento em obra'; }
      else if (sits.includes('disponivel')) { const r = J.requisitosModulo(f, i); const temTudo = Object.entries(r.itens).every(([k, n]) => J.temItem(k, n)); if (temTudo && r.servOk && r.bemOk && S.creditos >= r.custo) { cls = 'pronta-ini'; st = soma ? 'Pronto para subir' : 'Pronto para construir'; } else { cls = 'falta'; st = !temTudo ? 'Faltam materiais' : !r.servOk ? 'Faltam serviços' : !r.bemOk ? 'Falta bem-estar' : 'Faltam créditos'; } }
      else if (soma >= tot) { cls = 'fim'; st = 'Completo'; } else { cls = 'bloq'; st = 'Aguardando outra obra'; }
      return [ORD[cls], card({ cls, icone: 'modulo', curto: M.nomeCurto || M.nome, nome: M.nome, st, cont: `${soma}/${tot} pavimentos em ${arr.length} módulos`, p: (soma / tot) * 100, alvo: JSON.stringify({ modulo: [f, i] }) })];
    }).sort((a, b) => a[0] - b[0]);
    const v = J.vida(); const pv = v <= 0 ? '0%' : v.toLocaleString('pt-BR', { maximumFractionDigits: v < 10 ? 1 : 0, minimumFractionDigits: v < 10 ? 1 : 0 }) + '%';
    return { icone: 'obras', titulo: 'Obras da composição', sub: `Capítulo ${S.cap} · ${pv} da composição total`, corpo: `<div class="lista">${itens.map((x) => x[1]).join('')}</div>${titulo('Módulos')}<div class="lista">${mods.map((x) => x[1]).join('')}</div>` };
  }
  // ---------- produção (atalhos, com as vagas e a coleta na linha) ----------
  // linha em produção diz quando sai o próximo lote (o tick atualiza); parada em laranja com o verbo Produzir; bloqueada
  // em cinza com cadeado e o nível que libera; pronta (Almoxarifado cheio) em verde com Coletar
  r_producao() {
    const J = this.J, S = J.S; const lin = [...USINAS, ...OFICINAS].map((id) => {
      const P = PREDIOS[id], st = S.predios[id]; let txt, minis = '', bt = '', cls = '', extra = '', cad = '';
      if (!st.ok) { const lib = J.predioLiberado ? J.predioLiberado(id) : P.nivel <= S.nivel; txt = P.nivel > S.nivel ? 'Libera no nível ' + P.nivel : !lib && P.requer ? 'Requer: ' + reqTxt(P.requer) : `Construir por ${fmt(P.custo || 0)} créditos`; cls = lib ? 'st-construir' : 'st-bloq'; if (!lib) cad = img('cadeado', 'cad'); else bt = '<span class="verbo-chip ouro">Construir</span>'; }
      else if (P.tipo === 'usina') {
        const pr = J.prontosUsina(id).length; const rod = st.slots.filter((s) => s && s.fim > J.agora); const uso = st.slots.filter(Boolean).length;
        if (pr) { txt = `${plural(pr, 'lote pronto', 'lotes prontos')}: Almoxarifado cheio`; cls = 'st-pronta'; bt = `<button class="botao mini-bt" data-a="coletarU" data-p="${id}" data-i="-1">Coletar</button>`; }
        else if (rod.length) { const sp = rod.reduce((a, s) => (s.fim < a.fim ? s : a)); txt = `${uso}/${st.nSlots} produzindo · próximo em <span class="tt">${durCurta((sp.fim - J.agora) / 1000)}</span>`; cls = 'st-obra'; extra = `data-ini="${sp.ini}" data-fim="${sp.fim}"`; }
        else if (P.pedidos) { txt = 'Parada: espera um pedido com "Fabricar"'; cls = 'st-disp'; }
        else { txt = 'Parada'; cls = 'st-disp'; bt = '<span class="verbo-chip">Produzir</span>'; }
        minis = st.slots.slice(0, st.nSlots).map((s) => (s ? `<span class="mini ${s.fim <= J.agora ? 'ok' : ''} ${s.auto ? 'auto' : ''}">${img(s.item)}${(s.n ?? 1) > 1 ? `<i>${s.n}</i>` : ''}</span>` : '<span class="mini vazio"></span>')).join('');
      } else {
        const n = st.prontos.length; const f0 = st.fila[0]; const rodando = f0 && f0.fim && f0.fim > J.agora;
        if (n) { txt = `${plural(n, 'item pronto', 'itens prontos')}: Almoxarifado cheio`; cls = 'st-pronta'; bt = `<button class="botao mini-bt" data-a="coletarO" data-p="${id}">Coletar</button>`; }
        else if (rodando) { txt = `${st.fila.length}/${J.vagasFila?.(id) ?? st.nFila} na fila · próximo em <span class="tt">${durCurta((f0.fim - J.agora) / 1000)}</span>`; cls = 'st-obra'; extra = `data-ini="${f0.ini}" data-fim="${f0.fim}"`; }
        else if (st.fila.length) { txt = `${st.fila.length}/${J.vagasFila?.(id) ?? st.nFila} na fila · esperando insumos`; cls = 'st-obra'; }
        else { txt = 'Parada'; cls = 'st-disp'; bt = '<span class="verbo-chip">Produzir</span>'; }
        minis = [...st.prontos.slice(0, 3).map((k) => `<span class="mini ok">${img(k)}</span>`), ...st.fila.slice(0, 6 - Math.min(3, n)).map((f) => `<span class="mini">${img(f.item)}${(f.n ?? 1) > 1 ? `<i>${f.n}</i>` : ''}</span>`)].join('');
      }
      return `<div class="item-lista ${cls} ${st.ok ? '' : 'bloq'}" role="button" data-a="ir" data-alvo='{"predio":"${id}"}' ${extra}><span class="anel-ic">${img('predio:' + id)}${cad}</span><div class="tx"><b>${P.nome}</b><small class="st">${txt}</small>${minis ? `<div class="minis">${minis}</div>` : ''}</div>${bt}</div>`;
    });
    return { icone: 'producao', titulo: 'Produção', sub: 'Usinas e oficinas do canteiro', corpo: `<div class="lista">${lin.join('')}</div>` };
  }
  // ---------- pedidos (grade de cartões com rosto) ----------
  r_pedidos() {
    const J = this.J, S = J.S; const capP = REGRAS.capPedidos ?? 2;
    if (S.cap < capP) return { icone: 'pedidos', titulo: 'Pedidos da comunidade', sub: `Libera no capítulo ${capP}`, corpo: '<p class="desc">Vizinhos, cooperativas e escolas vão pedir materiais em troca de licenças, itens especiais, bem-estar e disposição.</p>' };
    const fp = this._faltaPed && performance.now() - this._faltaPed.t < 8000 ? this._faltaPed : null; const treme = fp && performance.now() - fp.t < 300;
    const cards = S.pedidos.map((p, i) => {
      if (!p.itens) return `<div class="pedido espera" data-ini="${this._iniPedido(p)}" data-fim="${p.espera}"><b>Novo pedido chegando</b><div class="linha"><div class="barra"><i style="width:0"></i></div><small class="tt"></small></div></div>`;
      const ok = Object.entries(p.itens).every(([k, n]) => J.temItem(k, n)); const R = p.recompensa || { creditos: p.creditos || 0, xp: p.xp || 0, itens: p.especial ? { [p.especial]: 1 } : null };
      const its = Object.entries(p.itens).map(([k, n]) => { const t = S.itens[k] || 0; const tem = t >= n; return `<span class="it ${tem ? 'tem' : 'precisa'} ${!tem && treme && fp.i === i ? 'treme' : ''}" title="${nomeIt(k)}">${img(k)}<i>${Math.min(t, n)}/${n}</i></span>`; }).join('');
      const rec = [R.creditos ? `<span>${img('creditos')}${fmt(R.creditos)}</span>` : '', R.xp ? `<span>${img('xp')}${R.xp}</span>` : '', ...Object.entries(R.itens || {}).map(([k, n]) => `<span title="${nomeIt(k)}">${img(k)}${n > 1 ? n : ''}</span>`), R.bem ? `<span>${img('bem')}+${R.bem.n}%</span>` : '', R.disposicao ? `<span>${img('disposicao')}+${R.disposicao}</span>` : ''].join('');
      const conf = this._lixo?.i === i; const ini = (p.quem || '?').trim()[0]; const sel = fp?.i === i || this._resumo?.i === i;
      // "Fabricar na Usina de Pedidos": só quando a simulação tem a usina de pedidos e o pedido ainda não está completo
      const fab = !ok && typeof J.fabricarPedido === 'function' ? (p.auto ? `<button class="fab on" data-a="pararPedido" data-i="${i}" aria-label="Fabricando na Usina de Pedidos: toque para parar">${img('predio:usina2')}<span>Fabricando… · Parar</span></button>` : `<button class="fab" data-a="fabricarPedido" data-i="${i}">${img('predio:usina2')}<span>Fabricar na Usina de Pedidos</span></button>`) : '';
      return `<div class="pedido ${ok ? 'pronto' : 'fraco'} ${sel ? 'sel' : ''} ${p.auto ? 'fabricando' : ''}" role="button" data-a="pedido" data-i="${i}" aria-label="${ok ? 'Entregar' : 'Ver'} pedido de ${p.quem || 'moradores'}">
        <div class="pq"><div class="retrato mini" style="background:radial-gradient(circle at 35% 30%,#fff,${p.cor || '#9ad7fb'})">${ini}</div><div class="quem"><b>${p.quem || 'Moradores'}</b>${p.onde ? `<small>${p.onde}</small>` : ''}</div></div>
        <button class="lixo ${conf ? 'conf' : ''}" data-a="descartar" data-i="${i}" aria-label="${conf ? 'Tocar de novo para descartar' : 'Descartar pedido'}">${conf ? '<span>Descartar?</span>' : img('lixo')}</button>
        ${p.fala ? `<p class="fala" title="${p.fala}">${p.fala}</p>` : ''}<div class="pl"><div class="its">${its}</div><div class="rec">${rec}</div></div>${fab}</div>`;
    });
    const faltaHtml = fp ? `<div class="cartao aviso-falta fixo">${img(fp.falta[0][0])}<div class="tx">Falta: <b>${fp.falta.map(([k, n]) => `${n} ${nomeIt(k)}`).join(', ')}</b></div><button class="botao azul" data-a="produtor" data-k="${fp.falta[0][0]}">Produzir</button></div>` : '';
    // resumo do pedido completo escolhido: o que entrega e o que rende, com a lixeira e o botão Entregar (fica no rodapé)
    const rp = this._resumo && S.pedidos[this._resumo.i]?.itens ? S.pedidos[this._resumo.i] : null; const ri = this._resumo?.i;
    const resumo = rp ? `<div class="cartao resumo"><button class="lixo ${this._lixo?.i === ri ? 'conf' : ''}" data-a="descartar" data-i="${ri}" aria-label="${this._lixo?.i === ri ? 'Tocar de novo para descartar' : 'Descartar pedido'}">${this._lixo?.i === ri ? '<span>Descartar?</span>' : img('lixo')}</button><div class="tx"><b>Entregar ${Object.entries(rp.itens).map(([k, n]) => `${n} ${nomeIt(k)}`).join(' e ')}</b><small>por ${this._ganhosPedido(rp)}</small></div><button class="botao" data-a="entregarPedido" data-i="${ri}">${img('check')} Entregar</button></div>` : '';
    // cabeçalho: totais por item de todos os pedidos abertos (e quanto falta no Almoxarifado)
    const T = J.pedidosTotais?.() || null; const ent = T ? Object.entries(T).filter(([k, t]) => ITENS[k] && t?.n > 0) : [];
    const totais = ent.length ? `<div class="totais"><small>Total pedido</small>${ent.map(([k, t]) => `<span class="etiq ${t.falta > 0 ? 'nao' : 'ok'}" title="${nomeIt(k)}">${img(k)}${t.n}${t.falta > 0 ? `<small>falta ${t.falta}</small>` : ''}</span>`).join('')}</div>` : '';
    const nFab = S.pedidos.filter((p) => p?.itens && p.auto).length;
    return { icone: 'pedidos', titulo: 'Pedidos da comunidade', sub: nFab ? `${nFab} em fabricação na Usina de Pedidos · toque num cartão para entregar` : 'Toque num cartão para entregar', corpo: `${totais}<div class="pedidos">${cards.join('')}</div>${faltaHtml}${resumo}` };
  }
  // ---------- depósito ----------
  r_deposito() {
    const J = this.J; const aba = this.aba.deposito || 'comprar'; const est = (k) => (J.estoqueDeposito ? J.estoqueDeposito(k) : { n: 99, preco: J.precoCompra(k) });
    const rn = this._renovaDeposito(); const renova = rn ? ` às ${hhmm(rn)}` : ' em breve';
    let g;
    if (aba === 'comprar') g = BRUTOS.filter((k) => J.liberado(k)).map((k) => { const e = est(k); const conf = this._conf('comprar|' + k); return this.ficha(k, { cls: (e.n > 0 ? '' : 'bloq') + (conf ? ' conf' : ''), cad: e.n > 0 ? '' : 'Esgotado', tem: e.n > 0 ? `${e.n} un.` : null, sub: conf ? 'Confirmar?' : `${fmt(e.preco)} créditos`, data: e.n > 0 ? `data-a="comprar" data-k="${k}"` : `data-a="fraco" data-motivo="esgotado"` }); }).join('');
    else g = Object.keys(ITENS).filter((k) => ITENS[k].tipo !== 'especial' && J.S.itens[k] > 0).map((k) => this.ficha(k, { cls: 'venda', sub: `+${fmt(J.precoVenda(k))}`, tem: '×' + J.S.itens[k], data: `data-a="vender" data-k="${k}"` })).join('') || '<p class="desc">Nada para vender.</p>';
    const vd = J.vendasDeposito ? J.vendasDeposito() : null; const vendas150 = this.nova; // na economia nova, vender rende 150% do preço de compra
    const rod = aba === 'comprar' ? `Estoque de cada matéria-prima renova${renova}; o preço sobe a cada compra.` : vd ? `Cada venda rende o preço mostrado na ficha${vendas150 ? ' (150% do preço de compra)' : ''}. A janela renova${renova}.` : '';
    const cabVenda = aba === 'vender' && vd ? `<div class="linha etiqs vendas"><span class="etiq ${vd.feitas >= vd.max ? 'nao' : ''}">${img('troca')}Vendas ${vd.feitas}/${vd.max} nesta janela</span>${vendas150 ? `<span class="etiq ok">${img('creditos')}Venda a 150% da compra</span>` : ''}</div>` : '';
    return { icone: 'troca', titulo: 'Depósito de Trocas', sub: aba === 'vender' && vd ? `Vendas ${vd.feitas}/${vd.max} nesta janela · preço de venda em destaque` : 'Compre matéria-prima ou venda o que sobrou', corpo: `<div class="abas">${[['comprar', 'Comprar'], ['vender', 'Vender']].map(([v, t]) => `<button class="${aba === v ? 'on' : ''}" data-a="aba" data-v="${v}">${t}</button>`).join('')}</div>${cabVenda}<div class="grade">${g}</div><p class="desc" style="margin-top:8px">${rod}</p>` };
  }
  // ---------- escritório / sede: repasses, serviços, bem-estar e topógrafo ----------
  // duas abas: Finanças (calendário, valuation, renda e cofre, empréstimo) e Obra (serviços, bem-estar, topógrafo).
  // Um destaque pedido para o topógrafo abre na aba Obra.
  r_escritorio() {
    const J = this.J; const sede = J.feita('sede.e2'); const aba = /topografo|serv/.test(this.destaque || '') ? 'obra' : this.aba.escritorio || 'financas';
    const abas = `<div class="abas">${[['financas', 'Finanças'], ['obra', 'Obra e serviços']].map(([v, t]) => `<button class="${aba === v ? 'on' : ''}" data-a="aba" data-v="${v}">${t}</button>`).join('')}</div>`;
    const val = J.valuation?.(); const E = J.emprestimoInfo?.();
    const sub = val ? `Valuation ${fmt(val.total)} · renda +${fmt(rendaHoraDe(J))}/h${E?.divida > 0 ? ` · dívida ${fmt(E.divida)}` : ''}` : `Repasses: ${fmt(rendaHoraDe(J))} créditos por hora · bem-estar ${J.bem}%`;
    return { icone: sede ? 'sede' : 'repasse', titulo: sede ? 'Sede da Holding Guarda-Chuva' : 'Escritório de Obra', sub, corpo: abas + (aba === 'obra' ? this._obraServicos() : this._financas()) };
  }
  _obraServicos() {
    const J = this.J, S = J.S;
    const serv = ['agua', 'energia', 'saneamento'].map((k) => { const si = J.servicoInfo ? J.servicoInfo(k) : { cap: J.serv[k], uso: J.pop }; const c = si.cap, d = si.uso; const p = c ? Math.min(1, d / c) : d ? 1 : 0; return `<div class="linha serv">${img(k)}<b>${NOME_SERV[k]}</b><div class="barra ${d > c ? 'cheia' : p > 0.85 ? 'alerta' : ''}"><i style="width:${(p * 100).toFixed(0)}%"></i></div><small class="num">${!c && !d ? 'sem demanda' : `${fmt(d)}/${fmt(c)}`}</small></div>`; }).join('');
    const bi = J.bemInfo ? J.bemInfo() : null;
    const bem = bi ? `<div class="linha etiqs"><span class="etiq">${img('bem')}Base ${bi.base}%</span>${bi.fontes.slice(0, 3).map((f) => `<span class="etiq ok">+${f.v}% ${f.txt}</span>`).join('')}${bi.pressao ? `<span class="etiq nao">−${bi.pressao}% moradia</span>` : ''}</div>` : '';
    const tp = S.topografo;
    const topo = TOPOGRAFO ? Object.entries(TOPOGRAFO).map(([k, R]) => {
      if (tp?.k === k) return `<div class="linha licenca" data-ini="${tp.ini}" data-fim="${tp.fim}">${img(k)}<span class="tx">${nomeIt(k)}</span><div class="barra"><i style="width:0"></i></div><b class="tt tempo"></b></div>`;
      const custo = `${Object.entries(R.itens).map(([i, n]) => `${n} ${nomeIt(i)}`).join(', ')} + ${fmt(R.creditos)} · ${R.min} min`;
      return `<div class="linha licenca">${img(k)}<span class="tx"><b>${nomeIt(k)}</b><small>${custo}</small></span><button class="botao ouro ${tp ? 'fraco' : ''}" data-a="topografo" data-k="${k}">${tp ? 'Ocupado' : 'Encomendar'}</button></div>`;
    }).join('') : '';
    return `${titulo('Serviços')}${serv}${bi ? titulo(`Bem-estar ${bi.total}%`) + bem : ''}${topo ? titulo('Topógrafo: uma licença por vez') + topo : ''}`;
  }
  // Finanças: calendário, valuation (número grande, detalhamento e recorde), renda dos moradores com o cofre e a regra
  // offline, e o empréstimo (tomar em passos de 1.000; dívida, juros, pagar só os juros, parcela + juros, quitar; contratos)
  _financas() {
    const J = this.J, S = J.S; const cal = calendarioDe(J); const E0 = EMP();
    const calHtml = `<div class="linha etiqs calend"><span class="etiq">${img('calendario')}Dia ${cal.diaDoMes} · Mês ${cal.mes} · Ano ${cal.ano}</span><small class="desc-linha">1 dia = ${Math.round((cal.diaMs || 20000) / 1000)} s · mês de 30 dias · ano de 12 meses</small></div>`;
    // valuation
    const val = J.valuation?.(); const vmax = Math.max(S.valuationMax || 0, val?.total || 0);
    const valHtml = val ? `<div class="cartao fin valor"><div class="cab">${img('valuation')}<div class="tx"><small>Valuation da construção</small><b class="grande">${numEx(val.total)}</b><small class="rec">${img('trofeu')}Recorde: ${numEx(vmax)}</small></div></div><ul class="det">${Object.entries(val.partes || {}).map(([k, v]) => `<li><span>${NOME_VAL[k] || k}</span><b class="${v < 0 ? 'neg' : ''}">${numEx(v)}</b></li>`).join('')}</ul></div>`
      : `<div class="cartao fin valor"><div class="cab">${img('valuation')}<div class="tx"><small>Valuation da construção</small><b class="grande">—</b><small class="rec">Sobe sozinho conforme a obra avança</small></div></div></div>`;
    // renda dos moradores e cofre
    const ri = J.rendaInfo?.(); const rh = rendaHoraDe(J); const r = S.repasse; const cofreMax = ri?.cofreMax ?? (J.taxaRepasse?.() || 0) * 60 * REGRAS.cofreH; const acum = ri?.cofre ?? r.acum;
    const faixa = ri ? `<span class="etiq">${img('bem')}Bem-estar ${ri.faixa}%: ${ri.tarifa} por morador</span>` : '';
    const rendaHtml = `<div class="cartao fin renda"><div class="cab">${img('pop')}<div class="tx"><small>Renda dos moradores</small><b class="grande">+${numEx(rh)}<em>/h</em></b><small class="rec">${fmt(J.pop)} moradores${ri ? ` × ${ri.tarifa} por hora` : ''}</small></div></div>${faixa ? `<div class="linha etiqs">${faixa}</div>` : ''}
      <div class="linha cofre"><span class="etiq">${img('repasse')}Cofre: <b class="cred">${numEx(acum)}</b></span><div class="barra"><i style="width:${cofreMax > 0 ? Math.min(100, (acum / cofreMax) * 100).toFixed(0) : 0}%"></i></div><button class="botao ${r.acum >= 1 ? '' : 'fraco'}" data-a="${r.acum >= 1 ? 'repasse' : 'fraco'}" data-motivo="nada">${img('creditos')} Coletar</button></div>
      <p class="desc">O cofre guarda até ${ri?.cofreH ?? REGRAS.cofreH} h de renda.${ri ? ` Com o jogo fechado, rende ${pctTx(ri.offlineFator)} por até ${ri.offlineH} h.` : ''}${ri ? ' Faixas: até 30% de bem-estar, 5 por morador; 31 a 60%, 8; 61 a 100%, 11.' : ''}</p></div>`;
    // empréstimo
    const E = J.emprestimoInfo?.() ?? { principal: 0, juros: 0, divida: 0, disponivelAno: E0.ano, limiteAno: E0.ano, limiteDivida: E0.max, taxaAno: E0.taxa, parcela: 0, contratos: [], jurosPorDia: 0 };
    const v = J.emprestimoInfo ? this._empValor() : 0; const podeTomar = v > 0;
    const contratos = (E.contratos || []).length ? `<div class="contratos">${E.contratos.map((c) => { const f = this._calEm(c.fim); return `<div class="contrato ${c.vencido ? 'vencido' : ''}">${img('emprestimo')}<span class="tx"><b>Ano ${c.ano}: ${numEx(c.valor)}</b><small>saldo ${numEx(c.saldo)} · ${c.vencido ? `vencido: juros de mora (${pctTx(E0.mora)} ao ano)` : `vence em ${f.diaDoMes}/${f.mes} do ano ${f.ano}`}</small></span>${c.vencido ? '<span class="etiq nao">Vencido</span>' : ''}</div>`; }).join('')}</div>` : '';
    const divida = E.divida > 0 ? `<ul class="det divida"><li><span>Principal</span><b>${numEx(E.principal)}</b></li><li><span>Juros devidos</span><b>${numEx(E.juros)}</b></li><li class="tot"><span>Dívida total</span><b>${numEx(E.divida)}</b></li><li><span>Juros por dia do jogo</span><b>+${numEx(E.jurosPorDia)}</b></li></ul>
      <div class="linha pagar"><button class="botao azul ${E.juros >= 1 ? '' : 'fraco'}" data-a="pagarJuros">Pagar só os juros · ${numEx(E.juros)}</button><button class="botao ${E.principal > 0 ? '' : 'fraco'}" data-a="pagarParcela">Pagar parcela + juros · ${numEx((E.parcela || 0) + E.juros)}</button><button class="botao sec" data-a="quitar">Quitar · ${numEx(E.divida)}</button></div>${titulo('Contratos')}${contratos}` : '<p class="desc">Sem dívida. Um empréstimo vira créditos na hora; os juros correm por dia do jogo sobre o principal.</p>';
    const empHtml = `<div class="cartao fin emp"><div class="cab">${img('emprestimo')}<div class="tx"><small>Empréstimo</small><b class="grande">${E.divida > 0 ? numEx(E.divida) : 'sem dívida'}</b><small class="rec">Neste ano: ${numEx(E.limiteAno - E.disponivelAno)} de ${numEx(E.limiteAno)} tomados</small></div></div>
      <div class="linha tomar"><span class="passo grande" aria-label="Valor do empréstimo"><button class="pm" data-a="empMenos" aria-label="Menos 1.000">−</button><b class="n">${numEx(v)}</b><button class="pm" data-a="empMais" aria-label="Mais 1.000">+</button></span><button class="botao ouro ${podeTomar ? '' : 'fraco'}" data-a="emprestar" data-v="${v}">${img('creditos')} Pegar empréstimo</button></div>
      <p class="desc">Taxa de ${pctTx(E.taxaAno)} ao ano do jogo sobre o principal · até ${numEx(E.limiteAno)} por ano · dívida máxima ${numEx(E.limiteDivida)} · prazo de ${E0.prazo} anos (depois, mora de ${pctTx(E0.mora)}).</p>${divida}</div>`;
    // sem moradores ainda: o Escritório explica de onde vem a renda e leva ao primeiro módulo do Anel
    const vazio = !J.pop ? `<div class="cartao vazio motivo">${img('modulo')}<div class="tx">Sem moradores ainda. Construa o primeiro módulo do Anel: a renda e o valuation nascem deles.</div><button class="botao azul" data-a="ir" data-alvo='{"modulo":["anel",0]}'>Ir</button></div>` : '';
    return calHtml + vazio + valHtml + rendaHtml + empHtml;
  }
  // data do calendário do jogo para um instante (o vencimento de um contrato)
  _calEm(t) { const S = this.J.S; const ini = S.calendario?.inicio ?? S.criado ?? this.J.agora; const dia = Math.max(0, Math.floor((t - ini) / (calendarioDe(this.J).diaMs || 20000))); return { diaDoMes: (dia % 30) + 1, mes: (Math.floor(dia / 30) % 12) + 1, ano: Math.floor(dia / 360) + 1 }; }
}
