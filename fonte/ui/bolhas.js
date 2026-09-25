// Balões presos a pontos do mundo 3D (coletar, aprovar, obra disponível, obra em andamento, módulo bloqueado),
// como os do BuildIt: círculo branco com aro colorido, ícone grande, ponta embaixo e sombra. Arrastar o dedo por
// vários balões de coleta recolhe todos de uma vez. Os balões entram com mola e pulam no compositor (transform),
// cada um na sua fase; os de coletar e aprovar chamam atenção de tempos em tempos, o item da coleta pula dentro do
// balão, uma moeda sobe do balão de repasse e um brilho pisca nos que pedem toque (só transform e opacity).
// Os importantes (aprovar, coletar, moedas, subir) fora da tela ficam presos à borda com uma seta; balões a
// menos de 40 px viram um grupo com '+n' (fica o de maior prioridade). Sob o HUD ficam apagados e sem toque.
// O DOM só é escrito quando algo muda (posição > 0,3 px, escala > 0,005): com a câmera parada, nada.
import * as THREE from 'three';
import { el, clamp } from '../core/util.js';
import { icone } from './icones.js';

const PRIO = { pronta: 0, coleta: 1, moedas: 2, subir: 3, placa: 4, bloq: 5, obra: 6 };
const NA_BORDA = { pronta: 1, coleta: 1, moedas: 1, subir: 1 };
const hashId = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const BW = 52, BH = 62; // tamanho do balão (o ponto preso ao mundo é a ponta, embaixo no meio)

