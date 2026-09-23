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

// Fachada: 32 vãos x 4 andares. mapa (vidro) + emissivo (luzes internas).
// estilo: 'quente' (moradias), 'lab' (laboratórios frios), 'escuro' (sede), 'madeira' (biblioteca)
export function facadeTextures(style = 'quente') {
  const key = 'fac-' + style;
  if (cache.has(key)) return cache.get(key);
  // faixas contínuas de vidro com luz interna quente (como na maquete da foto): montantes finos,
  // variação suave de brilho por vão, poucas salas escuras, peitoril de vidro com floreiras.
  const W = 1024, H = 256, bays = 32, floors = 4, bw = W / bays, fh = H / floors;
  const pal = {
    quente: { glass: [70, 74, 82], lit: [[255, 214, 158], [255, 226, 182], [255, 204, 140], [252, 232, 200]], dark: 0.1, frame: '#EEEAE0', mull: 2, gain: 1 },
    lab: { glass: [74, 84, 96], lit: [[236, 244, 255], [224, 236, 250], [255, 255, 255], [214, 230, 246]], dark: 0.12, frame: '#EDF0F3', mull: 2, gain: 0.95 },
    escuro: { glass: [44, 54, 68], lit: [[255, 222, 176], [230, 238, 250], [255, 232, 196]], dark: 0.35, frame: '#C6CED6', mull: 1, gain: 0.8 },
    madeira: { glass: [92, 64, 40], lit: [[255, 200, 128], [255, 214, 150], [255, 190, 110]], dark: 0.04, frame: '#C9965C', mull: 5, gain: 1.05 },
  }[style];
  const mapC = document.createElement('canvas'); mapC.width = W; mapC.height = H;
  const emC = document.createElement('canvas'); emC.width = W; emC.height = H;
  const m = mapC.getContext('2d'), e = emC.getContext('2d');
  m.fillStyle = `rgb(${pal.glass.join(',')})`; m.fillRect(0, 0, W, H);
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  const seed = { quente: 11, lab: 23, escuro: 37, madeira: 41 }[style];
  const rgb = (c, k) => `rgb(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0})`;
  for (let f = 0; f < floors; f++) {
    const y = f * fh, top = y + 7, bot = y + fh - 14;
    for (let b = 0; b < bays; b++) {
      const x = b * bw; const dark = hash(b, f, seed) < pal.dark;
      const c = pal.lit[(hash(b >> 1, f, seed + 3) * pal.lit.length) | 0];
      const k = dark ? 0.12 : (0.62 + vnoise(b, f * 7, 3, seed) * 0.38) * pal.gain;
      // vidro: interior iluminado mais claro junto ao teto
      const g1 = m.createLinearGradient(0, top, 0, bot); g1.addColorStop(0, rgb(c, 0.55 + k * 0.45)); g1.addColorStop(1, rgb(c, 0.32 + k * 0.3));
      m.fillStyle = dark ? `rgb(${pal.glass.join(',')})` : g1; m.fillRect(x, top, bw, bot - top);
      const g2 = e.createLinearGradient(0, top, 0, bot); g2.addColorStop(0, rgb(c, k)); g2.addColorStop(1, rgb(c, k * 0.55));
      e.fillStyle = g2; e.fillRect(x, top, bw, bot - top);
      // silhuetas discretas (pessoas, estantes)
      const sil = hash(b, f, seed + 9);
      if (!dark && sil < 0.3) { const sx = x + 5 + hash(b, f, seed + 10) * (bw - 12); for (const g of [m, e]) { g.fillStyle = 'rgba(40,28,18,0.45)'; g.fillRect(sx, bot - 20, 5, 20); g.beginPath(); g.arc(sx + 2.5, bot - 23, 3, 0, 7); g.fill(); } }
      else if (!dark && sil < 0.5) { for (const g of [m, e]) { g.fillStyle = 'rgba(40,28,18,0.3)'; g.fillRect(x + 3, bot - 10, bw - 6, 4); } }
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

export const tex = {
  concrete: () => canvasTex('concrete', 256, 256, (g, w, h) => noiseRect(g, w, h, [234, 231, 222], 10, 61, 2, 30)),
  roof: () => canvasTex('roof', 256, 256, (g, w, h) => {
    noiseRect(g, w, h, [64, 118, 54], 38, 21, 2, 14);
    for (let i = 0; i < 900; i++) { const x = hash(i, 1, 22) * w, y = hash(i, 2, 22) * h, r = 1.5 + hash(i, 3, 22) * 5; g.fillStyle = ['rgba(120,170,80,.45)', 'rgba(30,70,30,.5)', 'rgba(170,190,90,.35)', 'rgba(200,120,140,.35)'][(hash(i, 4, 22) * 4) | 0]; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  }),
  grass: () => canvasTex('grass', 512, 512, (g, w, h) => {
    noiseRect(g, w, h, [60, 92, 46], 24, 31, 2, 24);
    for (let i = 0; i < 5000; i++) { const x = hash(i, 1, 33) * w, y = hash(i, 2, 33) * h; g.fillStyle = hash(i, 3, 33) < 0.5 ? 'rgba(20,55,20,.28)' : 'rgba(150,200,110,.18)'; g.fillRect(x, y, 1 + hash(i, 4, 33) * 2, 1 + hash(i, 5, 33) * 3); }
  }),
  pasto: () => canvasTex('pasto', 512, 512, (g, w, h) => {
    noiseRect(g, w, h, [100, 102, 66], 22, 57, 2, 28);
    for (let i = 0; i < 90; i++) { const x = hash(i, 1, 58) * w, y = hash(i, 2, 58) * h, r = 6 + hash(i, 3, 58) * 26; g.fillStyle = `rgba(${112 + hash(i, 4, 58) * 20},${96 + hash(i, 5, 58) * 14},${64},0.32)`; g.beginPath(); g.ellipse(x, y, r, r * 0.7, hash(i, 6, 58) * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 2600; i++) { const x = hash(i, 7, 58) * w, y = hash(i, 8, 58) * h; g.fillStyle = hash(i, 9, 58) < 0.5 ? 'rgba(80,90,40,.35)' : 'rgba(170,150,90,.25)'; g.fillRect(x, y, 1 + hash(i, 10, 58) * 2, 2 + hash(i, 11, 58) * 3); }
  }),
  forestFloor: () => canvasTex('forest', 512, 512, (g, w, h) => noiseRect(g, w, h, [40, 62, 34], 28, 35, 3, 40)),
  pavers: () => canvasTex('pavers', 512, 512, (g, w, h) => {
    noiseRect(g, w, h, [200, 186, 164], 16, 51, 2, 20);
    g.strokeStyle = 'rgba(90,70,50,.18)'; g.lineWidth = 1.2;
    for (let y = 0; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); const off = (y / 16) % 2 ? 16 : 0; for (let x = off; x < w; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); } }
    for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(${hash(i, 1, 52) < 0.5 ? '255,245,225' : '120,100,80'},.10)`; g.fillRect(((hash(i, 2, 52) * 32) | 0) * 16, ((hash(i, 3, 52) * 32) | 0) * 16, 32, 16); }
  }),
  sand: () => canvasTex('sand', 256, 256, (g, w, h) => {
    noiseRect(g, w, h, [196, 170, 120], 26, 41, 2, 22);
    for (let i = 0; i < 600; i++) { g.fillStyle = hash(i, 1, 42) < 0.5 ? 'rgba(120,140,60,.35)' : 'rgba(150,120,80,.3)'; g.fillRect(hash(i, 2, 42) * w, hash(i, 3, 42) * h, 2, 2 + hash(i, 4, 42) * 3); }
  }),
  soil: () => canvasTex('soil', 256, 256, (g, w, h) => noiseRect(g, w, h, [110, 84, 58], 34, 81, 2, 18)),
  rock: () => canvasTex('rock', 256, 256, (g, w, h) => {
    noiseRect(g, w, h, [168, 132, 98], 50, 91, 2, 12);
    g.strokeStyle = 'rgba(60,40,25,.35)'; g.lineWidth = 2; for (let i = 0; i < 24; i++) { g.beginPath(); let x = hash(i, 1, 92) * w, y = hash(i, 2, 92) * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (hash(i, k, 93) - 0.5) * 50; y += hash(i, k, 94) * 30; g.lineTo(x, y); } g.stroke(); }
  }),
  wood: () => canvasTex('wood', 512, 128, (g, w, h) => {
    noiseRect(g, w, h, [150, 102, 62], 30, 71, 2, 30);
    g.fillStyle = 'rgba(70,40,18,.28)'; for (let i = 0; i < 70; i++) { const y = hash(i, 1, 72) * h; g.fillRect(0, y, w, 1 + hash(i, 2, 72) * 2); }
    g.fillStyle = 'rgba(255,220,170,.10)'; for (let i = 0; i < 40; i++) g.fillRect(0, hash(i, 3, 72) * h, w, 1);
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
  brass: () => canvasTex('brass', 1024, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#E9CF8E'); gr.addColorStop(0.5, '#C9A55A'); gr.addColorStop(1, '#A6823C'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(60,40,10,.6)'; g.lineWidth = 5; g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#3A2A0E'; g.textAlign = 'center';
    g.font = '600 46px Georgia, serif'; g.fillText('COMPOSIÇÃO TOTAL DA ARCOLOGIA DE HELD', w / 2, 76);
    g.font = '400 23px Georgia, serif';
    const L = ['Integração de ciência, educação, conservação e convivência numa só arcologia sustentável.', 'Campus, biblioteca, acelerador, santuário e bioma aquático ligados por passarelas verdes,', 'operados com energia solar e reuso de água. Modelo vivo de sustentabilidade urbana.'];
    L.forEach((l, i) => g.fillText(l, w / 2, 128 + i * 34));
  }),
};

// cobertura de nuvens de luz (spots) projetada no chão — "cookie" da luz principal
export function spotCookie() {
  return canvasTex('cookie', 256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.7, '#ddd'); gr.addColorStop(1, '#888'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}
