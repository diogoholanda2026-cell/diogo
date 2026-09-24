// Utilidades gerais: matemática, ruído determinístico, formatação e DOM.
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const smoothstep = (a, b, x) => smooth(clamp((x - a) / (b - a), 0, 1));
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
// curvas de animação (t de 0 a 1)
export const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t) => t * t * t;
export const easeInQuad = (t) => t * t;
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutBack = (t, s = 1.70158) => { const u = t - 1; return 1 + (s + 1) * u * u * u + s * u * u; };
export function easeOutBounce(t) {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375;
}
// fatia de 0 a 1 de um intervalo [a, b] (tempo local de uma etapa da animação)
export const fatia = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
// mola amortecida (semi-implícita) no estado s = {x, v}, rumo a alvo; omega em rad/s, zeta 1 = crítica
export function mola(s, alvo, omega, zeta, dt) {
  const n = Math.max(1, Math.ceil(dt / 0.012)), h = dt / n;
  for (let i = 0; i < n; i++) { s.v += (-omega * omega * (s.x - alvo) - 2 * zeta * omega * s.v) * h; s.x += s.v * h; }
  return s.x;
}
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function hash(x, y = 0, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function vnoise(x, y, sc = 1, s = 0) {
  const fx = x / sc, fy = y / sc, xi = Math.floor(fx), yi = Math.floor(fy), xf = fx - xi, yf = fy - yi;
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, sc = 1, s = 0, oct = 4) {
  let v = 0, amp = 0.5, f = 1, tot = 0;
  for (let i = 0; i < oct; i++) { v += vnoise(x * f, y * f, sc, s + i * 17) * amp; tot += amp; amp *= 0.5; f *= 2.03; }
  return v / tot;
}
// gerador pseudoaleatório com semente (mulberry32)
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function fmt(n) {
  n = Math.floor(n); const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2).replace('.', ',') + ' bi';
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2).replace('.', ',') + ' mi';
  if (a >= 1e5) return Math.round(n / 1e3) + ' mil';
  return n.toLocaleString('pt-BR');
}
export function dur(s) {
  s = Math.max(0, Math.ceil(s));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  if (d) return d + ' d' + (h ? ' ' + h + ' h' : '');
  if (h) return h + ' h' + (m ? ' ' + m + ' min' : '');
  if (m) return m + ' min' + (r && m < 10 ? ' ' + r + ' s' : '');
  return r + ' s';
}
export function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
// ponto dentro de polígono (x,z)
export function inPoly(x, z, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}
export function inEllipse(x, z, cx, cz, rx, rz, rot = 0) {
  const c = Math.cos(-rot), s = Math.sin(-rot); const dx = x - cx, dz = z - cz;
  const u = dx * c - dz * s, v = dx * s + dz * c;
  return (u * u) / (rx * rx) + (v * v) / (rz * rz) <= 1;
}
export const now = () => performance.now();
