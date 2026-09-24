// HUD: barra superior (nível, vida da composição, moradores, bem-estar, créditos, Mutirão com a barra de
// disposição, Apreciar e Configurações), pílula do capítulo com as metas tocáveis, linha "Agora" (Meta em foco),
// fala do conselho numa doca no alto (fora do trilho, visível com painel aberto), avisos empilhados, trilho
// direito, anel-guia do tutorial, voo de ícones com contagem dos números e o botão "Próximo".
import { el, fmt, clamp, easeOutCubic, easeInCubic } from '../core/util.js';
import { img, icone } from './icones.js';
import { CONSELHO } from '../data/historia.js';
import { XP_NIVEL } from '../data/itens.js';
import { REGRAS } from '../sim/estado.js';

const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
const retrato = (q, cls = '') => { const c = CONSELHO[q] || CONSELHO.iris; return `<div class="retrato ${cls}" style="background:radial-gradient(circle at 35% 30%,#fff,${c.cor})">${c.ini}</div>`; };
const pct = (v) => (v <= 0 ? '0%' : v.toLocaleString('pt-BR', { minimumFractionDigits: v < 10 ? 1 : 0, maximumFractionDigits: v < 10 ? 1 : 0 }) + '%');
const nivelDe = (xp, max) => { let n = 1; while (n < max && xp >= XP_NIVEL[n + 1]) n++; return n; };
export { retrato };
// quando partes da interface aparecem (regras só da interface: a simulação não fecha o Depósito; as dela vêm de REGRAS)
export const ABRE = { trocasCap: 2, depositoNivel: 3 };
export const depositoAberto = (S) => S.nivel >= ABRE.depositoNivel || S.cap >= ABRE.trocasCap;

