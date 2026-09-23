/* =========================================================
   ARCOLOGIA DE HELD — versão 1 (mecânica estilo SimCity BuildIt)
   01 · base: constantes e utilidades
   ========================================================= */
const N = 48;             // mapa N x N quadrados (a mesa inteira)
const TW = 1, TH = 1;     // um quadrado = uma unidade de mundo no 3D
const TAU = Math.PI * 2;
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];

function fmt(n) {
  n = Math.floor(n); const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2).replace('.', ',') + ' bi';
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2).replace('.', ',') + ' mi';
  return n.toLocaleString('pt-BR');
}
function fmtR(n) { return n >= 100 ? fmt(n) : (Math.round(n * 10) / 10).toLocaleString('pt-BR'); }
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function dur(s) {
  s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  if (h) return h + ' h' + (m ? ' ' + m + ' min' : '');
  if (m) return m + ' min' + (r && m < 5 ? ' ' + r + ' s' : '');
  return r + ' s';
}
function hash(x, y, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, sc, s) {
  const fx = x / sc, fy = y / sc, xi = Math.floor(fx), yi = Math.floor(fy), xf = fx - xi, yf = fy - yi;
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const icon = (id, cls = 'i') => `<svg class="${cls}"><use href="#i-${id}"/></svg>`;
const coin = n => `<span class="cr">${icon('coin', 'f')}${fmt(n)}</span>`;
const gem = n => `<span class="cr gem">${icon('gem', 'f')}${fmt(n)}</span>`;
const key = n => `<span class="cr key">${icon('key', 'f')}${fmt(n)}</span>`;
function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
