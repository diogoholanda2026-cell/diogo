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

// Fachada: 32 vãos x 4 andares. mapa (vidro) + emissivo (luzes internas).
// estilo: 'quente' (moradias), 'lab' (laboratórios frios), 'escuro' (sede), 'madeira' (biblioteca)
export function facadeTextures(style = 'quente') {
  const key = 'fac-' + style;
  if (cache.has(key)) return cache.get(key);
  // faixas contínuas de luz âmbar interna (como na maquete da foto): montantes finos, luminária no
  // topo de cada vão, brilho variando devagar de um vão para o outro. Não há vão preto: a sala
  // apagada é penumbra (moradias e laboratórios) ou vidro refletindo o céu (sede).
  const W = 1024, H = 256, bays = 32, floors = 4, bw = W / bays, fh = H / floors;
  const pal = {
    quente: { glass: [36, 38, 44], lit: [[255, 196, 120], [255, 210, 150], [250, 186, 110], [255, 224, 176]], dark: 0.03, frame: '#EEEAE0', mull: 2, gain: 1 },
    lab: { glass: [44, 50, 58], lit: [[236, 244, 255], [224, 236, 250], [255, 250, 240], [214, 230, 246]], dark: 0.04, frame: '#EDF0F3', mull: 2, gain: 0.95 },
    escuro: { glass: [44, 54, 68], lit: [[255, 222, 176], [230, 238, 250], [255, 232, 196]], dark: 0.1, frame: '#C6CED6', mull: 1, gain: 0.8, ceu: true },
    madeira: { glass: [92, 64, 40], lit: [[255, 200, 128], [255, 214, 150], [255, 190, 110]], dark: 0.04, frame: '#C9965C', mull: 5, gain: 1.05 },
  }[style];
  const mapC = document.createElement('canvas'); mapC.width = W; mapC.height = H;
  const emC = document.createElement('canvas'); emC.width = W; emC.height = H;
  const m = mapC.getContext('2d'), e = emC.getContext('2d');
  m.fillStyle = `rgb(${pal.glass.join(',')})`; m.fillRect(0, 0, W, H);
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  const seed = { quente: 11, lab: 23, escuro: 37, madeira: 41 }[style];
  const rgb = (c, k) => `rgb(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0})`;
  const PEN = [110, 100, 96];
  for (let f = 0; f < floors; f++) {
    const y = f * fh, top = y + 7, bot = y + fh - 14;
    for (let b = 0; b < bays; b++) {
      const x = b * bw; const dark = hash(b, f, seed) < pal.dark;
      let c = pal.lit[(hash(b >> 1, f, seed + 3) * pal.lit.length) | 0];
      let k = (0.62 + vnoise(b, f * 7, 3, seed) * 0.38) * pal.gain;
      if (dark && pal.ceu) {
        // sede: vidro apagado reflete o céu; atrás dele, a sala na penumbra
        const g0 = m.createLinearGradient(0, top, 0, bot); g0.addColorStop(0, 'rgb(128,146,160)'); g0.addColorStop(1, 'rgb(64,72,82)'); m.fillStyle = g0; m.fillRect(x, top, bw, bot - top);
        m.fillStyle = 'rgba(220,232,244,0.18)'; m.beginPath(); m.moveTo(x, top); m.lineTo(x + bw * 0.6, top); m.lineTo(x, top + (bot - top) * 0.8); m.fill();
        e.fillStyle = rgb(c, 0.22); e.fillRect(x, top, bw, bot - top);
      } else {
        // interior visto pelo vidro: tom neutro e quente, mais escuro que a luz; a cor âmbar vem do
        // emissivo, forte na luminária do forro e suave no resto da sala. Sala apagada = penumbra.
        if (dark) { c = [(PEN[0] + c[0]) / 2, (PEN[1] + c[1]) / 2, (PEN[2] + c[2]) / 2]; k = 0.32; } // sala na penumbra, não buraco
        const cm = [c[0] * 0.45 + 118 * 0.55, c[1] * 0.45 + 112 * 0.55, c[2] * 0.45 + 106 * 0.55];
        const g1 = m.createLinearGradient(0, top, 0, bot); g1.addColorStop(0, rgb(cm, dark ? 0.75 : 0.5 + k * 0.25)); g1.addColorStop(1, rgb(cm, dark ? 0.5 : 0.32 + k * 0.2));
        m.fillStyle = g1; m.fillRect(x, top, bw, bot - top);
        const g2 = e.createLinearGradient(0, top, 0, bot); g2.addColorStop(0, rgb(c, dark ? 0.42 : k * 0.6)); g2.addColorStop(1, rgb(c, dark ? 0.25 : k * 0.3));
        e.fillStyle = g2; e.fillRect(x, top, bw, bot - top);
        if (!dark) {
          // luminária linear no forro
          m.fillStyle = rgb(c, 1); m.fillRect(x, top, bw, 3); e.fillStyle = rgb(c, 1); e.fillRect(x, top, bw, 3);
          // mobiliário e gente só como manchas suaves no difuso (sem bonecos)
          const n = hash(b, f, seed + 9) < 0.55 ? 2 + ((hash(b, f, seed + 11) * 2) | 0) : 0;
          for (let i = 0; i < n; i++) { m.fillStyle = 'rgba(40,28,18,0.15)'; m.fillRect(x + 4 + hash(b * 3 + i, f, seed + 10) * (bw - 10), bot - 14, 3, 14); }
          if (hash(b, f, seed + 12) < 0.25) { m.fillStyle = 'rgba(40,28,18,0.12)'; m.fillRect(x + 3, bot - 9, bw - 6, 3); }
        }
      }
      // reflexo do céu em diagonal
      m.fillStyle = 'rgba(200,220,240,0.07)'; m.beginPath(); m.moveTo(x, top); m.lineTo(x + bw * 0.5, top); m.lineTo(x, top + (bot - top) * 0.7); m.fill();
      // montantes
      m.fillStyle = pal.frame; m.fillRect(x, top, pal.mull, bot - top); e.fillStyle = '#000'; e.fillRect(x, top, pal.mull, bot - top);
      if (style === 'madeira') for (let q = 1; q < 3; q++) { m.fillRect(x + (bw * q) / 3, top, 3, bot - top); e.fillRect(x + (bw * q) / 3, top, 3, bot - top); }
    }
    // travessa superior, peitoril de vidro e floreiras
    m.fillStyle = pal.frame; m.fillRect(0, y, W, 7); e.fillStyle = '#000'; e.fillRect(0, y, W, 7);
    m.fillStyle = 'rgba(225,236,244,0.55)'; m.fillRect(0, bot, W, 9); e.fillStyle = 'rgba(0,0,0,0.6)'; e.fillRect(0, bot, W, 9);
    m.fillStyle = pal.frame; m.fillRect(0, bot + 9, W, 5); e.fillStyle = '#000'; e.fillRect(0, bot + 9, W, 5);
    for (let b = 0; b < bays * 3; b++) if (hash(b, f, seed + 20) < 0.42) { m.fillStyle = ['#3E7A3A', '#4E8C42', '#2F6630', '#5E9A48'][(hash(b, f, seed + 21) * 4) | 0]; m.beginPath(); m.ellipse(b * (bw / 3) + 5, bot + 1, 6, 5, 0, 0, 7); m.fill(); e.fillStyle = '#000'; e.beginPath(); e.ellipse(b * (bw / 3) + 5, bot + 1, 6, 5, 0, 0, 7); e.fill(); }
  }
  const mk = (c) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const out = { map: mk(mapC), emissive: mk(emC), bays, floors };
  cache.set(key, out);
  return out;
}