export class Hud {
  constructor(raiz, J) {
    this.J = J; this.raiz = raiz;
    this.topo = el('div', 'topo');
    this.topo.innerHTML = `
      <div class="nivel" data-a="nivel" role="button" aria-label="Nível e experiência"><div class="anel"><b>1</b></div><div class="info"><b class="nome">Nível 1</b><small class="xp">0 / 40 XP</small></div></div>
      <div class="stat vida" data-a="vida" role="button" aria-label="Composição concluída">${img('vida')}<span class="vv">0%</span><div class="trilho"><i></i></div></div>
      <div class="stat" data-a="pop" role="button" aria-label="Moradores">${img('pop')}<span class="pp">0</span></div>
      <div class="stat" data-a="bem" role="button" aria-label="Bem-estar">${img('bem')}<span class="bb">35%</span></div>
      <button class="pilula aguarda oculto" data-a="conselho">${img('sede')}<span>Conselho aguarda</span></button>
      <div class="esp"></div>
      <div class="stat" data-a="creditos" role="button" aria-label="Créditos">${img('creditos')}<span class="cc">0</span></div>
      <div class="stat mutirao" data-a="mutirao" role="button" aria-label="Mutirão e disposição">${img('mutirao')}<span class="mm">0/3</span><div class="disp"><i></i></div></div>
      <button class="redondo" data-a="apreciar" aria-label="Apreciar a maquete">${img('apreciar')}</button>
      <button class="redondo" data-a="config" aria-label="Configurações">${img('config')}</button>`;
    // coluna esquerda: pílula do capítulo, metas (popover) e a linha "Agora"
    this.esq = el('div', 'esq');
    this.cap = el('button', 'cartao cap pilula'); this.cap.dataset.a = 'capmin'; this.cap.setAttribute('aria-expanded', 'false');
    this.metas = el('div', 'cartao metas oculto');
    this.feita = el('div', 'cartao meta-feita oculto');
    // "Agora": uma pílula só (toque em qualquer ponto leva à ação); com ela à vista a pílula do capítulo encolhe
    this.agora = el('button', 'cartao agora oculto'); this.agora.dataset.a = 'agora'; this.agora.innerHTML = '<span class="tx"><b>Agora</b><span class="t"></span></span><i class="ir" aria-hidden="true">Ir</i>';
    this.esq.append(this.cap, this.metas, this.feita, this.agora);
    // doca do alto: fala do conselho e avisos empilhados (acompanha a área livre quando a folha está aberta)
    this.doca = el('div', 'doca');
    this.fala = el('div', 'cartao conselho fala-dock oculto'); this.fala.setAttribute('role', 'status');
    this.brindes = el('div', 'brindes');
    this.doca.append(this.fala, this.brindes);
    this.dir = el('div', 'dir');
    const bts = [['obras', 'obras', 'Obras', 'Obras'], ['producao', 'producao', 'Produção', 'Produção'], ['almox', 'almox', 'Almox.', 'Almoxarifado'], ['pedidos', 'pedidos', 'Pedidos', 'Pedidos da comunidade'], ['trocas', 'troca', 'Trocas', 'Depósito de Trocas']];
    this.dir.innerHTML = bts.map(([a, i, t, l]) => `<button class="bt" data-a="${a}" aria-label="${l}">${img(i)}<span>${t}</span></button>`).join('');
    this.prox = el('button', 'proximo oculto'); this.prox.dataset.a = 'proximo'; this.prox.innerHTML = `${img('subir')}<span>Próximo</span>`;
    this.guiaEl = el('div', 'guia oculto passa');
    raiz.append(this.topo, this.esq, this.doca, this.dir, this.prox, this.guiaEl);
    this.filaFalas = []; this._falaAtual = null; this._falaResta = 0; this._falaT = 0;
    this.fala.addEventListener('click', (e) => { e.stopPropagation(); const pular = e.target.closest('.pular'); this._pularFala(!!pular); });
    // números: valor mostrado separado do real (o que está voando fica retido) e contagem de 480 ms
    this.ret = { creditos: 0, xp: 0 }; this.mostra = { creditos: null, xp: null }; this._an = {}; this._raf = 0; this._passo = (t) => this._contagem(t);
    this._pool = []; this._metasT = 0; this._visivel = true; this._rects = []; this._tRects = 0; this._dirVis = {};
    this.J0 = null;
  }
  get S() { return this.J.S; }
  // ------------------------------------------------ barra superior
  atualizar() {
    const J = this.J, S = J.S; const q = (s) => this.topo.querySelector(s);
    const v = J.vida(); q('.vv').textContent = pct(v); q('.vida .trilho i').style.width = v.toFixed(2) + '%';
    q('.pp').textContent = fmt(J.pop); q('.bb').textContent = J.bem + '%';
    q('.mm').textContent = `${S.mutirao}/${REGRAS.fichasMax}`; q('.disp i').style.width = clamp(S.disposicao || 0, 0, 100).toFixed(0) + '%';
    this._contar('creditos', Math.max(0, S.creditos - this.ret.creditos));
    this._contar('xp', Math.max(0, S.xp - this.ret.xp));
    // trilho: pedidos e trocas só a partir do capítulo em que abrem
    this._bt('pedidos', S.cap >= REGRAS.capPedidos); this._bt('trocas', S.cap >= ABRE.trocasCap);
  }
  _bt(a, on) { const b = this.dir.querySelector(`[data-a="${a}"]`); if (!b) return; const era = this._dirVis[a]; if (era === on) return; this._dirVis[a] = on; b.classList.toggle('oculto', !on); if (on && era === false) { b.classList.add('novo'); setTimeout(() => b.classList.remove('novo'), 4000); } this._tRects = 0; }
  _txt(k, v) {
    if (k === 'creditos') { this.topo.querySelector('.cc').textContent = fmt(Math.round(v)); return; }
    const S = this.S; const xp = Math.round(v); const n = nivelDe(xp, S.nivel); const a = XP_NIVEL[n] || 0, b = XP_NIVEL[n + 1] || a + 1;
    const p = clamp((xp - a) / (b - a), 0, 1); const an = this.topo.querySelector('.anel');
    if (this._nv !== n) { const sobe = this._nv != null && n > this._nv; this._nv = n; an.classList.add('semtr'); an.style.setProperty('--p', (sobe ? 0 : p * 100).toFixed(1) + '%'); void an.offsetWidth; an.classList.remove('semtr'); an.querySelector('b').textContent = n; this.topo.querySelector('.nome').textContent = 'Nível ' + n; if (sobe) this.pulsa(this.topo.querySelector('.nivel')); }
    an.style.setProperty('--p', (p * 100).toFixed(1) + '%'); this.topo.querySelector('.xp').textContent = fmt(Math.max(0, xp - a)) + ' / ' + fmt(b - a) + ' XP';
  }
  _contar(k, alvo) {
    if (this.mostra[k] == null) { this.mostra[k] = alvo; this._txt(k, alvo); return; }
    const a = this._an[k]; if ((a ? a.para : this.mostra[k]) === alvo) return;
    const de = this.mostra[k]; this._an[k] = { de, para: alvo, t0: performance.now() };
    if (k === 'creditos' && alvo < de) { const e = this.topo.querySelector('[data-a="creditos"]'); e.classList.remove('gasto'); void e.offsetWidth; e.classList.add('gasto'); clearTimeout(this._tGasto); this._tGasto = setTimeout(() => e.classList.remove('gasto'), 300); }
    if (!this._raf) this._raf = requestAnimationFrame(this._passo);
  }
  _contagem(t) {
    this._raf = 0; let vivo = false;
    for (const [k, a] of Object.entries(this._an)) { if (!a) continue; const u = clamp((t - a.t0) / 480, 0, 1); const v = a.de + (a.para - a.de) * easeOutCubic(u); this.mostra[k] = v; this._txt(k, v); if (u < 1) vivo = true; else this._an[k] = null; }
    if (vivo) this._raf = requestAnimationFrame(this._passo);
  }
  // valor voando para o HUD: o número só muda na chegada (soltar)
  reter(k, v) { if (!(v > 0)) return; this.ret[k] += v; this.atualizar(); }
  soltar(k, v) { this.ret[k] = Math.max(0, this.ret[k] - (v == null ? this.ret[k] : v)); this.atualizar(); }
  // ------------------------------------------------ capítulo: pílula, metas e Meta em foco
  capitulo() {
    const J = this.J, c = J.capitulo(); if (!c) { this.cap.classList.add('oculto'); this.metas.classList.add('oculto'); return; }
    this.cap.classList.remove('oculto'); const feitas = c.metas.filter((m) => J.metaFeita(m)).length;
    const h = `<b class="c">Cap. ${c.n}</b><span class="nm">${c.nome}</span><span class="prog">${feitas}/${c.metas.length}</span><i class="seta" aria-hidden="true"></i>`;
    if (h !== this._capH) { this._capH = h; this.cap.innerHTML = h; this.cap.setAttribute('aria-label', `Capítulo ${c.n}, ${c.nome}: ${feitas} de ${c.metas.length} metas`); }
    // meta cumprida: pulso verde e a meta por 2,5 s
    const ok = c.metas.map((m) => J.metaFeita(m)); const antes = this._metasOk;
    if (antes && antes.cap === c.n) ok.forEach((v, i) => { if (v && !antes.v[i]) this._metaCumprida(c.metas[i]); });
    this._metasOk = { cap: c.n, v: ok };
    if (!this.metas.classList.contains('oculto')) this._htmlMetas();
  }
  _htmlMetas() {
    const J = this.J, c = J.capitulo(); if (!c) return;
    const ag = this._agoraTx ? `<p class="agora-txt"><b>Agora</b>${this._agoraTx}</p>` : '';
    const h = `<h3>Capítulo ${c.n} · ${c.nome}</h3>${ag}${c.metas.map((m, i) => { const f = J.metaFeita(m); const pr = J.metaProgresso?.(m); return `<button class="meta ${f ? 'ok' : ''} ${this._metaNova === i ? 'nova' : ''}" data-a="meta" data-i="${i}"><i></i><span>${m.txt}</span><small>${f ? '' : pr?.txt || ''}</small></button>`; }).join('')}`;
    if (h !== this._metasH) { this._metasH = h; this.metas.innerHTML = h; }
  }
  alternarMetas(on = this.metas.classList.contains('oculto')) {
    clearTimeout(this._metasT); this.metas.classList.toggle('oculto', !on); this.cap.setAttribute('aria-expanded', on ? 'true' : 'false'); this.cap.classList.toggle('aberta', on); this._tRects = 0;
    if (on) { this._metasH = null; this._htmlMetas(); this._metasT = setTimeout(() => this.alternarMetas(false), 6000); }
  }
  get metasAbertas() { return !this.metas.classList.contains('oculto'); }
  _metaCumprida(m) {
    const c = this.cap; c.classList.remove('cumpriu'); void c.offsetWidth; c.classList.add('cumpriu'); setTimeout(() => c.classList.remove('cumpriu'), 700);
    this.feita.innerHTML = `<i></i><span>${m.txt}</span>`; this.feita.classList.remove('oculto'); clearTimeout(this._feitaT); this._feitaT = setTimeout(() => this.feita.classList.add('oculto'), 2500);
  }
  // linha "Agora": plano = J.planoMeta() (ou null para esconder)
  meta(plano) {
    if (!plano) { if (this._agoraTx != null) { this.agora.classList.add('oculto'); this.esq.classList.remove('com-agora'); this._agoraTx = null; this._tRects = 0; if (this.metasAbertas) this._htmlMetas(); } return; }
    const t = plano.texto || ''; if (this._agoraTx == null) { this.agora.classList.remove('oculto'); this.esq.classList.add('com-agora'); this._tRects = 0; }
    if (t !== this._agoraTx) { this._agoraTx = t; this.agora.querySelector('.t').textContent = t; this.agora.setAttribute('aria-label', 'Agora: ' + t); if (this.metasAbertas) this._htmlMetas(); }
    this.agora.classList.toggle('espera', plano.acao === 'aguardar');
  }
  conselho(on) { on = !!on; if (this._cons === on) return; this._cons = on; this.topo.querySelector('.aguarda').classList.toggle('oculto', !on); this._tRects = 0; }
  // ------------------------------------------------ conselheiro: fila de falas
  // o: número (ms, compatível) ou {ms, se: () => bool (a fala só vale enquanto for verdade), grupo}
  falar(quem, txt, o = {}) {
    if (typeof o === 'number') o = { ms: o }; const ms = o.ms || clamp(2600 + 50 * txt.length, 4500, 10000);
    this.filaFalas.push({ quem, txt, ms, se: o.se, grupo: o.grupo });
    // fila longa (muitas aprovações seguidas, volta do jogo fechado): as falas soltas mais antigas saem; tutorial e abertura ficam
    while (this.filaFalas.length > 4) { const i = this.filaFalas.findIndex((f) => !f.grupo); if (i < 0) break; this.filaFalas.splice(i, 1); }
    if (!this._falaAtual) this._proxFala();
  }
  _proxFala() {
    let f; while ((f = this.filaFalas.shift()) && f.se && !f.se());
    if (!f) { this._falaAtual = null; this.fala.classList.add('oculto'); clearInterval(this._falaT); this._falaT = 0; return; }
    this._falaAtual = f; this._falaResta = f.ms; this._falaUlt = performance.now(); const c = CONSELHO[f.quem] || CONSELHO.iris;
    this.fala.innerHTML = `${retrato(f.quem)}<div class="fala"><b>${c.nome} · ${c.cargo}</b>${f.txt}</div><button class="pular" aria-label="Pular a fala">Pular</button>`;
    this.fala.classList.remove('oculto'); this.fala.classList.remove('entra'); void this.fala.offsetWidth; this.fala.classList.add('entra');
    // o tempo só corre com o jogo à vista e sem modal aberto
    if (!this._falaT) this._falaT = setInterval(() => this._relogioFala(), 200);
  }
  _relogioFala() {
    const t = performance.now(), dt = t - this._falaUlt; this._falaUlt = t; const f = this._falaAtual; if (!f) return;
    if (f.se && !f.se()) { this._proxFala(); return; }
    if (document.hidden || this.raiz.querySelector('.veu')) return;
    this._falaResta -= dt; if (this._falaResta <= 0) this._proxFala();
  }
  _pularFala(tudo) { const g = this._falaAtual?.grupo; if (tudo && g) this.filaFalas = this.filaFalas.filter((f) => f.grupo !== g); this._proxFala(); }
  revalidarFalas() { const f = this._falaAtual; if (f?.se && !f.se()) this._proxFala(); }
  get falando() { return !!this._falaAtual; }
  // ------------------------------------------------ avisos empilhados (até 3; o mais antigo sai primeiro)
  brinde(txt, ic, ms = 2600) {
    const b = el('div', 'brinde', (ic ? img(ic) : '') + `<span>${txt}</span>`); this.brindes.appendChild(b);
    const vivos = [...this.brindes.children].filter((x) => !x.classList.contains('sai')); while (vivos.length > 3) this._sairBrinde(vivos.shift());
    b._t = setTimeout(() => this._sairBrinde(b), ms); return b;
  }
  _sairBrinde(b) { if (!b || b.classList.contains('sai')) return; clearTimeout(b._t); b.classList.add('sai'); const fim = () => b.remove(); b.addEventListener('animationend', fim, { once: true }); setTimeout(fim, 260); }
  // popover de informação preso a um elemento do HUD (bem-estar, Mutirão)
  info(ancora, html, ms = 5000) {
    this.fecharInfo(); const a = typeof ancora === 'string' ? this.topo.querySelector(ancora) : ancora; if (!a) return;
    const p = el('div', 'cartao info-pop', html); this.raiz.appendChild(p); const r = a.getBoundingClientRect(); const w = p.offsetWidth;
    p.style.left = clamp(r.left + r.width / 2 - w / 2, 8, innerWidth - w - 8) + 'px'; p.style.top = r.bottom + 8 + 'px';
    this._info = p; this._infoT = setTimeout(() => this.fecharInfo(), ms); p.addEventListener('click', () => this.fecharInfo());
  }
  fecharInfo() { clearTimeout(this._infoT); if (this._info) { this._info.remove(); this._info = null; } }
  // ------------------------------------------------ trilho, Próximo e guia
  ponto(botao, n) { const b = this.dir.querySelector(`[data-a="${botao}"]`); if (!b) return; let p = b.querySelector('.ponto'); if (!n) { p?.remove(); return; } if (!p) { p = el('i', 'ponto'); b.appendChild(p); } const t = n > 9 ? '9+' : String(n); if (p.textContent !== t) p.textContent = t; }
  // o = {icone, verbo, pulsa, compacto (a linha Agora já diz o verbo: só o ícone)} ou null
  proximo(o) {
    const k = o ? o.icone + '|' + o.verbo + '|' + !!o.pulsa + '|' + !!o.compacto : ''; if (k === this._proxK) return; this._proxK = k;
    this.prox.classList.toggle('oculto', !o); this._tRects = 0; if (!o) return;
    this.prox.innerHTML = `${img(o.icone || 'subir')}<span>${o.verbo}</span>`; this.prox.classList.toggle('pulsa', !!o.pulsa); this.prox.classList.toggle('compacto', !!o.compacto); this.prox.setAttribute('aria-label', 'Próximo: ' + o.verbo);
  }
  // anel pulsante do tutorial sobre um ponto da tela (ou null)
  guia(x, y) {
    const g = this.guiaEl; if (x == null) { if (!g.classList.contains('oculto')) g.classList.add('oculto'); this._gx = null; return; }
    if (g.classList.contains('oculto')) g.classList.remove('oculto');
    if (this._gx == null || Math.abs(x - this._gx) > 0.5 || Math.abs(y - this._gy) > 0.5) { this._gx = x; this._gy = y; g.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`; }
  }
  alvoBotao(nome) {
    const b = nome === 'xp' || nome === 'nivel' ? this.topo.querySelector('.anel') : this.dir.querySelector(`[data-a="${nome}"]:not(.oculto)`) || this.topo.querySelector(`[data-a="${nome}"]`);
    if (!b || !this._visivel) return [innerWidth - 40, innerHeight / 2, null]; const r = b.getBoundingClientRect(); if (!r.width) return [innerWidth - 40, innerHeight / 2, null]; return [r.left + r.width / 2, r.top + r.height / 2, b];
  }
  pulsa(e) { if (!e) return; e.classList.remove('pulsa-hud'); void e.offsetWidth; e.classList.add('pulsa-hud'); clearTimeout(e._pt); e._pt = setTimeout(() => e.classList.remove('pulsa-hud'), 260); }
  // retângulos do HUD visível (os balões por baixo ficam apagados e sem toque); relidos a cada 0,5 s
  retangulos(t) {
    if (t - this._tRects < 500 && this._rects.length) return this._rects; this._tRects = t; const R = this._rects; R.length = 0; if (!this._visivel) return R;
    const add = (e) => { if (!e || e.classList.contains('oculto')) return; const r = e.getBoundingClientRect(); if (r.width && r.height) R.push(r.left - 4, r.top - 4, r.right + 4, r.bottom + 4); };
    for (const e of this.topo.children) if (!e.classList.contains('esp')) add(e); for (const e of this.esq.children) add(e); for (const e of this.dir.children) add(e); add(this.prox); add(this.fala);
    return R;
  }
  // ------------------------------------------------ voo de ícones (explosão e sucção até o botão)
  _img() { let v = this._pool.find((x) => !x._uso); if (!v && this._pool.length < 12) { v = el('img', 'voa'); v.alt = ''; v.draggable = false; document.body.appendChild(v); this._pool.push(v); } if (v) { v._uso = true; v.style.display = ''; } return v; }
  // n ícones de 'ic' saindo de (x0, y0) até o botão 'destino'; cada chegada chama aoChegar(i, n)
  voar(ic, x0, y0, destino = 'almox', aoChegar, o = {}) {
    const n = Math.max(1, o.n || 1), vis = Math.min(8, n), passo = o.passo || 70; const src = icone(ic);
    for (let i = 0; i < vis; i++) setTimeout(() => {
      const v = this._img(); const ult = i === vis - 1;
      if (!v) { aoChegar?.(i, vis, ult); if (ult) this._chegou(destino); return; }
      if (v.getAttribute('src') !== src) v.src = src; v.style.transform = `translate(${(x0 - 17).toFixed(1)}px,${(y0 - 17).toFixed(1)}px) scale(.6)`;
      if (ult && n > vis) { v.dataset.mais = '+' + (n - vis); v.classList.add('mais'); } else v.classList.remove('mais');
      const [x1, y1] = this.alvoBotao(destino); const a = Math.random() * Math.PI * 2, r = 28 + Math.random() * 20; const xe = x0 + Math.cos(a) * r, ye = y0 + Math.sin(a) * r;
      const hold = 60 + Math.random() * 60, suc = 420 + Math.random() * 100; const t0 = performance.now();
      const step = (t) => {
        const tt = t - t0; let x, y, s;
        if (tt < 160) { const k = easeOutQuad(tt / 160); x = x0 + (xe - x0) * k; y = y0 + (ye - y0) * k; s = 0.6 + 0.7 * k; }
        else if (tt < 160 + hold) { x = xe; y = ye - (tt - 160) * 0.02; s = 1.3; }
        else { const k = clamp((tt - 160 - hold) / suc, 0, 1), e = easeInCubic(k); const ys = ye - hold * 0.02; x = xe + (x1 - xe) * e; y = ys + (y1 - ys) * e; s = 1.3 - 0.6 * e;
          if (k >= 1) { v._uso = false; v.style.display = 'none'; aoChegar?.(i, vis, ult); if (ult || i === 0) this._chegou(destino); return; } }
        v.style.transform = `translate(${(x - 17).toFixed(1)}px,${(y - 17).toFixed(1)}px) scale(${s.toFixed(3)})`; requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, i * passo);
  }
  _chegou(destino) { const [, , b] = this.alvoBotao(destino); this.pulsa(b); }
  visivel(on) { this._visivel = on; for (const e of [this.topo, this.esq, this.dir, this.prox]) e.classList.toggle('escondido', !on); if (!on) { this.guia(null); this.fecharInfo(); } this._tRects = 0; }
}
