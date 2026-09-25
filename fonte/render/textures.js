// Texturas procedurais desenhadas em canvas (fachadas iluminadas, gramados, pisos, madeira, água).
import * as THREE from 'three';
import { hash, vnoise, fbm, clamp } from '../core/util.js';

const cache = new Map();
export function canvasTex(key, w, h, draw, o = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = o.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = o.aniso ?? 4;
  if (o.nearest) t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = o.mips !== false;
  if (o.mips === false) t.minFilter = THREE.LinearFilter;
  t.userData.canvas = c;
  cache.set(key, t);
  return t;
}
function noiseRect(g, w, h, base, amp, seed, cell = 2, sc = 18) {
  const img = g.createImageData(w, h); const d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    const n = (vnoise(cx, cy, sc / cell, seed) * 0.65 + hash(cx, cy, seed + 1) * 0.35 - 0.5) * amp;
    const i = (y * w + x) * 4;
    d[i] = clamp(base[0] + n, 0, 255); d[i + 1] = clamp(base[1] + n * 1.08, 0, 255); d[i + 2] = clamp(base[2] + n * 0.8, 0, 255); d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

// como noiseRect, mas periódico (textura quadrada que repete sem emenda): P células de ruído no lado
function noiseRectP(g, w, base, amp, seed, cell, P) {
  const img = g.createImageData(w, w); const d = img.data; const k = P / w;
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    const n = (pnoise(cx * cell * k, cy * cell * k, P, seed) * 0.65 + hash(cx, cy, seed + 1) * 0.35 - 0.5) * amp;
    const i = (y * w + x) * 4;
    d[i] = clamp(base[0] + n, 0, 255); d[i + 1] = clamp(base[1] + n * 1.08, 0, 255); d[i + 2] = clamp(base[2] + n * 0.8, 0, 255); d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
// ruído de valor periódico (período P células): texturas que repetem sem emenda
function pnoise(x, y, P, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const w = (v) => ((v % P) + P) % P;
  const a = hash(w(xi), w(yi), s), b = hash(w(xi + 1), w(yi), s), c = hash(w(xi), w(yi + 1), s), d = hash(w(xi + 1), w(yi + 1), s);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// desenha fn(x, y) e as cópias que atravessam a borda (textura sem emenda)
function envolve(w, h, x, y, r, fn) { for (const dx of [0, -w, w]) for (const dy of [0, -h, h]) if (x + dx > -r && x + dx < w + r && y + dy > -r && y + dy < h + r) fn(x + dx, y + dy); }
// mapa de normais (Sobel) a partir de uma altura por pixel, com borda periódica
function normalDeAltura(hgt, w, h, forca) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const img = g.createImageData(w, h), d = img.data; const H = (x, y) => hgt[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
    const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
    const nx = -dx * forca, ny = dy * forca, l = Math.hypot(nx, ny, 1); const i = (y * w + x) * 4;
    d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); return c;
}
function texDeCanvas(c, o = {}) {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = o.aniso ?? 4; t.userData.canvas = c; return t;
}

// Fachada: 32 vãos x 4 andares. Mapa de dia (paleta do BuildIt): vidro azul que reflete o céu (claro no alto
// de cada andar, com reflexo em diagonal), caixilhos brancos, peitoril claro e floreiras verdes. Emissivo de
// noite: faixas contínuas de luz âmbar interna, luminária no topo de cada vão e brilho variando devagar de um vão
// para o outro (as janelas acendem vão a vão no shader: materials.js). Os vãos coincidem nos dois mapas.
// estilo: 'quente' (moradias), 'lab' (laboratórios frios), 'escuro' (sede), 'madeira' (biblioteca),
// 'fita' (edifícios-fita em terraços: vidro recuado na sombra do beiral, com ripas de madeira escura a cada meio vão)
export function facadeTextures(style = 'quente') {
  const key = 'fac-' + style;
  if (cache.has(key)) return cache.get(key);
  const W = 1024, H = 256, bays = 32, floors = 4, bw = W / bays, fh = H / floors;
  const pal = {
    quente: { lit: [[255, 184, 92], [255, 200, 118], [250, 172, 84], [255, 214, 146]], dark: 0.03, gain: 1, v: [[168, 214, 244], [74, 138, 204]], frame: '#F7F5EF', mull: 2 },
    lab: { lit: [[236, 244, 255], [224, 236, 250], [255, 250, 240], [214, 230, 246]], dark: 0.04, gain: 0.95, v: [[186, 226, 246], [104, 164, 214]], frame: '#F4F6F8', mull: 2 },
    escuro: { lit: [[255, 222, 176], [230, 238, 250], [255, 232, 196]], dark: 0.1, gain: 0.8, v: [[128, 180, 226], [44, 96, 160]], frame: '#DCE3EA', mull: 1 },
    madeira: { lit: [[255, 190, 104], [255, 206, 132], [255, 180, 92]], dark: 0.04, gain: 1.05, v: [[176, 214, 238], [88, 142, 194]], frame: '#C9965C', mull: 5 },
    // vidro azul mais fundo (fica na sombra do beiral), caixilho claro e ripas escuras (#6b5a48) a cada meio vão
    fita: { lit: [[255, 184, 92], [255, 200, 118], [250, 172, 84], [255, 214, 146]], dark: 0.03, gain: 1, v: [[92, 150, 210], [40, 92, 156]], frame: '#EDE7DC', mull: 2, ripa: '#6b5a48', sombra: 0.42 },
  }[style];
  const seed = { quente: 11, lab: 23, escuro: 37, madeira: 41, fita: 53 }[style];
  const rgb = (c, k) => `rgb(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0})`;
  const dC = document.createElement('canvas'); dC.width = W; dC.height = H; const d = dC.getContext('2d');
  const emC = document.createElement('canvas'); emC.width = W; emC.height = H; const e = emC.getContext('2d');
  d.fillStyle = pal.frame; d.fillRect(0, 0, W, H); e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  for (let f = 0; f < floors; f++) {
    const y = f * fh, top = y + 7, bot = y + fh - 14;
    for (let b = 0; b < bays; b++) {
      const x = b * bw;
      // dia: vidro com o céu refletido
      const kv = 0.94 + vnoise(b, f * 7, 3, seed) * 0.1, a = pal.v[0], z = pal.v[1];
      const g1 = d.createLinearGradient(0, top, 0, bot); g1.addColorStop(0, rgb(a, kv)); g1.addColorStop(0.55, rgb([(a[0] + z[0]) / 2, (a[1] + z[1]) / 2, (a[2] + z[2]) / 2], kv)); g1.addColorStop(1, rgb(z, kv));
      d.fillStyle = g1; d.fillRect(x, top, bw, bot - top);
      if (hash(b, f, seed + 30) < 0.12) { d.fillStyle = 'rgba(250,244,230,0.55)'; d.fillRect(x, top, bw, (bot - top) * 0.38); } // persiana
      if (pal.sombra) { const gs = d.createLinearGradient(0, top, 0, top + (bot - top) * pal.sombra); gs.addColorStop(0, 'rgba(18,24,40,0.5)'); gs.addColorStop(1, 'rgba(18,24,40,0)'); d.fillStyle = gs; d.fillRect(x, top, bw, (bot - top) * pal.sombra); } // sombra do beiral
      else { d.fillStyle = 'rgba(255,255,255,0.22)'; d.beginPath(); d.moveTo(x + bw * 0.1, top); d.lineTo(x + bw * 0.55, top); d.lineTo(x + bw * 0.1, top + (bot - top) * 0.75); d.fill(); }
      // noite: sala acesa (luminária forte no forro, luz suave no resto) ou na penumbra
      const dark = hash(b, f, seed) < pal.dark;
      const c = pal.lit[(hash(b >> 1, f, seed + 3) * pal.lit.length) | 0], k = (0.62 + vnoise(b, f * 7, 3, seed) * 0.38) * pal.gain;
      const g2 = e.createLinearGradient(0, top, 0, bot); g2.addColorStop(0, rgb(c, dark ? 0.2 : k * 0.6)); g2.addColorStop(1, rgb(c, dark ? 0.12 : k * 0.3));
      e.fillStyle = g2; e.fillRect(x, top, bw, bot - top);
      if (!dark) { e.fillStyle = rgb(c, 1); e.fillRect(x, top, bw, 3); }
      // montantes
      d.fillStyle = pal.frame; d.fillRect(x, top, pal.mull, bot - top); e.fillStyle = '#000'; e.fillRect(x, top, pal.mull, bot - top);
      if (style === 'madeira') for (let q = 1; q < 3; q++) { d.fillRect(x + (bw * q) / 3, top, 3, bot - top); e.fillRect(x + (bw * q) / 3, top, 3, bot - top); }
      if (pal.ripa) { d.fillStyle = pal.ripa; e.fillStyle = '#000'; for (let q = 0; q < 2; q++) { const rx = x + (bw * (q + 0.5)) / 2 - 1; d.fillRect(rx, top, 2, bot - top); e.fillRect(rx, top, 2, bot - top); } } // ripas (brises)
    }
    // travessa superior (fundo branco), peitoril claro e floreiras
    e.fillStyle = '#000'; e.fillRect(0, y, W, 7);
    d.fillStyle = 'rgba(232,242,248,0.9)'; d.fillRect(0, bot, W, 9); e.fillStyle = 'rgba(0,0,0,0.6)'; e.fillRect(0, bot, W, 9);
    d.fillStyle = pal.frame; d.fillRect(0, bot + 9, W, 5); e.fillStyle = '#000'; e.fillRect(0, bot + 9, W, 5);
    for (let b = 0; b < bays * 3; b++) if (hash(b, f, seed + 20) < 0.42) { d.fillStyle = ['#4f9a3c', '#62ac46', '#3f8a34', '#76b850'][(hash(b, f, seed + 21) * 4) | 0]; d.beginPath(); d.ellipse(b * (bw / 3) + 5, bot + 1, 6, 5, 0, 0, 7); d.fill(); e.fillStyle = '#000'; e.beginPath(); e.ellipse(b * (bw / 3) + 5, bot + 1, 6, 5, 0, 0, 7); e.fill(); }
  }
  const mk = (c) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const out = { map: mk(dC), emissive: mk(emC), bays, floors };
  cache.set(key, out);
  return out;
}

export const tex = {
  concrete: () => canvasTex('concrete', 256, 256, (g, w, h) => noiseRectP(g, w, [234, 231, 222], 10, 61, 2, 9)),
  // cobertura verde de maquete: tufos com sombra e volume, poucas flores miúdas; o relevo sai do
  // mesmo desenho (Sobel) e vai no normalMap (tex.roofNormal)
  roof: () => {
    if (cache.has('roof')) return cache.get('roof');
    const w = 512, c = document.createElement('canvas'); c.width = c.height = w; const g = c.getContext('2d');
    noiseRectP(g, w, [70, 118, 48], 10, 21, 2, 13);
    // cobertura verde viva (na exposição o material puxa para o verde-oliva da foto, #554427 no Anel)
    const PAL = ['#5d9a3a', '#6cab42', '#4c8a33', '#7fb84a', '#8cbc52'];
    const tom = (hex, k) => { const n = parseInt(hex.slice(1), 16); return `rgb(${clamp(((n >> 16) & 255) * k, 0, 255) | 0},${clamp(((n >> 8) & 255) * k, 0, 255) | 0},${clamp((n & 255) * k, 0, 255) | 0})`; };
    // tufo = touceira de 3 a 5 bolotas sobrepostas (sombra primeiro, depois o volume)
    for (let i = 0; i < 1600; i++) {
      const x = hash(i, 1, 22) * w, y = hash(i, 2, 22) * w, r = 3 + hash(i, 3, 22) * 6, cor = PAL[(hash(i, 4, 22) * PAL.length) | 0];
      const nb = 3 + ((hash(i, 5, 22) * 3) | 0), bs = []; for (let k = 0; k < nb; k++) { const a = hash(i, 10 + k, 22) * 6.28, d = r * 0.45 * hash(i, 20 + k, 22); bs.push([Math.cos(a) * d, Math.sin(a) * d * 0.8, r * (0.5 + 0.3 * hash(i, 30 + k, 22))]); }
      envolve(w, w, x, y, r + 3, (px, py) => {
        g.fillStyle = 'rgba(20,52,16,.26)'; for (const [dx, dy, rr] of bs) { g.beginPath(); g.arc(px + dx + 1.5, py + dy + 1.5, rr, 0, 7); g.fill(); }
        for (const [dx, dy, rr] of bs) { const cx = px + dx, cy = py + dy; const gr = g.createRadialGradient(cx - rr * 0.3, cy - rr * 0.3, 0, cx, cy, rr); gr.addColorStop(0, tom(cor, 1.07)); gr.addColorStop(1, tom(cor, 0.84)); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.fill(); }
      });
    }
    // altura para o relevo: luminância dos tufos (centro claro = alto, sombra = baixo)
    const px = g.getImageData(0, 0, w, w).data; const hgt = new Float32Array(w * w);
    for (let i = 0; i < w * w; i++) hgt[i] = (px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11) / 255;
    cache.set('roofN', texDeCanvas(normalDeAltura(hgt, w, w, 2.2), { linear: true }));
    for (let i = 0; i < 250; i++) { const x = hash(i, 5, 23) * w, y = hash(i, 6, 23) * w, r = 1 + hash(i, 7, 23) * 0.8; g.fillStyle = ['rgba(236,150,178,.6)', 'rgba(248,222,110,.6)', 'rgba(250,248,240,.6)'][(hash(i, 8, 23) * 3) | 0]; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    const t = texDeCanvas(c); cache.set('roof', t); return t;
  },
  roofNormal: () => { tex.roof(); return cache.get('roofN'); },
  // macro-variação (manchas de baixa frequência), amostrada em mundo a 1/23 por unidade
  macro: () => canvasTex('macro', 256, 256, (g, w, h) => {
    const img = g.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = pnoise(x / 64, y / 64, 4, 131) * 0.6 + pnoise(x / 32, y / 32, 8, 137) * 0.3 + pnoise(x / 16, y / 16, 16, 139) * 0.1; const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = clamp(v * 255, 0, 255); d[i + 3] = 255; }
    g.putImageData(img, 0, 0);
  }, { linear: true }),
  // grama limpa e viva (pouco ruído: sem manchas de longe)
  grass: () => canvasTex('grass', 512, 512, (g, w, h) => {
    noiseRectP(g, w, [116, 138, 60], 12, 31, 2, 21);
    for (let i = 0; i < 1600; i++) { const x = hash(i, 1, 33) * w, y = hash(i, 2, 33) * h; g.fillStyle = hash(i, 3, 33) < 0.5 ? 'rgba(60,96,30,.16)' : 'rgba(214,230,150,.14)'; g.fillRect(x, y, 1 + hash(i, 4, 33) * 2, 1 + hash(i, 5, 33) * 3); }
  }),
  // pasto degradado (antes da obra): capim seco amarelado, com manchas suaves
  pasto: () => canvasTex('pasto', 512, 512, (g, w, h) => {
    noiseRectP(g, w, [160, 162, 98], 14, 57, 2, 18);
    for (let i = 0; i < 70; i++) { const x = hash(i, 1, 58) * w, y = hash(i, 2, 58) * h, r = 6 + hash(i, 3, 58) * 26; g.fillStyle = `rgba(${176 + hash(i, 4, 58) * 20},${150 + hash(i, 5, 58) * 14},${92},0.22)`; envolve(w, h, x, y, r, (px, py) => { g.beginPath(); g.ellipse(px, py, r, r * 0.7, hash(i, 6, 58) * 3, 0, 7); g.fill(); }); }
    for (let i = 0; i < 1400; i++) { const x = hash(i, 7, 58) * w, y = hash(i, 8, 58) * h; g.fillStyle = hash(i, 9, 58) < 0.5 ? 'rgba(110,130,60,.22)' : 'rgba(210,190,120,.18)'; g.fillRect(x, y, 1 + hash(i, 10, 58) * 2, 2 + hash(i, 11, 58) * 3); }
  }),
  forestFloor: () => canvasTex('forest', 512, 512, (g, w, h) => noiseRectP(g, w, [66, 94, 40], 16, 35, 2, 13)),
  pavers: () => canvasTex('pavers', 512, 512, (g, w, h) => {
    noiseRectP(g, w, [228, 222, 208], 8, 51, 2, 26);
    g.strokeStyle = 'rgba(130,110,90,.14)'; g.lineWidth = 1.2;
    for (let y = 0; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); const off = (y / 16) % 2 ? 16 : 0; for (let x = off; x < w; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); } }
    for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(${hash(i, 1, 52) < 0.5 ? '255,250,238' : '150,130,110'},.07)`; g.fillRect(((hash(i, 2, 52) * 32) | 0) * 16, ((hash(i, 3, 52) * 32) | 0) * 16, 32, 16); }
  }),
  sand: () => canvasTex('sand', 256, 256, (g, w, h) => {
    noiseRectP(g, w, [238, 218, 170], 12, 41, 2, 12);
    for (let i = 0; i < 300; i++) { g.fillStyle = hash(i, 1, 42) < 0.5 ? 'rgba(150,170,90,.14)' : 'rgba(190,160,110,.16)'; g.fillRect(hash(i, 2, 42) * w, hash(i, 3, 42) * h, 2, 2 + hash(i, 4, 42) * 3); }
  }),
  // terra batida pardo-acinzentada (não alaranjada): grão fino, sem manchas grandes, com pares de
  // marcas de pneu em arco
  soil: () => canvasTex('soil', 256, 256, (g, w, h) => {
    noiseRectP(g, w, [110, 94, 78], 18, 81, 1, 43);
    g.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const cx = hash(i, 1, 82) * w, cy = hash(i, 2, 82) * h, R = 60 + hash(i, 3, 82) * 90, a0 = hash(i, 4, 82) * 6.28, da = 0.6 + hash(i, 5, 82) * 0.9;
      for (const dr of [0, 11]) envolve(w, h, cx, cy, R + 20, (x, y) => { g.strokeStyle = 'rgba(66,54,42,.25)'; g.lineWidth = 3.8; g.beginPath(); g.arc(x, y, R + dr, a0, a0 + da); g.stroke(); g.strokeStyle = 'rgba(160,144,120,.14)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, R + dr + 2.4, a0, a0 + da); g.stroke(); });
    }
  }),
  // arenito cinza-bege com estratos horizontais
  rock: () => canvasTex('rock', 256, 256, (g, w, h) => {
    noiseRectP(g, w, [150, 138, 118], 30, 91, 2, 16);
    for (let y = 4; y < h; y += 16 + ((hash(y, 1, 95) * 14) | 0)) { g.fillStyle = 'rgba(128,116,98,.85)'; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.0245 * 2 + y) * 2); for (let x = w; x >= 0; x -= 16) g.lineTo(x, y + 6 + Math.sin(x * 0.0245 * 2 + y) * 2); g.closePath(); g.fill(); }
    g.strokeStyle = 'rgba(60,50,38,.3)'; g.lineWidth = 1.5; for (let i = 0; i < 18; i++) { g.beginPath(); let x = hash(i, 1, 92) * w, y = hash(i, 2, 92) * h; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (hash(i, k, 93) - 0.5) * 30; y += hash(i, k, 94) * 18; g.lineTo(x, y); } g.stroke(); }
  }),
  wood: () => canvasTex('wood', 512, 128, (g, w, h) => {
    noiseRect(g, w, h, [150, 102, 62], 30, 71, 2, 30);
    g.fillStyle = 'rgba(70,40,18,.28)'; for (let i = 0; i < 70; i++) { const y = hash(i, 1, 72) * h; g.fillRect(0, y, w, 1 + hash(i, 2, 72) * 2); }
    g.fillStyle = 'rgba(255,220,170,.10)'; for (let i = 0; i < 40; i++) g.fillRect(0, hash(i, 3, 72) * h, w, 1);
  }),
  // veio claro e quase neutro para a madeira estrutural (a cor vem do material): fibras ao longo de v
  veio: () => canvasTex('veio', 64, 256, (g, w, h) => {
    g.fillStyle = '#f2ece4'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { const x = hash(i, 1, 98) * w; g.fillStyle = hash(i, 2, 98) < 0.6 ? 'rgba(120,84,50,.16)' : 'rgba(255,250,240,.2)'; g.fillRect(x, 0, 0.8 + hash(i, 3, 98) * 1.6, h); }
    for (let i = 0; i < 5; i++) { const y = hash(i, 4, 98) * h; g.fillStyle = 'rgba(110,76,44,.12)'; g.beginPath(); g.ellipse(hash(i, 5, 98) * w, y, 3, 9, 0, 0, 7); g.fill(); }
  }),
  woodLight: () => canvasTex('woodl', 256, 64, (g, w, h) => {
    noiseRect(g, w, h, [205, 160, 106], 22, 73, 2, 26);
    g.fillStyle = 'rgba(120,80,40,.22)'; for (let i = 0; i < 30; i++) g.fillRect(0, hash(i, 1, 74) * h, w, 1);
  }),
  lattice: () => canvasTex('lattice', 256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#E8C48A'; g.lineWidth = 6; const n = 4;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo((i * w) / n, 0); g.lineTo((i * w) / n, h); g.stroke(); g.beginPath(); g.moveTo(0, (i * h) / n); g.lineTo(w, (i * h) / n); g.stroke(); }
    g.lineWidth = 3; g.strokeStyle = '#D9AE6E'; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.beginPath(); g.moveTo((i * w) / n, (j * h) / n); g.lineTo(((i + 1) * w) / n, ((j + 1) * h) / n); g.stroke(); }
  }, { aniso: 8 }),
  canopyGrid: () => canvasTex('canopy', 512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const n = 12; g.strokeStyle = 'rgba(228,198,150,1)'; g.lineWidth = 5; // madeira clara do dossel
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo((i * w) / n, 0); g.lineTo((i * w) / n, h); g.stroke(); g.beginPath(); g.moveTo(0, (i * h) / n); g.lineTo(w, (i * h) / n); g.stroke(); }
    g.lineWidth = 2; g.strokeStyle = 'rgba(206,170,118,.9)'; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const x = (i * w) / n, y = (j * h) / n, s = w / n; g.beginPath(); g.moveTo(x, y + s / 2); g.lineTo(x + s, y + s / 2); g.moveTo(x + s / 2, y); g.lineTo(x + s / 2, y + s); g.stroke(); }
  }, { aniso: 8 }),
  mesh: () => canvasTex('mesh', 128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(235,238,240,.95)'; g.lineWidth = 2;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo((i * w) / 8, 0); g.lineTo((i * w) / 8, h); g.stroke(); g.beginPath(); g.moveTo(0, (i * h) / 8); g.lineTo(w, (i * h) / 8); g.stroke(); }
  }),
  field: () => canvasTex('field', 512, 320, (g, w, h) => {
    noiseRect(g, w, h, [86, 170, 70], 10, 95, 2, 30);
    g.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i < 10; i += 2) g.fillRect((i * w) / 10, 0, w / 10, h);
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 4; g.strokeRect(14, 14, w - 28, h - 28);
    g.beginPath(); g.moveTo(w / 2, 14); g.lineTo(w / 2, h - 14); g.stroke(); g.beginPath(); g.arc(w / 2, h / 2, 40, 0, 7); g.stroke();
    g.strokeRect(14, h / 2 - 70, 70, 140); g.strokeRect(w - 84, h / 2 - 70, 70, 140); g.strokeRect(14, h / 2 - 30, 26, 60); g.strokeRect(w - 40, h / 2 - 30, 26, 60);
  }, { aniso: 8 }),
  track: () => canvasTex('track', 256, 64, (g, w, h) => { g.fillStyle = '#B55A3C'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, (i * h) / 4); g.lineTo(w, (i * h) / 4); g.stroke(); } }),
  stripes: () => canvasTex('stripes', 64, 64, (g, w, h) => { g.fillStyle = '#F4F1EA'; g.fillRect(0, 0, w, h); g.fillStyle = '#E8742F'; for (let i = -1; i < 5; i++) { g.beginPath(); g.moveTo(i * 24, h); g.lineTo(i * 24 + 12, h); g.lineTo(i * 24 + 12 + h, 0); g.lineTo(i * 24 + h, 0); g.closePath(); g.fill(); } }),
  waterNormal: () => canvasTex('wnorm', 256, 256, (g, w, h) => {
    const img = g.createImageData(w, h), d = img.data;
    const hgt = (x, y) => fbm(x, y, 22, 7, 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = hgt((x + 1) % w, y) - hgt((x - 1 + w) % w, y), dy = hgt(x, (y + 1) % h) - hgt(x, (y - 1 + h) % h);
      const nx = -dx * 6, ny = -dy * 6, nz = 1; const l = Math.hypot(nx, ny, nz); const i = (y * w + x) * 4;
      d[i] = ((nx / l) * 0.5 + 0.5) * 255; d[i + 1] = ((ny / l) * 0.5 + 0.5) * 255; d[i + 2] = ((nz / l) * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { linear: true }),
};

// ---------------------------------------------------------------- arredores
// Copas da mata vista de longe (morros e manchas de mata dos arredores): copas redondas em verdes variados,
// sem emenda; o relevo das copas (tex.copasN) acompanha o sol e a lua
tex.copas = () => {
  if (cache.has('copas')) return cache.get('copas');
  const w = 512, c = document.createElement('canvas'); c.width = c.height = w; const g = c.getContext('2d');
  g.fillStyle = '#2f6326'; g.fillRect(0, 0, w, w);
  const PAL = ['#3f7f2c', '#4a8c34', '#5a9a3a', '#356f28', '#6aa644', '#2f6a30', '#78aa3c', '#4f9444'];
  const tom = (hex, k) => { const n = parseInt(hex.slice(1), 16); return `rgb(${clamp(((n >> 16) & 255) * k, 0, 255) | 0},${clamp(((n >> 8) & 255) * k, 0, 255) | 0},${clamp((n & 255) * k, 0, 255) | 0})`; };
  for (let i = 0; i < 760; i++) {
    const x = hash(i, 1, 331) * w, y = hash(i, 2, 331) * w, r = 10 + hash(i, 3, 331) * 13, cor = PAL[(hash(i, 4, 331) * PAL.length) | 0];
    envolve(w, w, x, y, r + 4, (px, py) => {
      g.fillStyle = 'rgba(16,40,12,.35)'; g.beginPath(); g.arc(px + 2.5, py + 2.5, r, 0, 7); g.fill();
      const gr = g.createRadialGradient(px - r * 0.3, py - r * 0.3, 0, px, py, r); gr.addColorStop(0, tom(cor, 1.18)); gr.addColorStop(0.7, tom(cor, 0.95)); gr.addColorStop(1, tom(cor, 0.78));
      g.fillStyle = gr; g.beginPath(); g.arc(px, py, r, 0, 7); g.fill();
    });
  }
  const px = g.getImageData(0, 0, w, w).data; const hgt = new Float32Array(w * w);
  for (let i = 0; i < w * w; i++) hgt[i] = (px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11) / 255;
  cache.set('copasN', texDeCanvas(normalDeAltura(hgt, w, w, 1.6), { linear: true }));
  const t = texDeCanvas(c); cache.set('copas', t); return t;
};
tex.copasN = () => { tex.copas(); return cache.get('copasN'); };
// nuvem de algodão para os arredores: luminância (miolo claro, base mais escura) no vermelho e forma no alfa
tex.nuvem = () => canvasTex('nuvem', 256, 160, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  const bolas = []; for (let i = 0; i < 16; i++) { const a = hash(i, 1, 341), x = w * (0.18 + 0.64 * a), r = h * (0.16 + 0.2 * Math.sin(a * Math.PI) * (0.7 + 0.5 * hash(i, 2, 341))); bolas.push([x, h * 0.62 - r * (0.5 + 0.5 * hash(i, 3, 341)), r]); }
  bolas.push([w * 0.5, h * 0.66, h * 0.16], [w * 0.32, h * 0.7, h * 0.12], [w * 0.68, h * 0.7, h * 0.12]);
  for (const [x, y, r] of bolas) {
    const gr = g.createRadialGradient(x - r * 0.25, y - r * 0.35, r * 0.1, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.75, `rgba(${Math.round(150 + 90 * (1 - y / h))},0,0,0.95)`); gr.addColorStop(1, 'rgba(120,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
}, { clamp: true, linear: true });