// texto e moldura gravados da placa da mesa (desenhados iguais na cor e no mapa de metal/rugosidade):
// título em caixa-alta grossa e três linhas curtas de corpo, grandes o bastante para ler na vista da foto
function placa(g, w, h, cor) {
  g.strokeStyle = cor; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28); g.lineWidth = 2; g.strokeRect(26, 26, w - 52, h - 52);
  g.fillStyle = cor; g.textAlign = 'center'; g.lineJoin = 'round';
  const escreve = (txt, y, fs, peso, borda) => { g.font = `${peso} ${fs}px sans-serif`; while (g.measureText(txt).width > w - 120 && fs > 20) { fs -= 1; g.font = `${peso} ${fs}px sans-serif`; } g.fillText(txt, w / 2, y); if (borda) { g.lineWidth = borda; g.strokeText(txt, w / 2, y); } };
  escreve('COMPOSIÇÃO TOTAL DA ARCOLOGIA DE HELD', 96, 64, 800, 2);
  ['Ciência, educação e conservação numa só arcologia sustentável:', 'campus, biblioteca, acelerador, santuário e bioma aquático', 'ligados por passarelas verdes, com energia solar e reuso de água.'].forEach((l, i) => escreve(l, 166 + i * 50, 38, 700, 0.8));
}

