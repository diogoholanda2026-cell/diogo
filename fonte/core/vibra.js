// Vibração (Android/Chrome): três padrões só — toque, sucesso e erro.
export const vibra = {
  on: true,
  _v(p) { if (this.on && navigator.vibrate) try { navigator.vibrate(p); } catch (_) {} },
  tique() { this._v(10); },
  sucesso() { this._v([16, 50, 28]); },
  erro() { this._v([40, 40, 40]); },
};
