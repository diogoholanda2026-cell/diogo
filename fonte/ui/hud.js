// HUD: barra superior (nível, vida da composição, créditos, Mutirão), cartão do capítulo,
// conselheiro, botões do trilho direito, avisos rápidos e o botão "Próximo".
import { el, fmt } from '../core/util.js';
import { img, icone } from './icones.js';
import { CONSELHO } from '../data/historia.js';
import { XP_NIVEL } from '../data/itens.js';

export class Hud {
  constructor(raiz, J) {
    this.J = J; this.raiz = raiz;
    this.topo = el('div', 'topo');
    this.topo.innerHTML = `
      <div class="nivel" data-a="nivel"><div class="anel"><b>1</b></div><div class="info"><b class="nome">Nível 1</b><small class="xp">0 XP</small></div></div>
      <div class="stat vida" data-a="vida">${img('vida')}<span class="vv">0%</span><div class="trilho"><i></i></div></div>
      <div class="stat" data-a="pop">${img('pop')}<span class="pp">0</span></div>
      <div class="stat" data-a="bem">${img('bem')}<span class="bb">35%</span></div>
      <div class="esp"></div>
      <div class="stat" data-a="creditos">${img('creditos')}<span class="cc">0</span></div>
      <div class="stat" data-a="mutirao">${img('mutirao')}<span class="mm">0</span></div>
      <button class="redondo" data-a="config" aria-label="Configurações">${img('config')}</button>`;
    this.esq = el('div', 'esq');
    this.cap = el('div', 'cartao cap'); this.esq.appendChild(this.cap);
    this.fala = el('div', 'cartao conselho oculto'); this.esq.appendChild(this.fala);
    this.dir = el('div', 'dir');
    const bts = [['obras', 'obras', 'Obras'], ['producao', 'producao', 'Produção'], ['almox', 'almox', 'Almoxarifado'], ['pedidos', 'pedidos', 'Pedidos'], ['apreciar', 'apreciar', 'Apreciar']];
    this.dir.innerHTML = bts.map(([a, i, t]) => `<button class="bt" data-a="${a}" aria-label="${t}">${img(i)}<span>${t}</span></button>`).join('');
    this.prox = el('button', 'proximo'); this.prox.innerHTML = `${img('subir')}<span>Próximo</span>`; this.prox.dataset.a = 'proximo';
    raiz.append(this.topo, this.esq, this.dir, this.prox);
    this.filaFalas = []; this._falaT = 0;
  }
  atualizar() {
    const J = this.J, S = J.S; const q = (s) => this.topo.querySelector(s);
    const a = XP_NIVEL[S.nivel] || 0, b = XP_NIVEL[S.nivel + 1] || a + 1; const p = Math.max(0, Math.min(1, (S.xp - a) / (b - a)));
    q('.anel').style.setProperty('--p', (p * 100).toFixed(1) + '%'); q('.anel b').textContent = S.nivel; q('.nome').textContent = 'Nível ' + S.nivel; q('.xp').textContent = fmt(S.xp - a) + ' / ' + fmt(b - a) + ' XP';
    const v = J.vida(); q('.vv').textContent = v.toFixed(v < 10 ? 1 : 0) + '%'; q('.vida .trilho i').style.width = v + '%';
    q('.pp').textContent = fmt(J.pop); q('.bb').textContent = J.bem + '%'; q('.cc').textContent = fmt(S.creditos); q('.mm').textContent = S.mutirao + '/5';
  }
  capitulo(minimo) {
    const J = this.J, c = J.capitulo(); if (!c) { this.cap.classList.add('oculto'); return; }
    this.cap.classList.remove('oculto'); this.cap.classList.toggle('mini', !!minimo);
    this.cap.innerHTML = `<button class="fechar" data-a="capmin">${minimo ? '▾' : '▴'}</button><h3>Capítulo ${c.n}</h3><h2>${c.nome}</h2><ul>${c.metas.map((m) => `<li class="${J.metaFeita(m) ? 'ok' : ''}"><i></i><span>${m.txt}</span></li>`).join('')}</ul>`;
  }
  // conselheiro: fila de falas curtas
  falar(quem, txt, ms = 7000) { this.filaFalas.push([quem, txt, ms]); if (!this._falando) this._proxFala(); }
  _proxFala() {
    const f = this.filaFalas.shift(); if (!f) { this._falando = false; this.fala.classList.add('oculto'); return; }
    this._falando = true; const [quem, txt, ms] = f; const c = CONSELHO[quem] || CONSELHO.iris;
    this.fala.classList.remove('oculto'); this.fala.innerHTML = `<div class="retrato" style="background:radial-gradient(circle at 35% 30%,#fff,${c.cor})">${c.ini}</div><div class="fala"><b>${c.nome} · ${c.cargo}</b>${txt}</div>`;
    this.fala.style.animation = 'none'; void this.fala.offsetWidth; this.fala.style.animation = '';
    clearTimeout(this._falaT); this._falaT = setTimeout(() => this._proxFala(), ms);
    this.fala.onclick = () => { clearTimeout(this._falaT); this._proxFala(); };
  }
  brinde(txt, ic, ms = 2200) { const b = el('div', 'brinde passa', (ic ? img(ic) : '') + `<span>${txt}</span>`); this.raiz.appendChild(b); setTimeout(() => b.remove(), ms); }
  ponto(botao, n) { const b = this.dir.querySelector(`[data-a="${botao}"]`); if (!b) return; let p = b.querySelector('.ponto'); if (!n) { p?.remove(); return; } if (!p) { p = el('i', 'ponto'); b.appendChild(p); } p.textContent = n > 9 ? '9+' : n; }
  alvoBotao(nome) { const b = this.dir.querySelector(`[data-a="${nome}"]`) || this.topo.querySelector(`[data-a="${nome}"]`); if (!b) return [innerWidth - 40, innerHeight / 2]; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }
  // ícone voando de um ponto da tela até um botão
  voar(ic, x0, y0, destino = 'almox', cb) {
    const [x1, y1] = this.alvoBotao(destino); const v = el('img', 'voa'); v.src = icone(ic); document.body.appendChild(v);
    const t0 = performance.now(), dur = 650 + Math.random() * 150; const cx = (x0 + x1) / 2 + (Math.random() - 0.5) * 120, cy = Math.min(y0, y1) - 120;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur); const e = k * k * (3 - 2 * k); const x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * cx + e * e * x1, y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * cy + e * e * y1; v.style.transform = `translate(${x - 17}px,${y - 17}px) scale(${1.2 - 0.5 * e})`; v.style.opacity = k > 0.9 ? (1 - k) * 10 : 1; if (k < 1) requestAnimationFrame(step); else { v.remove(); cb && cb(); } };
    requestAnimationFrame(step);
  }
  visivel(on) { for (const e of [this.topo, this.esq, this.dir, this.prox]) e.classList.toggle('oculto', !on); }
}