export const tex = {
  concrete: () => canvasTex('concrete', 256, 256, (g, w, h) => noiseRectP(g, w, [234, 231, 222], 10, 61, 2, 9)),
  // cobertura verde de maquete: tufos com sombra e volume, poucas flores miúdas; o relevo sai do
  // mesmo desenho (Sobel) e vai no normalMap (tex.roofNormal)
  roof: () => {
    if (cache.has('roof')) return cache.get('roof');
    const w = 512, c = document.createElement('canvas'); c.width = c.height = w; const g = c.getContext('2d');
    noiseRectP(g, w, [76, 74, 48], 14, 21, 2, 13);
    // verde-oliva de maquete (medido na foto: #554427 no telhado do Anel)
    const PAL = ['#67733f', '#737d44', '#526236', '#7f8249', '#857a46'];
    const tom = (hex, k) => { const n = parseInt(hex.slice(1), 16); return `rgb(${clamp(((n >> 16) & 255) * k, 0, 255) | 0},${clamp(((n >> 8) & 255) * k, 0, 255) | 0},${clamp((n & 255) * k, 0, 255) | 0})`; };
    // tufo = touceira de 3 a 5 bolotas sobrepostas (sombra primeiro, depois o volume)
    for (let i = 0; i < 1600; i++) {
      const x = hash(i, 1, 22) * w, y = hash(i, 2, 22) * w, r = 3 + hash(i, 3, 22) * 6, cor = PAL[(hash(i, 4, 22) * PAL.length) | 0];
      const nb = 3 + ((hash(i, 5, 22) * 3) | 0), bs = []; for (let k = 0; k < nb; k++) { const a = hash(i, 10 + k, 22) * 6.28, d = r * 0.45 * hash(i, 20 + k, 22); bs.push([Math.cos(a) * d, Math.sin(a) * d * 0.8, r * (0.5 + 0.3 * hash(i, 30 + k, 22))]); }
      envolve(w, w, x, y, r + 3, (px, py) => {
        g.fillStyle = 'rgba(15,30,10,.3)'; for (const [dx, dy, rr] of bs) { g.beginPath(); g.arc(px + dx + 1.5, py + dy + 1.5, rr, 0, 7); g.fill(); }
        for (const [dx, dy, rr] of bs) { const cx = px + dx, cy = py + dy; const gr = g.createRadialGradient(cx - rr * 0.3, cy - rr * 0.3, 0, cx, cy, rr); gr.addColorStop(0, tom(cor, 1.07)); gr.addColorStop(1, tom(cor, 0.84)); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.fill(); }
      });
    }
    // altura para o relevo: luminância dos tufos (centro claro = alto, sombra = baixo)
    const px = g.getImageData(0, 0, w, w).data; const hgt = new Float32Array(w * w);
    for (let i = 0; i < w * w; i++) hgt[i] = (px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11) / 255;
    cache.set('roofN', texDeCanvas(normalDeAltura(hgt, w, w, 2.2), { linear: true }));
    for (let i = 0; i < 250; i++) { const x = hash(i, 5, 23) * w, y = hash(i, 6, 23) * w, r = 1 + hash(i, 7, 23) * 0.8; g.fillStyle = ['rgba(216,180,188,.5)', 'rgba(230,214,144,.5)', 'rgba(242,239,230,.5)'][(hash(i, 8, 23) * 3) | 0]; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    const t = texDeCanvas(c); cache.set('roof', t); return t;
  },
  roofNormal: () => { tex.roof(); return cache.get('roofN'); },
  // macro-variação (manchas de baixa frequência), amostrada em mundo a 1/23 por unidade
  macro: () => canvasTex('macro', 256, 256, (g, w, h) => {
    const img = g.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = pnoise(x / 64, y / 64, 4, 131) * 0.6 + pnoise(x / 32, y / 32, 8, 137) * 0.3 + pnoise(x / 16, y / 16, 16, 139) * 0.1; const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = clamp(v * 255, 0, 255); d[i + 3] = 255; }
    g.putImageData(img, 0, 0);
  }, { linear: true }),
  grass: () => canvasTex('grass', 512, 512, (g, w, h) => {
    noiseRectP(g, w, [60, 92, 46], 24, 31, 2, 21);
    for (let i = 0; i < 5000; i++) { const x = hash(i, 1, 33) * w, y = hash(i, 2, 33) * h; g.fillStyle = hash(i, 3, 33) < 0.5 ? 'rgba(20,55,20,.28)' : 'rgba(150,200,110,.18)'; g.fillRect(x, y, 1 + hash(i, 4, 33) * 2, 1 + hash(i, 5, 33) * 3); }
  }),
  pasto: () => canvasTex('pasto', 512, 512, (g, w, h) => {
    noiseRectP(g, w, [100, 102, 66], 22, 57, 2, 18);
    for (let i = 0; i < 90; i++) { const x = hash(i, 1, 58) * w, y = hash(i, 2, 58) * h, r = 6 + hash(i, 3, 58) * 26; g.fillStyle = `rgba(${112 + hash(i, 4, 58) * 20},${96 + hash(i, 5, 58) * 14},${64},0.32)`; envolve(w, h, x, y, r, (px, py) => { g.beginPath(); g.ellipse(px, py, r, r * 0.7, hash(i, 6, 58) * 3, 0, 7); g.fill(); }); }
    for (let i = 0; i < 2600; i++) { const x = hash(i, 7, 58) * w, y = hash(i, 8, 58) * h; g.fillStyle = hash(i, 9, 58) < 0.5 ? 'rgba(80,90,40,.35)' : 'rgba(170,150,90,.25)'; g.fillRect(x, y, 1 + hash(i, 10, 58) * 2, 2 + hash(i, 11, 58) * 3); }
  }),
  forestFloor: () => canvasTex('forest', 512, 512, (g, w, h) => noiseRectP(g, w, [40, 62, 34], 28, 35, 2, 13)),
  pavers: () => canvasTex('pavers', 512, 512, (g, w, h) => {
    noiseRectP(g, w, [200, 186, 164], 16, 51, 2, 26);
    g.strokeStyle = 'rgba(90,70,50,.18)'; g.lineWidth = 1.2;
    for (let y = 0; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); const off = (y / 16) % 2 ? 16 : 0; for (let x = off; x < w; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); } }
    for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(${hash(i, 1, 52) < 0.5 ? '255,245,225' : '120,100,80'},.10)`; g.fillRect(((hash(i, 2, 52) * 32) | 0) * 16, ((hash(i, 3, 52) * 32) | 0) * 16, 32, 16); }
  }),
  sand: () => canvasTex('sand', 256, 256, (g, w, h) => {
    noiseRectP(g, w, [196, 170, 120], 26, 41, 2, 12);
    for (let i = 0; i < 600; i++) { g.fillStyle = hash(i, 1, 42) < 0.5 ? 'rgba(120,140,60,.35)' : 'rgba(150,120,80,.3)'; g.fillRect(hash(i, 2, 42) * w, hash(i, 3, 42) * h, 2, 2 + hash(i, 4, 42) * 3); }
  }),
  // terra batida: grão fino, sem manchas grandes, com pares de marcas de pneu em arco
  soil: () => canvasTex('soil', 256, 256, (g, w, h) => {
    noiseRectP(g, w, [120, 92, 66], 20, 81, 1, 43);
    g.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const cx = hash(i, 1, 82) * w, cy = hash(i, 2, 82) * h, R = 60 + hash(i, 3, 82) * 90, a0 = hash(i, 4, 82) * 6.28, da = 0.6 + hash(i, 5, 82) * 0.9;
      for (const dr of [0, 11]) envolve(w, h, cx, cy, R + 20, (x, y) => { g.strokeStyle = 'rgba(70,50,34,.25)'; g.lineWidth = 3.8; g.beginPath(); g.arc(x, y, R + dr, a0, a0 + da); g.stroke(); g.strokeStyle = 'rgba(170,140,104,.14)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, R + dr + 2.4, a0, a0 + da); g.stroke(); });
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
  nogueira: () => canvasTex('nogueira', 1024, 256, (g, w, h) => {
    noiseRect(g, w, h, [98, 88, 82], 14, 75, 2, 60);
    for (let i = 0; i < 140; i++) { const y = hash(i, 1, 76) * h; const a = 0.08 + hash(i, 2, 76) * 0.18; g.strokeStyle = `rgba(46,32,24,${a * 1.4})`; g.lineWidth = 0.6 + hash(i, 3, 76) * 2.2; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 3 + (vnoise(x, i, 40, 77) - 0.5) * 6); g.stroke(); }
    g.fillStyle = 'rgba(255,225,190,.07)'; for (let i = 0; i < 40; i++) g.fillRect(0, hash(i, 4, 76) * h, w, 1.5);
  }, { aniso: 8 }),
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
    const n = 12; g.strokeStyle = 'rgba(232,210,170,1)'; g.lineWidth = 5;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo((i * w) / n, 0); g.lineTo((i * w) / n, h); g.stroke(); g.beginPath(); g.moveTo(0, (i * h) / n); g.lineTo(w, (i * h) / n); g.stroke(); }
    g.lineWidth = 2; g.strokeStyle = 'rgba(210,180,130,.9)'; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const x = (i * w) / n, y = (j * h) / n, s = w / n; g.beginPath(); g.moveTo(x, y + s / 2); g.lineTo(x + s, y + s / 2); g.moveTo(x + s / 2, y); g.lineTo(x + s / 2, y + s); g.stroke(); }
  }, { aniso: 8 }),
  mesh: () => canvasTex('mesh', 128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(235,238,240,.95)'; g.lineWidth = 2;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo((i * w) / 8, 0); g.lineTo((i * w) / 8, h); g.stroke(); g.beginPath(); g.moveTo(0, (i * h) / 8); g.lineTo(w, (i * h) / 8); g.stroke(); }
  }),
  field: () => canvasTex('field', 512, 320, (g, w, h) => {
    noiseRect(g, w, h, [70, 140, 64], 14, 95, 2, 30);
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
  // placa de latão escovado com o texto gravado; a cor do latão vem do material (0xc0b494) e o
  // gravado é fosco e não metálico (tex.brassMR: rugosidade no verde, metal no azul)
  brass: () => canvasTex('brass', 1280, 320, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f4efe4'); gr.addColorStop(0.55, '#e2d9c6'); gr.addColorStop(1, '#cfc4ae'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { g.fillStyle = hash(i, 1, 97) < 0.5 ? 'rgba(255,255,255,.10)' : 'rgba(90,80,60,.07)'; g.fillRect(0, hash(i, 2, 97) * h, w, 1); }
    placa(g, w, h, '#1e1a16');
  }, { aniso: 8 }),
  brassMR: () => canvasTex('brassMR', 1280, 320, (g, w, h) => { g.fillStyle = 'rgb(0,71,230)'; g.fillRect(0, 0, w, h); placa(g, w, h, 'rgb(0,204,26)'); }, { linear: true, aniso: 8 }),
};

// cobertura de nuvens de luz (spots) projetada no chão — "cookie" da luz principal
export function spotCookie() {
  return canvasTex('cookie', 256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.7, '#ddd'); gr.addColorStop(1, '#888'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}
