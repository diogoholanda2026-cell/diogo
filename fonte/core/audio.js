// Som procedural (Web Audio): cliques de maquete, "plim" de coleta que sobe de tom em sequência,
// marteladas do canteiro, carimbo de aprovação e uma trilha ambiente generativa bem baixa.
export class Som {
  constructor() { this.ctx = null; this.efeitos = true; this.musica = true; this.volEf = 0.8; this.volMu = 0.35; this.combo = 0; this._tc = 0; this.obraAtiva = 0; }
  iniciar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createDynamicsCompressor(); this.master.threshold.value = -14; this.master.ratio.value = 3; this.master.connect(c.destination);
    this.gEf = c.createGain(); this.gEf.gain.value = this.volEf; this.gEf.connect(this.master);
    this.gMu = c.createGain(); this.gMu.gain.value = this.musica ? this.volMu : 0; this.gMu.connect(this.master);
    // reverberação curta gerada (sala de exposição)
    const len = c.sampleRate * 2.2, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.rev = c.createConvolver(); this.rev.buffer = ir; this.gRev = c.createGain(); this.gRev.gain.value = 0.35; this.rev.connect(this.gRev); this.gRev.connect(this.master);
    this._ruido = c.createBuffer(1, c.sampleRate, c.sampleRate); const nd = this._ruido.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this._musica();
    this._marteladas();
  }
  setEfeitos(on) { this.efeitos = on; }
  setMusica(on) { this.musica = on; if (this.gMu) this.gMu.gain.setTargetAtTime(on ? this.volMu : 0, this.ctx.currentTime, 0.5); }
  _ok() { return this.ctx && this.efeitos && this.ctx.state === 'running'; }
  _tom(f, t0, dur, tipo = 'sine', vol = 0.3, dest = this.gEf, ataque = 0.005, rev = 0) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = tipo; o.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + ataque); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest); if (rev) { const r = c.createGain(); r.gain.value = rev; g.connect(r); r.connect(this.rev); } o.start(t0); o.stop(t0 + dur + 0.05); return o;
  }
  _ruidoF(t0, dur, freq, q, vol, tipo = 'bandpass') { const c = this.ctx, s = c.createBufferSource(); s.buffer = this._ruido; const f = c.createBiquadFilter(); f.type = tipo; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(f); f.connect(g); g.connect(this.gEf); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02); }
  toque() { if (!this._ok()) return; const t = this.ctx.currentTime; this._ruidoF(t, 0.035, 3200, 2.5, 0.25); this._tom(1400, t, 0.05, 'triangle', 0.06); }
  abrir() { if (!this._ok()) return; const t = this.ctx.currentTime; this._ruidoF(t, 0.18, 900, 0.7, 0.08, 'lowpass'); this._tom(520, t, 0.12, 'sine', 0.07); this._tom(780, t + 0.05, 0.14, 'sine', 0.05); }
  fechar() { if (!this._ok()) return; const t = this.ctx.currentTime; this._tom(620, t, 0.1, 'sine', 0.06); this._tom(420, t + 0.04, 0.12, 'sine', 0.05); }
  coleta() {
    if (!this._ok()) return; const c = this.ctx, t = c.currentTime; if (t - this._tc > 1.2) this.combo = 0; this._tc = t; const k = Math.min(this.combo++, 12);
    const f = 880 * Math.pow(2, [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28][k] / 12);
    this._tom(f, t, 0.35, 'sine', 0.16, this.gEf, 0.003, 0.25); this._tom(f * 2, t + 0.012, 0.22, 'sine', 0.05, this.gEf, 0.003, 0.2); this._ruidoF(t, 0.03, 6000, 3, 0.05);
  }
  moedas() { if (!this._ok()) return; const t = this.ctx.currentTime; for (let i = 0; i < 6; i++) this._tom(1800 + Math.random() * 900, t + i * 0.045, 0.12, 'square', 0.025, this.gEf, 0.002, 0.2); }
  erro() { if (!this._ok()) return; const t = this.ctx.currentTime; const c = this.ctx; const o = this._tom(150, t, 0.22, 'square', 0.08); o.frequency.exponentialRampToValueAtTime(95, t + 0.2); const f = c.createBiquadFilter(); }
  obra() { if (!this._ok()) return; const t = this.ctx.currentTime; const o = this._tom(120, t, 0.35, 'sine', 0.35); o.frequency.exponentialRampToValueAtTime(45, t + 0.3); this._ruidoF(t, 0.25, 400, 0.8, 0.2, 'lowpass'); for (let i = 0; i < 3; i++) this._martelo(t + 0.25 + i * 0.18); }
  _martelo(t) { this._ruidoF(t, 0.05, 2400 + Math.random() * 800, 6, 0.12); this._tom(1900 + Math.random() * 500, t, 0.08, 'triangle', 0.035); }
  aprovado() {
    if (!this._ok()) return; const t = this.ctx.currentTime; const o = this._tom(90, t, 0.3, 'sine', 0.5); o.frequency.exponentialRampToValueAtTime(40, t + 0.25); this._ruidoF(t, 0.12, 700, 1, 0.3, 'lowpass');
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this._tom(f, t + 0.28 + i * 0.07, 0.9, 'triangle', 0.1, this.gEf, 0.01, 0.4));
  }
  nivel() { if (!this._ok()) return; const t = this.ctx.currentTime; [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this._tom(f, t + i * 0.09, 0.7, 'triangle', 0.09, this.gEf, 0.01, 0.4)); }
  // marteladas distantes enquanto houver obra perto da câmera (0..1)
  _marteladas() { const loop = () => { if (this._ok() && this.obraAtiva > 0.05 && Math.random() < 0.6) this._martelo(this.ctx.currentTime + Math.random() * 0.1), this._ruidoF(this.ctx.currentTime, 0.04, 1800, 5, 0.05 * this.obraAtiva); setTimeout(loop, 350 + Math.random() * 900); }; loop(); }
  // trilha ambiente: acordes suaves que mudam devagar e sinos pentatônicos ocasionais
  _musica() {
    const c = this.ctx; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(this.gMu); const rv = c.createGain(); rv.gain.value = 0.6; lp.connect(rv); rv.connect(this.rev);
    const acordes = [[220, 261.63, 329.63, 392], [174.61, 220, 261.63, 329.63], [130.81, 196, 246.94, 329.63], [196, 246.94, 293.66, 369.99]]; let k = 0;
    const penta = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    const toca = () => {
      if (!this.ctx) return; const t = c.currentTime + 0.05; const ac = acordes[k++ % acordes.length];
      if (this.musica) {
        for (const f of ac) { const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = f / 2; o.detune.value = (Math.random() - 0.5) * 8; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 2.5); g.gain.linearRampToValueAtTime(0.0, t + 9.5); o.connect(g); g.connect(lp); o.start(t); o.stop(t + 10); }
        for (let i = 0; i < 3; i++) if (Math.random() < 0.55) { const tt = t + 1 + Math.random() * 6; this._tom(penta[(Math.random() * penta.length) | 0], tt, 2.4, 'sine', 0.035, lp, 0.01, 0); }
      }
      setTimeout(toca, 8000);
    };
    toca();
  }
}