export class Bolhas {
  constructor(raiz, camera, engine) {
    this.raiz = el('div', 'bolhas'); raiz.insertBefore(this.raiz, raiz.firstChild); // abaixo do HUD e dos painéis
    this.raiz.style.setProperty('--moeda', `url("${icone('creditos')}")`); // a moeda que sobe do balão de repasse
    this.cam = camera; this.e = engine; this.mapa = new Map(); this._v = new THREE.Vector3(); this.visivel = true; this._vis = true;
    this._colhendo = false; this._ord = []; this._vistos = new Set(); this._t = 0; this.rects = null; this.cartao = 0;
    this.onBorda = null; this.onGrupo = null; this.safeL = 0; this._safe(); addEventListener('resize', () => this._safe());
    this._cmp = (a, b) => PRIO[a.tipo] - PRIO[b.tipo] || a.z - b.z;
    window.addEventListener('pointermove', (ev) => {
      if (!this._colhendo) return; const t = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.balao'); const B = t?._b; if (!B || !B.coletavel || B._colhido) return;
      B._colhido = true; B.acao(t); if (t._d?.membros) for (const m of this._membros(t._d)) if (m.b.coletavel && !m.b._colhido) { m.b._colhido = true; m.b.acao(null); }
    }, { passive: true });
    window.addEventListener('pointerup', () => { this._colhendo = false; });
    window.addEventListener('pointercancel', () => { this._colhendo = false; });
  }
  _safe() { const p = el('div', ''); p.style.cssText = 'position:fixed;left:0;top:0;padding-left:env(safe-area-inset-left,0px);visibility:hidden'; document.body.appendChild(p); this.safeL = parseFloat(getComputedStyle(p).paddingLeft) || 0; p.remove(); }
  _membros(d) { const out = []; for (const m of this.mapa.values()) if (m.lider === d) out.push(m); return out; }
  _criar(b, k) {
    const n = el('div', 'balao ' + b.tipo); const dl = -(hashId(b.id) % 1600);
    n.innerHTML = `<div class="ent" style="animation-delay:${k * 40}ms"><div class="flut" style="animation-delay:${dl}ms"><i class="ponta"></i><div class="corpo" style="animation-delay:${dl}ms"><img alt="" draggable="false" style="animation-delay:${dl}ms"><i class="brilho" style="animation-delay:${dl}ms"></i></div><span class="n"></span><span class="mais"></span></div></div><i class="seta"></i>`;
    this.raiz.appendChild(n);
    const d = { el: n, img: n.querySelector('img'), corpo: n.querySelector('.corpo'), nEl: n.querySelector('.n'), maisEl: n.querySelector('.mais'), seta: n.querySelector('.seta'), tipo: b.tipo, cur: null, pos: null, vis: null, wx: -1e9, wy: -1e9, we: -1e9, wz: NaN, wa: -1e9, wm: 0, wb: false, ws: false, membros: 0, lider: null };
    n._d = d;
    n.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation(); const B = n._b; if (!B) return; n._down = [ev.clientX, ev.clientY];
      if (B.coletavel && !d.borda && !d.membros) { this._colhendo = true; B._colhido = true; n._down = null; B.acao(n); }
    });
    n.addEventListener('pointerup', (ev) => {
      const B = n._b; if (!B || !n._down) return; const perto = Math.hypot(ev.clientX - n._down[0], ev.clientY - n._down[1]) < 20; n._down = null; if (!perto) return;
      if (d.borda) { this.onBorda?.(B); return; }
      if (d.membros) { const M = this._membros(d); if (B.coletavel && M.every((m) => m.b.coletavel)) { B.acao(n); for (const m of M) m.b.acao(null); } else this.onGrupo?.(B, M.map((m) => m.b)); return; }
      if (B.tipo === 'pronta') n.classList.add('toque'); B.acao(n);
    });
    return d;
  }
  // lista: [{id, tipo, icone, pos:[x,y,z], acao(el), n, p, coletavel}]
  definir(lista) {
    const vistos = this._vistos; vistos.clear(); let novos = 0;
    for (const b of lista) {
      vistos.add(b.id); let d = this.mapa.get(b.id);
      if (!d) { d = this._criar(b, novos++); this.mapa.set(b.id, d); }
      const n = d.el; n._b = b; d.b = b; b._colhido = false;
      if (d.tipo !== b.tipo) { n.classList.remove(d.tipo); n.classList.add(b.tipo); d.tipo = b.tipo; }
      if (d.icone !== b.icone) { d.img.src = icone(b.icone); d.icone = b.icone; }
      const nn = b.n > 1 ? String(b.n) : ''; if (d.nn !== nn) { d.nEl.textContent = nn; d.nEl.style.display = nn ? '' : 'none'; d.nn = nn; }
      if (b.tipo === 'obra') { const p = ((b.p || 0) * 100).toFixed(1) + '%'; if (d.p !== p) { d.corpo.style.setProperty('--p', p); d.p = p; } }
      if (!d.cur) d.cur = [b.pos[0], b.pos[1], b.pos[2]]; d.pos = b.pos;
    }
    for (const [id, d] of this.mapa) if (!vistos.has(id)) this._sair(id, d);
  }
  _sair(id, d) {
    this.mapa.delete(id); const n = d.el; n._b = null;
    if (!d.vis) { n.remove(); return; }
    if (n.classList.contains('toque')) { setTimeout(() => n.remove(), 130); return; }
    n.classList.add('sai'); const fim = () => n.remove(); n.querySelector('.ent').addEventListener('animationend', fim, { once: true }); setTimeout(fim, 260);
  }
  _sob(x, y) { const R = this.rects; if (!R) return false; for (let i = 0; i < R.length; i += 4) if (x >= R[i] && x <= R[i + 2] && y >= R[i + 1] && y <= R[i + 3]) return true; return false; }
  atualizar() {
    if (!this.visivel) { if (this._vis) { this._vis = false; this.raiz.style.display = 'none'; } return; }
    if (!this._vis) { this._vis = true; this.raiz.style.display = ''; }
    const W = this.e.vw, H = this.e.vh, cam = this.cam, v = this._v; const t = performance.now(); const dt = Math.min(0.1, (t - (this._t || t)) / 1000); this._t = t; const kd = 1 - Math.exp(-8 * dt);
    // limites da borda (o balão inteiro: da ponta embaixo até o topo, 62 px acima)
    const bx0 = Math.max(this.safeL + 16, this.cartao || 0) + BW / 2, bx1 = W - 96 - BW / 2, by0 = 64 + BH, by1 = H - 24; const cx = W / 2, cy = H / 2;
    const ord = this._ord; ord.length = 0;
    for (const d of this.mapa.values()) {
      d.lider = null; d.membros = 0; if (!d.pos) { d.show = false; continue; }
      const c = d.cur, p = d.pos; if (Math.abs(p[0] - c[0]) + Math.abs(p[1] - c[1]) + Math.abs(p[2] - c[2]) > 3) { c[0] = p[0]; c[1] = p[1]; c[2] = p[2]; } else { c[0] += (p[0] - c[0]) * kd; c[1] += (p[1] - c[1]) * kd; c[2] += (p[2] - c[2]) * kd; }
      v.set(c[0], c[1], c[2]).project(cam);
      const atras = v.z > 1; let x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      d.borda = false;
      if (atras || x < 8 || x > W - 8 || y < BH * 0.5 || y > H + 16) {
        if (!NA_BORDA[d.tipo]) { d.show = false; continue; }
        let dx = x - cx, dy = y - cy; if (atras) { dx = -dx; dy = -dy; } if (Math.abs(dx) + Math.abs(dy) < 1e-3) dy = 1;
        const s = Math.min(dx > 0 ? (bx1 - cx) / dx : dx < 0 ? (bx0 - cx) / dx : Infinity, dy > 0 ? (by1 - cy) / dy : dy < 0 ? (by0 - cy) / dy : Infinity);
        x = cx + dx * s; y = cy + dy * s; d.ang = Math.atan2(dy, dx); d.borda = true; d.esc = 0.9;
      } else d.esc = clamp(1.25 - v.z * 0.35, 0.85, 1.1);
      d.x = x; d.y = y; d.z = atras ? 1 : v.z; d.show = true; ord.push(d);
    }
    // agrupar: pela prioridade, quem cai a menos de 40 px de um balão já posto entra no grupo dele
    ord.sort(this._cmp);
    // (com folga: quem já estava no grupo só sai acima de 46 px, para não piscar na borda dos 40)
    for (let i = 0; i < ord.length; i++) { const a = ord[i]; for (let j = 0; j < i; j++) { const b = ord[j]; if (b.lider) continue; const ex = a.x - b.x, ey = a.y - b.y; if (ex * ex + ey * ey < (a.antes === b ? 2116 : 1600)) { a.lider = b; b.membros++; break; } } }
    for (const d of ord) d.antes = d.lider;
    for (const d of this.mapa.values()) {
      const n = d.el; const vis = d.show && !d.lider;
      if (vis !== d.vis) { d.vis = vis; n.style.display = vis ? '' : 'none'; }
      if (!vis) continue;
      if (Math.abs(d.x - d.wx) > 0.3 || Math.abs(d.y - d.wy) > 0.3 || Math.abs(d.esc - d.we) > 0.005) { d.wx = d.x; d.wy = d.y; d.we = d.esc; n.style.transform = `translate(${d.x.toFixed(1)}px,${d.y.toFixed(1)}px) scale(${d.esc.toFixed(3)})`; }
      const z = 1000 - Math.round(d.z * 1000) + (d.borda ? 1000 : 0) + (d.tipo === 'pronta' ? 500 : 0); if (z !== d.wz) { d.wz = z; n.style.zIndex = z; }
      if (d.borda !== d.wb) { d.wb = d.borda; n.classList.toggle('borda', d.borda); }
      if (d.borda && Math.abs(d.ang - d.wa) > 0.03) { d.wa = d.ang; d.seta.style.transform = `rotate(${d.ang.toFixed(3)}rad) translateX(33px)`; }
      if (d.membros !== d.wm) { d.wm = d.membros; d.maisEl.textContent = d.membros ? '+' + d.membros : ''; n.classList.toggle('grupo', d.membros > 0); }
      const sob = !d.borda && this._sob(d.x, d.y - BH / 2); if (sob !== d.ws) { d.ws = sob; n.classList.toggle('sob', sob); }
    }
  }
  // centro do balão na tela (ou do grupo em que ele está); null se não aparece. Chamado a cada quadro pelo guia:
  // devolve sempre o mesmo array (quem guarda o ponto copia)
  posTela(id) { let d = this.mapa.get(id); if (!d || !d.show) return null; if (d.lider) d = d.lider; if (!d.vis) return null; const p = this._pt || (this._pt = [0, 0]); p[0] = d.x; p[1] = d.y - (BH / 2 + 4) * d.esc; return p; }
  // o balão (ou o grupo em que ele está) está apagado sob o HUD, sem toque
  sob(id) { let d = this.mapa.get(id); if (d?.lider) d = d.lider; return !!d?.ws; }
  tela(pos) { const v = this._v.set(pos[0], pos[1], pos[2]).project(this.cam); return [(v.x * 0.5 + 0.5) * this.e.vw, (-v.y * 0.5 + 0.5) * this.e.vh]; }
}
