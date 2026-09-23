// Balões presos a pontos do mundo 3D (coletar, aprovar, obra disponível, obra em andamento).
// Arrastar o dedo por vários balões de coleta recolhe todos de uma vez.
import * as THREE from 'three';
import { el } from '../core/util.js';
import { icone } from './icones.js';

export class Bolhas {
  constructor(raiz, camera, engine) {
    this.raiz = el('div', ''); this.raiz.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden'; raiz.insertBefore(this.raiz, raiz.firstChild); // abaixo do HUD e dos painéis
    this.cam = camera; this.e = engine; this.mapa = new Map(); this._v = new THREE.Vector3(); this.visivel = true;
    this._colhendo = false;
    window.addEventListener('pointermove', (ev) => { if (!this._colhendo) return; const t = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.balao'); if (t && t._b && t._b.coletavel && !t._b._colhido) { t._b._colhido = true; t._b.acao(t); } }, { passive: true });
    window.addEventListener('pointerup', () => { this._colhendo = false; });
    window.addEventListener('pointercancel', () => { this._colhendo = false; });
  }
  // lista: [{id, tipo, icone, pos:[x,y,z], acao(el), n, p, coletavel}]
  definir(lista) {
    const vistos = new Set();
    for (const b of lista) {
      vistos.add(b.id); let d = this.mapa.get(b.id);
      if (!d) {
        const n = el('div', 'balao pula'); n.innerHTML = '<div class="corpo"><img alt="" draggable="false"></div>'; this.raiz.appendChild(n);
        n.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); const B = n._b; if (!B) return; if (B.coletavel) { this._colhendo = true; B._colhido = true; B.acao(n); } else { n._down = [ev.clientX, ev.clientY]; } });
        n.addEventListener('pointerup', (ev) => { const B = n._b; if (!B || B.coletavel || !n._down) return; if (Math.hypot(ev.clientX - n._down[0], ev.clientY - n._down[1]) < 20) B.acao(n); n._down = null; });
        d = { el: n, img: n.querySelector('img') }; this.mapa.set(b.id, d);
      }
      const n = d.el; n._b = b; b._colhido = false;
      if (d.tipo !== b.tipo) { n.className = 'balao pula ' + b.tipo; d.tipo = b.tipo; }
      if (d.icone !== b.icone) { d.img.src = icone(b.icone); d.icone = b.icone; }
      const nn = b.n > 1 ? b.n : 0; if (d.n !== nn) { let s = n.querySelector('.n'); if (!nn) s?.remove(); else { if (!s) { s = el('span', 'n'); n.appendChild(s); } s.textContent = nn; } d.n = nn; }
      if (b.tipo === 'obra') n.style.setProperty('--p', ((b.p || 0) * 100).toFixed(1) + '%');
      d.pos = b.pos;
    }
    for (const [id, d] of this.mapa) if (!vistos.has(id)) { d.el.remove(); this.mapa.delete(id); }
  }
  atualizar() {
    const W = this.e.vw, H = this.e.vh; const cam = this.cam; const v = this._v;
    for (const d of this.mapa.values()) {
      if (!this.visivel || !d.pos) { d.el.style.display = 'none'; continue; }
      v.set(d.pos[0], d.pos[1], d.pos[2]).project(cam);
      if (v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.2) { d.el.style.display = 'none'; continue; }
      d.el.style.display = ''; const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      const esc = Math.max(0.62, Math.min(1.1, 1.25 - v.z * 0.35));
      d.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${esc.toFixed(3)})`;
    }
  }
  tela(pos) { const v = this._v.set(pos[0], pos[1], pos[2]).project(this.cam); return [(v.x * 0.5 + 0.5) * this.e.vw, (-v.y * 0.5 + 0.5) * this.e.vh]; }
}
