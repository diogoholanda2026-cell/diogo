/* =========================================================
   05 · desenho: câmera, sprites, terreno, ruas, construções
   ========================================================= */
const cv = $('#map'), ctx = cv.getContext('2d');
const sky = $('#sky'), sctx = sky.getContext('2d');
let vw = 0, vh = 0, dpr = 1;
const cam = { x: N / 2 * TW, y: N / 2 * TH, z: 1 };
const minZ = () => Math.min(vw / ((N + 6) * TW), vh / ((N + 8) * TH));
const maxZ = 3;
function clampCam() {
  cam.z = clamp(cam.z, minZ(), maxZ);
  const mx = TW * 3, my = TH * 5; cam.x = clamp(cam.x, -mx, N * TW + mx); cam.y = clamp(cam.y, -my, N * TH + my);
}
const s2w = (sx, sy) => [(sx - vw / 2) / cam.z + cam.x, (sy - vh / 2) / cam.z + cam.y];
const w2s = (wx, wy) => [(wx - cam.x) * cam.z + vw / 2, (wy - cam.y) * cam.z + vh / 2];
function tileAt(sx, sy) { const [wx, wy] = s2w(sx, sy); return [Math.floor(wx / TW), Math.floor(wy / TH)]; }

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  vw = window.innerWidth; vh = window.innerHeight;
  for (const c of [cv, sky]) { c.width = Math.round(vw * dpr); c.height = Math.round(vh * dpr); c.style.width = vw + 'px'; c.style.height = vh + 'px'; }
  paintSky(); clampCam();
}
function paintSky() {
  const g = sctx; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bg = g.createLinearGradient(0, 0, 0, vh); bg.addColorStop(0, '#050A16'); bg.addColorStop(0.6, '#0A1226'); bg.addColorStop(1, '#0D1730');
  g.fillStyle = bg; g.fillRect(0, 0, vw, vh);
  const bands = [['rgba(70,227,181,', vw * 0.2, vh * 0.05, vw * 0.7], ['rgba(140,124,255,', vw * 0.85, vh * 0.02, vw * 0.6], ['rgba(70,227,181,', vw * 0.6, vh * 0.2, vw * 0.45], ['rgba(255,120,200,', vw * 0.4, vh * 0.0, vw * 0.3]];
  for (const [c, x, y, r] of bands) {
    const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, c + '.2)'); rg.addColorStop(1, c + '0)');
    g.fillStyle = rg; g.fillRect(0, 0, vw, vh);
  }
  for (let i = 0; i < 320; i++) {
    const x = hash(i, 1, 11) * vw, y = hash(i, 2, 11) * vh, r = hash(i, 3, 11) * 1.2 + 0.2;
    g.fillStyle = `rgba(236,231,218,${0.2 + hash(i, 4, 11) * 0.65})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
}

/* ---------------- imagens e sprites ---------------- */
const IMG = {}; const SPR = {}; const TREES = [];
function loadImage(src) { return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
async function loadImages() {
  const keys = Object.keys(ASSETS.meta);
  const ims = await Promise.all(keys.map(k => loadImage(ASSETS[k])));
  keys.forEach((k, i) => { if (ims[i]) IMG[k] = ims[i]; });
  for (const k of keys) makeSprite(k);
}
// copas de árvore desenhadas uma vez (variações de forma e tom)
function makeTrees() {
  for (let v = 0; v < 8; v++) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
    const n = 3 + (v % 3); const tones = [['#14311D', '#1C4728', '#2B6638'], ['#173A22', '#22552F', '#347A44'], ['#1A3A1E', '#275A2C', '#3B7D3E']][v % 3];
    const blobs = [];
    for (let i = 0; i < n; i++) blobs.push([32 + (hash(i, v, 41) - 0.5) * 26, 34 + (hash(i, v, 42) - 0.5) * 18, 11 + hash(i, v, 43) * 9]);
    for (const t of [0, 1, 2]) {
      g.fillStyle = tones[t];
      for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x - t * 2.2, y - t * 2.4, r * (1 - t * 0.28), 0, TAU); g.fill(); }
    }
    g.fillStyle = 'rgba(255,240,200,.16)';
    for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x - 5, y - 6, r * 0.32, 0, TAU); g.fill(); }
    TREES.push(c);
  }
}
makeTrees();
function makeSprite(k) {
  const im = IMG[k]; if (!im) return;
  const w = im.naturalWidth, h = im.naturalHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.drawImage(im, 0, 0);
  // vinheta leve e escurecimento do rodapé para assentar no chão
  const vg = g.createLinearGradient(0, 0, 0, h); vg.addColorStop(0, 'rgba(255,255,255,.04)'); vg.addColorStop(0.85, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.22)');
  g.fillStyle = vg; g.fillRect(0, 0, w, h);
  // bordas suaves (máscara com sombra difusa)
  const m = document.createElement('canvas'); m.width = w; m.height = h; const mg = m.getContext('2d');
  const f = clamp(Math.round(w * 0.045), 5, 16);
  mg.save(); mg.shadowColor = '#000'; mg.shadowBlur = f * 1.6; mg.fillStyle = '#000';
  mg.fillRect(f * 1.1, f * 1.1, w - f * 2.2, h - f * 2.2); mg.fillRect(f * 1.1, f * 1.1, w - f * 2.2, h - f * 2.2); mg.restore();
  g.globalCompositeOperation = 'destination-in'; g.drawImage(m, 0, 0); g.globalCompositeOperation = 'source-over';
  // versão "concreto" (cinza-azulada) usada enquanto o andar está em obra
  const gc = document.createElement('canvas'); gc.width = w; gc.height = h; const gg = gc.getContext('2d');
  gg.drawImage(c, 0, 0);
  try {
    const id = gg.getImageData(0, 0, w, h), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; d[i] = l * 0.72 + 22; d[i + 1] = l * 0.74 + 24; d[i + 2] = l * 0.8 + 32; }
    gg.putImageData(id, 0, 0);
  } catch (_) { gg.globalCompositeOperation = 'source-atop'; gg.fillStyle = 'rgba(90,95,110,.8)'; gg.fillRect(0, 0, w, h); }
  SPR[k] = { c, g: gc, ar: h / w };
}
function spriteRect(b, lvl) {
  const t = TYPES[b.t]; const img = t.res ? RES_STAGES[(lvl || b.lvl) - 1].img : t.img;
  const meta = ASSETS.meta[img] || [t.w, t.h, t.h / t.w]; const ar = meta[2];
  const W = t.w * TW, H = W * ar, X = b.x * TW, Yb = (b.y + t.h) * TH;
  return { img, X, Y: Yb - H, W, H, Yb };
}

/* ---------------- terreno pintado uma vez ---------------- */
const tcv = document.createElement('canvas');
function paintTerrain() {
  const P = 24, PY = 15; tcv.width = N * P; tcv.height = N * PY; const g = tcv.getContext('2d');
  const small = document.createElement('canvas'); small.width = N; small.height = N; const sg = small.getContext('2d');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x; let col;
    if (WATER[i]) {
      let land = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (inb(xx, yy) && !WATER[yy * N + xx]) land++; }
      const d = 1 - Math.min(1, land / 10);
      col = [26 + (1 - d) * 24, 74 + (1 - d) * 30, 98 + (1 - d) * 22];
    } else {
      let shore = false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (inb(xx, yy) && WATER[yy * N + xx]) shore = true; }
      const n = vnoise(x, y, 4, 3) * 0.7 + hash(x, y, 13) * 0.3;
      col = shore ? [86, 98, 66] : [40 + n * 18, 76 + n * 22, 44 + n * 12];
    }
    g.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`; g.fillRect(x * P, y * PY, P, PY);
    sg.fillStyle = g.fillStyle; sg.fillRect(x, y, 1, 1);
  }
  g.save(); g.globalAlpha = 0.55; g.imageSmoothingEnabled = true; g.drawImage(small, 0, 0, N, N, -P / 2, -PY / 2, N * P + P, N * PY + PY); g.restore();
  // gramado: manchas suaves e "fios" finos para dar textura sem padrão repetido
  g.save();
  for (let i = 0; i < N * N * 3; i++) {
    const x = hash(i, 1, 51) * N * P, y = hash(i, 2, 51) * N * PY; const tx = (x / P) | 0, ty = (y / PY) | 0;
    if (WATER[ty * N + tx]) continue;
    const l = hash(i, 3, 51); g.fillStyle = l < 0.5 ? `rgba(120,190,110,${0.05 + l * 0.08})` : `rgba(10,30,15,${0.04 + (l - 0.5) * 0.1})`;
    g.beginPath(); g.ellipse(x, y, 2 + hash(i, 4, 51) * 9, 1 + hash(i, 5, 51) * 4, 0, 0, TAU); g.fill();
  }
  g.restore();
}

/* ---------------- efeitos: textos, partículas ---------------- */
let floats = [], parts = [];
function addFloat(tx, ty, text, color, life = 1.5) { if (quiet) return; if (floats.length > 40) floats.shift(); floats.push({ x: tx * TW, y: ty * TH, text, color, t: 0, life }); }
function burst(tx, ty, n = 18) {
  if (quiet) return;
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = 40 + Math.random() * 90; parts.push({ x: tx * TW, y: ty * TH, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 60, t: 0, life: 0.8 + Math.random() * 0.6, c: Math.random() < 0.5 ? '#E8CB86' : '#46E3B5', r: 2 + Math.random() * 3 }); }
}
function emitAmbientFloats() {
  const [ax, ay] = s2w(0, 0), [bx, by] = s2w(vw, vh);
  const vis = S.bld.filter(b => TYPES[b.t].res && b._on && b.x * TW < bx && (b.x + 3) * TW > ax && b.y * TH < by && (b.y + 2) * TH > ay);
  if (!vis.length) return;
  const b = pick(vis);
  if (b._joy > 0.6) addFloat(b.x + 1.5 + rnd(-0.6, 0.6), b.y + 0.4, pick(['♥', '✦', '☺']), '#46E3B5', 1.6);
}

/* ---------------- moldura de maquete ---------------- */
let frameGrad = null;
function drawFrame() {
  const ox = TW * 1.2, oy = TH * 1.6, W = N * TW, H = N * TH;
  if (!frameGrad) { frameGrad = ctx.createLinearGradient(-ox, -oy, W + ox, H + oy); frameGrad.addColorStop(0, '#5A3A22'); frameGrad.addColorStop(0.5, '#3E2616'); frameGrad.addColorStop(1, '#2A190E'); }
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(-ox + 16, -oy + 28, W + ox * 2, H + oy * 2);
  ctx.fillStyle = frameGrad; ctx.fillRect(-ox, -oy, W + ox * 2, H + oy * 2);
  ctx.strokeStyle = 'rgba(255,220,170,.08)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i < 20; i++) { const y = -oy + (i + 0.5) * (H + oy * 2) / 20; ctx.moveTo(-ox, y); ctx.lineTo(-ox + ox * 0.9, y + 5); ctx.moveTo(W + ox * 0.1, y); ctx.lineTo(W + ox, y - 5); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(190,225,255,.3)'; ctx.lineWidth = 3; ctx.strokeRect(-3, -3, W + 6, H + 6);
  // placa de latão
  const pw = TW * 11, ph = TH * 1.0, px = W / 2 - pw / 2, py = H + oy * 0.25;
  const pg = ctx.createLinearGradient(0, py, 0, py + ph); pg.addColorStop(0, '#EBD08F'); pg.addColorStop(1, '#A9843F');
  ctx.fillStyle = pg; rr(ctx, px, py, pw, ph, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(40,28,8,.5)'; ctx.lineWidth = 1.5; rr(ctx, px + 5, py + 5, pw - 10, ph - 10, 4); ctx.stroke();
  ctx.fillStyle = '#2A1F0B'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${TH * 0.4}px Marcellus, Georgia, serif`;
  ctx.fillText('ARCOLOGIA DE HELD · MAQUETE VIVA · ' + fmt(D.pop) + ' HABITANTES', W / 2, py + ph / 2 + 1);
}

/* ---------------- carros ---------------- */
let cars = []; const CAR_COLORS = ['#E8E2D4', '#C9D3E6', '#F0B44C', '#5BC0EB', '#FF6A5C', '#9AA3B5', '#46E3B5'];
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
function roadNb(i, d) { const x = i % N + DIRS[d][0], y = ((i / N) | 0) + DIRS[d][1]; return inb(x, y) && ROAD[y * N + x] ? y * N + x : -1; }
function updateCars(dt) {
  const want = Math.min(48, 6 + S.bld.length * 1.3 + S.stats.roads / 12);
  if (cars.length < want && Math.random() < 0.3) {
    const tiles = []; for (let i = 0; i < N * N; i++) if (CONN[i] && !HWY[i]) tiles.push(i);
    if (tiles.length) { const i = pick(tiles); const outs = [0, 1, 2, 3].filter(d => roadNb(i, d) >= 0); if (outs.length) cars.push({ i, from: (pick(outs) + 2) % 4, to: pick(outs), t: 0.5, sp: 0.5 + Math.random() * 0.5, c: pick(CAR_COLORS) }); }
  }
  for (const c of cars) {
    c.t += c.sp * dt * (ROAD[c.i] === 3 ? 1.5 : 1) * (STRETCH[c.i] >= 0 && stretches[STRETCH[c.i]].jam ? 0.35 : 1);
    if (c.t >= 1) {
      const next = roadNb(c.i, c.to);
      if (next < 0) { c.dead = true; continue; }
      c.i = next; c.from = (c.to + 2) % 4; c.t = 0;
      const outs = [0, 1, 2, 3].filter(d => d !== c.from && roadNb(next, d) >= 0);
      if (!outs.length) c.to = c.from; else { c.to = Math.random() < 0.7 && outs.includes((c.from + 2) % 4) ? (c.from + 2) % 4 : pick(outs); }
    }
  }
  cars = cars.filter(c => !c.dead && ROAD[c.i]);
}
function carPos(c) {
  const x0 = (c.i % N) * TW, y0 = ((c.i / N) | 0) * TH; const cx = x0 + TW / 2, cy = y0 + TH / 2;
  const ex = [x0 + TW, cx, x0, cx], ey = [cy, y0 + TH, cy, y0]; // pontos médios das bordas L, S, O, N
  const fx = ex[c.from], fy = ey[c.from], tx = ex[c.to], ty = ey[c.to];
  // mão direita: desloca para a direita do sentido
  let px, py;
  if (c.t < 0.5) { const u = c.t * 2; px = fx + (cx - fx) * u; py = fy + (cy - fy) * u; }
  else { const u = (c.t - 0.5) * 2; px = cx + (tx - cx) * u; py = cy + (ty - cy) * u; }
  const d = c.t < 0.5 ? (c.from + 2) % 4 : c.to; const dx = DIRS[d][0], dy = DIRS[d][1];
  return [px - dy * TW * 0.12, py + dx * TH * 0.12, d];
}
function drawCar(c, z) {
  const [x, y, d] = carPos(c); const horiz = d === 0 || d === 2;
  const w = horiz ? TW * 0.22 : TW * 0.13, h = horiz ? TH * 0.2 : TH * 0.32;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(ctx, x - w / 2 + 2, y - h / 2 + 3, w, h, 3); ctx.fill();
  ctx.fillStyle = c.c; rr(ctx, x - w / 2, y - h / 2, w, h, 3); ctx.fill();
  if (z > 0.6) {
    ctx.fillStyle = 'rgba(20,30,50,.6)'; rr(ctx, x - w * 0.3, y - h * 0.3, w * 0.6, h * 0.6, 2); ctx.fill();
    const hx = x + DIRS[d][0] * w * 0.55, hy = y + DIRS[d][1] * h * 0.55;
    ctx.fillStyle = 'rgba(255,235,180,.85)'; ctx.beginPath(); ctx.arc(hx, hy, 1.6, 0, TAU); ctx.fill();
  }
}

/* ---------------- ruas ---------------- */
const ASPHALT = ['', '#2C313B', '#343A46', '#22262E'];
function drawRoads(x0, y0, x1, y1, z) {
  const isR = (x, y) => inb(x, y) && ROAD[y * N + x] > 0;
  const band = (lvl) => lvl === 1 ? 0.2 : lvl === 2 ? 0.1 : 0.03;
  const arms = (x, y, inset, fill) => {
    const X = x * TW, Y = y * TH, ix = TW * inset, iy = TH * inset;
    ctx.fillStyle = fill;
    ctx.fillRect(X + ix, Y + iy, TW - 2 * ix, TH - 2 * iy);
    if (isR(x - 1, y)) ctx.fillRect(X, Y + iy, ix + 1, TH - 2 * iy);
    if (isR(x + 1, y)) ctx.fillRect(X + TW - ix - 1, Y + iy, ix + 1, TH - 2 * iy);
    if (isR(x, y - 1)) ctx.fillRect(X + ix, Y, TW - 2 * ix, iy + 1);
    if (isR(x, y + 1)) ctx.fillRect(X + ix, Y + TH - iy - 1, TW - 2 * ix, iy + 1);
  };
  // calçadas / acostamento
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * N + x; if (!ROAD[i]) continue; arms(x, y, Math.max(0.02, band(ROAD[i]) - 0.09), WATER[i] ? '#6E5B45' : (ROAD[i] === 3 ? '#4A5160' : '#8B8F98')); }
  // asfalto
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * N + x; if (!ROAD[i]) continue; arms(x, y, band(ROAD[i]), ASPHALT[ROAD[i]]); }
  // trechos congestionados
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * N + x; if (!ROAD[i] || STRETCH[i] < 0 || !stretches[STRETCH[i]].jam) continue; arms(x, y, band(ROAD[i]), 'rgba(255,90,70,.28)'); }
  if (z < 0.3) return;
  // faixas
  ctx.lineWidth = 1.4; ctx.beginPath(); ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(232,206,130,.7)';
  const dashes = (lvlWanted) => {
    ctx.beginPath();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * N + x; if (ROAD[i] !== lvlWanted) continue;
      const n = isR(x, y - 1), s = isR(x, y + 1), w = isR(x - 1, y), e = isR(x + 1, y);
      if (n + s + w + e > 2) continue;
      const cx = x * TW + TW / 2, cy = y * TH + TH / 2;
      if (w) { ctx.moveTo(x * TW, cy); ctx.lineTo(cx, cy); }
      if (e) { ctx.moveTo(cx, cy); ctx.lineTo(x * TW + TW, cy); }
      if (n) { ctx.moveTo(cx, y * TH); ctx.lineTo(cx, cy); }
      if (s) { ctx.moveTo(cx, cy); ctx.lineTo(cx, y * TH + TH); }
      if (!n && !s && !w && !e) { ctx.moveTo(x * TW, cy); ctx.lineTo(x * TW + TW, cy); }
    }
    ctx.stroke();
  };
  ctx.setLineDash([5, 6]); ctx.strokeStyle = 'rgba(232,206,130,.55)'; ctx.lineWidth = 1.2; dashes(1);
  ctx.setLineDash([8, 5]); ctx.strokeStyle = 'rgba(255,214,120,.8)'; ctx.lineWidth = 1.8; dashes(2);
  ctx.setLineDash([]); ctx.strokeStyle = 'rgba(236,231,218,.55)'; ctx.lineWidth = 1.2; dashes(3);
  ctx.setLineDash([]);
  // postes de luz
  if (z > 0.7) {
    ctx.fillStyle = 'rgba(255,214,140,.14)'; ctx.beginPath();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (ROAD[y * N + x] && (x + y * 3) % 4 === 0) { ctx.moveTo(x * TW + 8 + 8, y * TH + 5); ctx.arc(x * TW + 8, y * TH + 5, 8, 0, TAU); }
    ctx.fill();
    ctx.fillStyle = '#FFE3A6'; ctx.beginPath();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (ROAD[y * N + x] && (x + y * 3) % 4 === 0) { ctx.moveTo(x * TW + 9.6, y * TH + 5); ctx.arc(x * TW + 8, y * TH + 5, 1.6, 0, TAU); }
    ctx.fill();
  }
}

/* ---------------- árvores ---------------- */
function treeList(x0, y0, x1, y1) {
  const out = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * N + x; if (!TREE[i] || ROAD[i] || OCC[i] || WATER[i]) continue;
    const n = hash(x, y, 2) < 0.4 ? 2 : 1;
    for (let j = 0; j < n; j++) out.push({ kind: 'tree', x: x * TW + TW * (0.2 + 0.6 * hash(x, y, 3 + j)), y: y * TH + TH * (0.3 + 0.5 * hash(x, y, 5 + j)), s: TW * (0.42 + 0.3 * hash(x, y, 8 + j)), v: (hash(x, y, 9 + j) * 8) | 0, by: y + 0.3 + 0.5 * hash(x, y, 5 + j) });
  }
  return out;
}
function drawTree(t, z) {
  const im = TREES[t.v % TREES.length];
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(t.x + 3, t.y + t.s * 0.12, t.s * 0.42, t.s * 0.18, 0, 0, TAU); ctx.fill();
  ctx.drawImage(im, t.x - t.s / 2, t.y - t.s * 0.66, t.s, t.s * 0.8);
}

/* ---------------- construções ---------------- */
const P_BOLT = new Path2D('M13.2 2 4.6 13.4h6.2L9.9 22l8.6-11.5h-6.2L13.2 2z');
const P_DROP = new Path2D('M12 2.4C9 6.9 5.4 10.2 5.4 14.6a6.6 6.6 0 0 0 13 0c0-4.4-3.4-7.7-6.4-12.2z');
const P_ROAD = new Path2D('M8 3 4.5 21h3L10 3zM16 3l3.5 18h-3L14 3zM11 4h2v3h-2zM11 10h2v4h-2zM11 17h2v3h-2z');
const P_BOX = new Path2D('M3.5 7.5 12 3.2l8.5 4.3v9L12 20.8l-8.5-4.3z');
const P_UP = new Path2D('M12 4 4 13h5v7h6v-7h5z');
const P_CAR = new Path2D('M5 11l1.5-4.5h11L19 11h1.5v6h-2a2 2 0 0 1-4 0h-5a2 2 0 0 1-4 0h-2v-6z');
const P_RECY = new Path2D('M12 3.5 15.5 9.5h-7zM4.2 17.2 7.7 11.2l3.5 6zm12.1 0-3.5-6 7-.1z');
const P_COIN = new Path2D('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 3.5v1.2c1.4.1 2.4.8 2.7 1.9l-1.9.5c-.2-.5-.6-.8-1.3-.8-.8 0-1.3.4-1.3 1 0 2 4.7.8 4.7 4 0 1.4-1 2.3-2.9 2.5v1.2h-1.4v-1.2c-1.6-.2-2.6-1-2.9-2.2l1.9-.5c.2.7.8 1.1 1.6 1.1.9 0 1.4-.4 1.4-1 0-2-4.7-.8-4.7-4 0-1.3.9-2.2 2.7-2.4V6.5z');
const P_CHAT = new Path2D('M4 4h16v11H9l-5 4z');
const P_CRANE = new Path2D('M3 21h18M6.5 21V5.5M6.5 5.5H21M6.5 9.5 10.5 5.5M19 5.5v4.2M17.2 9.7h3.6v2.6h-3.6z');
let hits = [];   // bolhas tocáveis desta quadro: {x,y,r (mundo), b, kind}

function groundShadow(b) {
  const t = TYPES[b.t]; const X = b.x * TW, Y = b.y * TH, W = t.w * TW, H = t.h * TH;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(X + W / 2 + 3, Y + H * 0.6, W * 0.5, H * 0.5, 0, 0, TAU); ctx.fill();
}
/* ---------------- canteiro de obras (animação passo a passo) ----------------
   Fases de uma obra nova (f = fração concluída):
     A 0,00–0,18 terraplanagem: terra, trator indo e voltando, operários com pá
     B 0,18–0,30 fundação: laje crescendo, betoneira girando
     C 0,30–0,90 estrutura: o prédio sobe andar por andar (vigas → concreto → fachada),
                 com andaime, guindaste içando painéis, operários martelando e soldando
     D 0,90–1,00 acabamento: andaime e guindaste saem, operários vão embora
   A melhoria de uma moradia usa as fases C e D por cima da maquete antiga.
*/
const VESTS = ['#F08A3C', '#F2C230', '#5BC0EB', '#FF6A5C'];
function floorsOf(sr) { return clamp(Math.round(sr.H / (TH * 0.62)), 4, 10); }
function drawWorker(x, y, h, t, act, vest, flip) {
  // figura simples: pernas, colete, braços, cabeça e capacete; y = pés
  ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
  ctx.lineCap = 'round';
  const step = act === 'walk' ? Math.sin(t * 9) * h * 0.13 : 0;
  ctx.strokeStyle = '#242A36'; ctx.lineWidth = Math.max(1.3, h * 0.11); ctx.beginPath();
  ctx.moveTo(0, -h * 0.46); ctx.lineTo(-h * 0.09 + step, 0); ctx.moveTo(0, -h * 0.46); ctx.lineTo(h * 0.09 - step, 0); ctx.stroke();
  ctx.fillStyle = vest; rr(ctx, -h * 0.16, -h * 0.8, h * 0.32, h * 0.38, h * 0.07); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = '#E8C39E'; ctx.lineWidth = Math.max(1.2, h * 0.09); ctx.beginPath();
  if (act === 'hammer') {
    const a = Math.max(0, Math.sin(t * 11));
    ctx.moveTo(h * 0.14, -h * 0.72); ctx.lineTo(h * 0.38, -h * 0.72 - a * h * 0.34); ctx.stroke();
    ctx.fillStyle = '#8B8F98'; ctx.fillRect(h * 0.32, -h * 0.82 - a * h * 0.34, h * 0.16, h * 0.11);
  } else if (act === 'carry') {
    ctx.moveTo(-h * 0.14, -h * 0.72); ctx.lineTo(-h * 0.14, -h * 1.02); ctx.moveTo(h * 0.14, -h * 0.72); ctx.lineTo(h * 0.14, -h * 1.02); ctx.stroke();
    ctx.fillStyle = '#B8865A'; ctx.fillRect(-h * 0.5, -h * 1.1, h * 1.0, h * 0.11);
  } else if (act === 'shovel') {
    const a = Math.sin(t * 5) * 0.5 + 0.5;
    ctx.moveTo(-h * 0.12, -h * 0.7); ctx.lineTo(h * 0.2, -h * 0.5 + a * h * 0.15); ctx.stroke();
    ctx.strokeStyle = '#6B6F78'; ctx.lineWidth = Math.max(1, h * 0.06); ctx.beginPath(); ctx.moveTo(h * 0.2, -h * 0.5 + a * h * 0.15); ctx.lineTo(h * 0.5, -h * 0.05 + a * h * 0.12); ctx.stroke();
    ctx.fillStyle = '#8B8F98'; ctx.beginPath(); ctx.ellipse(h * 0.52, -h * 0.03 + a * h * 0.12, h * 0.1, h * 0.06, 0.6, 0, TAU); ctx.fill();
  } else if (act === 'weld') {
    ctx.moveTo(h * 0.14, -h * 0.72); ctx.lineTo(h * 0.36, -h * 0.62); ctx.stroke();
    ctx.fillStyle = '#5B6270'; ctx.fillRect(h * 0.34, -h * 0.66, h * 0.1, h * 0.08);
  } else {
    ctx.moveTo(-h * 0.14, -h * 0.72); ctx.lineTo(-h * 0.24 - step, -h * 0.48); ctx.moveTo(h * 0.14, -h * 0.72); ctx.lineTo(h * 0.24 + step, -h * 0.48); ctx.stroke();
  }
  ctx.fillStyle = '#E8C39E'; ctx.beginPath(); ctx.arc(0, -h * 0.9, h * 0.11, 0, TAU); ctx.fill();
  ctx.fillStyle = '#F2C230'; ctx.beginPath(); ctx.arc(0, -h * 0.92, h * 0.135, Math.PI, TAU); ctx.fill(); ctx.fillRect(-h * 0.16, -h * 0.925, h * 0.32, h * 0.035);
  ctx.restore();
}
function drawMixer(x, y, now) {
  // betoneira com tambor girando; (x, y) = base do caminhão
  const s = TW * 0.42;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x + s * 0.5, y + 3, s * 0.55, s * 0.16, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2A2F3A'; ctx.fillRect(x, y - s * 0.22, s, s * 0.14);
  ctx.fillStyle = '#F08A3C'; rr(ctx, x + s * 0.72, y - s * 0.5, s * 0.28, s * 0.36, 3); ctx.fill();
  ctx.fillStyle = '#9FD9F2'; ctx.fillRect(x + s * 0.78, y - s * 0.46, s * 0.16, s * 0.13);
  ctx.save(); ctx.translate(x + s * 0.36, y - s * 0.42); ctx.rotate(-0.25);
  ctx.fillStyle = '#C9CED8'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.34, s * 0.2, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, s * 0.34, s * 0.2, 0, 0, TAU); ctx.clip();
  ctx.strokeStyle = '#F08A3C'; ctx.lineWidth = s * 0.07; ctx.beginPath();
  const ph = (now / 260) % 1;
  for (let i = -2; i <= 2; i++) { const px = (i + ph) * s * 0.26; ctx.moveTo(px - s * 0.1, -s * 0.25); ctx.lineTo(px + s * 0.1, s * 0.25); }
  ctx.stroke(); ctx.restore(); ctx.restore();
  ctx.fillStyle = '#15181F';
  for (const wx of [x + s * 0.18, x + s * 0.5, x + s * 0.84]) { ctx.beginPath(); ctx.arc(wx, y - s * 0.06, s * 0.09, 0, TAU); ctx.fill(); }
}
function drawSign(x, y) {
  const w = TW * 0.28, h = TH * 0.3;
  ctx.fillStyle = '#2A2F3A'; ctx.fillRect(x + w / 2 - 1, y - h - 6, 2, h + 6);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y - h - 8, w, h); ctx.clip();
  ctx.fillStyle = '#F2F2F2'; ctx.fillRect(x, y - h - 8, w, h);
  ctx.fillStyle = '#F08A3C'; for (let i = -1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x + i * 6, y - 8); ctx.lineTo(x + i * 6 + 3, y - 8); ctx.lineTo(x + i * 6 + 3 + h, y - h - 8); ctx.lineTo(x + i * 6 + h, y - h - 8); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function drawSite(b, now, z, f) {
  const t = TYPES[b.t]; const X = b.x * TW, Y = b.y * TH, W = t.w * TW, H = t.h * TH;
  ctx.fillStyle = '#5C4A36'; rr(ctx, X + 2, Y + 2, W - 4, H - 4, 4); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  for (let i = 0; i < t.w * 2; i++) { const mx = X + W * (0.12 + 0.76 * hash(i, b.id, 31)), my = Y + H * (0.2 + 0.6 * hash(i, b.id, 32)); ctx.beginPath(); ctx.ellipse(mx, my, TW * 0.14, TH * 0.12, 0, 0, TAU); ctx.fill(); }
  if (f > 0.16) {
    const g = clamp((f - 0.16) / 0.14, 0, 1);
    ctx.fillStyle = '#8E8C84'; rr(ctx, X + W * 0.08, Y + H * 0.14, (W * 0.84) * g, H * 0.72, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = X + W * 0.08 + 8; x < X + W * 0.08 + W * 0.84 * g; x += 10) { ctx.moveTo(x, Y + H * 0.16); ctx.lineTo(x, Y + H * 0.84); }
    ctx.stroke();
  }
  if (f < 0.18) {
    const u = 0.5 + 0.5 * Math.sin(now / 700 + b.id); const tx = X + W * (0.15 + 0.7 * u), ty = Y + H * 0.55;
    const dir = Math.cos(now / 700 + b.id) > 0;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(tx, ty + 6, 13, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#F2C230'; rr(ctx, tx - 9, ty - 8, 18, 12, 3); ctx.fill();
    ctx.fillStyle = '#2A2A2A'; ctx.fillRect(tx - 10, ty + 3, 20, 4); ctx.fillStyle = '#7A7A7A'; ctx.fillRect(tx + (dir ? 9 : -14), ty - 5, 5, 11);
    if (!quiet && Math.random() < 0.25) parts.push({ x: tx + (dir ? 12 : -12), y: ty + 2, vx: rnd(-10, 10), vy: rnd(-25, -8), t: 0, life: 0.6, c: 'rgba(160,140,110,.6)', r: 2.5 });
  }
  ctx.strokeStyle = '#D9C27A'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.strokeRect(X + 2, Y + 2, W - 4, H - 4); ctx.setLineDash([]);
  ctx.fillStyle = '#F08A3C';
  for (const [px, py] of [[X + 6, Y + H - 6], [X + W - 6, Y + H - 6]]) { ctx.beginPath(); ctx.moveTo(px - 3, py + 2); ctx.lineTo(px + 3, py + 2); ctx.lineTo(px, py - 6); ctx.closePath(); ctx.fill(); }
  drawSign(X + W - TW * 0.36, Y + H - 2);
}
function drawScaffold(X, Y, W, H, alpha, now) {
  if (H <= 2 || alpha <= 0.01) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = '#D6D3C8'; ctx.lineWidth = 1.2; ctx.beginPath();
  const sx = Math.max(10, W / Math.round(W / 14)), sy = Math.max(9, H / Math.max(1, Math.round(H / 12)));
  for (let x = X; x <= X + W + 0.5; x += sx) { ctx.moveTo(x, Y); ctx.lineTo(x, Y + H); }
  for (let y = Y; y <= Y + H + 0.5; y += sy) { ctx.moveTo(X, y); ctx.lineTo(X + W, y); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(240,180,76,.7)'; ctx.beginPath();
  for (let x = X; x < X + W; x += sx * 2) { ctx.moveTo(x, Y + H); ctx.lineTo(x + sx * 2, Y + H - sy * 2); }
  ctx.stroke(); ctx.restore();
}
function drawFrame3(X, Y, W, H, grow) {
  // estrutura metálica de um andar: pilares, viga e contraventamento
  ctx.save(); ctx.strokeStyle = '#1B1508'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  const cols = Math.max(3, Math.round(W / 26)); const yb = Y + H, yt = yb - H * grow;
  for (let pass = 0; pass < 2; pass++) {
    if (pass) { ctx.strokeStyle = '#D8B45A'; ctx.lineWidth = 2; }
    ctx.beginPath();
    for (let i = 0; i <= cols; i++) { const x = X + 4 + (W - 8) * i / cols; ctx.moveTo(x, yb); ctx.lineTo(x, yt); }
    if (grow > 0.95) { ctx.moveTo(X + 4, yt); ctx.lineTo(X + W - 4, yt); }
    for (let i = 0; i < cols; i++) { const x0 = X + 4 + (W - 8) * i / cols, x1 = X + 4 + (W - 8) * (i + 1) / cols; ctx.moveTo(x0, yb); ctx.lineTo(x1, yt); }
    ctx.stroke();
  }
  ctx.restore();
}
function drawCrane(X, W, groundY, topY, now, alpha, liftTo) {
  // guindaste amarelo à direita; a lança gira devagar e o gancho iça um painel até o andar atual
  const bx = X + W * 0.9, base = groundY, top = topY;
  const swing = Math.sin(now / 900) * 0.1;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#1B1508'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx, base); ctx.lineTo(bx, top); ctx.stroke();
  ctx.strokeStyle = '#F2C230'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx, base); ctx.lineTo(bx, top); ctx.stroke();
  ctx.strokeStyle = 'rgba(27,21,8,.5)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let y = base - 8; y > top + 4; y -= 8) { ctx.moveTo(bx - 3, y); ctx.lineTo(bx + 3, y - 6); }
  ctx.stroke();
  const jl = W * 0.72; const jx = bx - Math.cos(swing) * jl, jy = top + Math.sin(swing) * jl * 0.2;
  ctx.strokeStyle = '#1B1508'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(bx + W * 0.1, top); ctx.lineTo(jx, jy); ctx.stroke();
  ctx.strokeStyle = '#F2C230'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx + W * 0.1, top); ctx.lineTo(jx, jy); ctx.stroke();
  const hx = bx - Math.cos(swing) * jl * 0.6, hy = top + Math.sin(swing) * jl * 0.12;
  const u = 0.5 + 0.5 * Math.sin(now / 1500); const hookY = liftTo + (base - liftTo) * u;
  ctx.strokeStyle = 'rgba(236,231,218,.85)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx, hookY); ctx.stroke();
  ctx.fillStyle = '#C3CDDF'; ctx.fillRect(hx - 7, hookY, 14, 7); ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.strokeRect(hx - 7, hookY, 14, 7);
  ctx.fillStyle = '#F2C230'; ctx.fillRect(bx - 4, top - 4, 8, 8); ctx.fillStyle = '#1B1508'; ctx.fillRect(bx + W * 0.08, top - 3, 10, 6);
  ctx.restore();
}
function phaseLabel(b) {
  const f = 1 - b.b / b.tt;
  if (!b.up) { if (f < 0.18) return 'Terraplanagem'; if (f < 0.3) return 'Fundação'; }
  const sr = spriteRect(b, b.up || b.lvl); const K = floorsOf(sr);
  const p = clamp(((b.up ? f : (f - 0.3) / 0.6)) * K, 0, K);
  if (f < 0.9) return `Andar ${Math.min(K, Math.floor(p) + 1)} de ${K}`;
  return 'Acabamento';
}
function drawProgress(b, X, W, Yb, z) {
  const f = 1 - b.b / b.tt; const bw = Math.min(W - 10, 120 / Math.max(z, 0.7)), bx0 = X + W / 2 - bw / 2, by0 = Yb - TH * 0.45;
  ctx.fillStyle = 'rgba(5,9,19,.85)'; rr(ctx, bx0 - 3, by0 - 3, bw + 6, 12 / Math.max(z, 0.7) + 2, 6); ctx.fill();
  ctx.fillStyle = b.up ? '#8C7CFF' : '#46E3B5'; rr(ctx, bx0, by0, Math.max(4, bw * f), 6 / Math.max(z, 0.7) + 2, 4); ctx.fill();
  if (z > 0.55) {
    ctx.fillStyle = '#ECE7DA'; ctx.font = `700 ${10 / z}px "Barlow Semi Condensed", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(`${phaseLabel(b)} · ${dur(b.b)}`, X + W / 2, by0 - 3);
  }
}
function drawSlice(sp, sr, K, i, gray, alpha, scale) {
  // desenha o andar i (0 = térreo) do sprite; gray = versão "concreto"
  const fh = sr.H / K, sh = sp.c.height / K; const dy = sr.Yb - (i + 1) * fh, sy = sp.c.height - (i + 1) * sh;
  ctx.save(); ctx.globalAlpha = alpha;
  if (scale !== 1) { ctx.translate(sr.X + sr.W / 2, dy + fh); ctx.scale(scale, scale); ctx.translate(-(sr.X + sr.W / 2), -(dy + fh)); }
  ctx.drawImage(gray ? sp.g : sp.c, 0, sy, sp.c.width, sh, sr.X, dy, sr.W, fh + 0.6);
  ctx.restore();
}
function drawConstruction(b, now, z, f, sr, sp, upgrade) {
  // fases C e D: o prédio sobe andar por andar dentro de sr, com andaime, guindaste e operários
  const t = TYPES[b.t]; const X = b.x * TW, Y = b.y * TH, W = t.w * TW, H = t.h * TH; const ground = Y + H - 3;
  const K = floorsOf(sr); const fh = sr.H / K;
  const c = upgrade ? clamp(f / 0.9, 0, 1) : clamp((f - 0.3) / 0.6, 0, 1);
  const p = c * K; const built = Math.min(K, Math.floor(p)); const q = p - built;
  const finishing = f >= 0.9; const d = finishing ? clamp((f - 0.9) / 0.1, 0, 1) : 0;
  const ts = now / 1000; const wh = TH * 0.46;
  if (b._floorSeen == null || b._floorSeen > built) b._floorSeen = built;
  if (built > b._floorSeen) {
    b._floorSeen = built; b._floorAt = now;
    if (!quiet) for (let i = 0; i < 10; i++) parts.push({ x: sr.X + Math.random() * sr.W, y: sr.Yb - built * fh, vx: rnd(-25, 25), vy: rnd(-30, -5), t: 0, life: 0.7, c: 'rgba(200,190,170,.55)', r: 2 + Math.random() * 2.5 });
  }
  // andares prontos
  for (let i = 0; i < built; i++) {
    let sc = 1; if (i === built - 1 && b._floorAt) { const e = (now - b._floorAt) / 320; if (e < 1) sc = 1 + 0.06 * Math.sin(e * Math.PI); }
    if (sp) drawSlice(sp, sr, K, i, false, 1, sc);
  }
  const topBuilt = sr.Yb - built * fh;
  // andar em obra: vigas → concreto → fachada
  if (built < K && sp && !finishing) {
    const yTop = topBuilt - fh;
    if (q < 0.35) drawFrame3(sr.X + 2, yTop, sr.W - 4, fh, q / 0.35);
    else if (q < 0.7) { drawFrame3(sr.X + 2, yTop, sr.W - 4, fh, 1); drawSlice(sp, sr, K, built, true, clamp((q - 0.35) / 0.15, 0, 1) * 0.95, 1); }
    else { drawSlice(sp, sr, K, built, true, 0.95, 1); drawSlice(sp, sr, K, built, false, clamp((q - 0.7) / 0.3, 0, 1), 1);
      const sw = (q - 0.7) / 0.3; ctx.save(); ctx.globalAlpha = 0.35 * Math.sin(sw * Math.PI); ctx.fillStyle = '#FFF'; ctx.fillRect(sr.X + sr.W * sw - 6, yTop, 12, fh); ctx.restore(); }
    // andaime nos dois andares de cima
    drawScaffold(sr.X + 3, Math.max(sr.Y, yTop - fh * 0.6), sr.W - 6, fh * 1.6, 0.55, now);
  } else if (finishing) {
    if (sp) drawSlice(sp, sr, K, K - 1, false, 1, 1);
    drawScaffold(sr.X + 3, sr.Y, sr.W - 6, fh * 1.2, 0.55 * (1 - d), now);
  }
  // guindaste
  const craneTop = Math.min(topBuilt, sr.Y) - TH * 1.1;
  drawCrane(sr.X, sr.W, ground, craneTop, now, finishing ? 1 - d : 1, Math.max(sr.Y, topBuilt - fh * 0.5));
  // betoneira e placa
  if (!upgrade && !finishing) drawMixer(X + 4, ground, now);
  // operários (só quando dá para ver)
  if (z > 0.42) {
    ctx.save(); ctx.globalAlpha = finishing ? 1 - d : 1;
    const seed = b.id * 7;
    // no chão, na frente
    for (let i = 0; i < 2; i++) {
      const ph = hash(i, seed, 61) * TAU; const u = Math.sin(ts * (0.35 + 0.1 * i) + ph);
      const wx = X + W * (0.5 + 0.38 * u); const dir = Math.cos(ts * (0.35 + 0.1 * i) + ph) < 0;
      drawWorker(wx, ground - 1, wh, ts + i, i === 0 ? 'carry' : 'walk', VESTS[(i + b.id) % 4], dir);
    }
    // no andar em obra
    const floorY = built > 0 ? topBuilt : ground - 2;
    const n = built >= K ? 1 : 3;
    for (let i = 0; i < n; i++) {
      const ph = hash(i + 5, seed, 62); let act = ['hammer', 'walk', 'weld'][i % 3]; let wx;
      if (act === 'walk') { const u = Math.sin(ts * 0.5 + ph * TAU); wx = sr.X + sr.W * (0.5 + 0.35 * u); }
      else wx = sr.X + sr.W * (0.18 + 0.64 * ph);
      const dir = act === 'walk' ? Math.cos(ts * 0.5 + ph * TAU) < 0 : ph > 0.5;
      drawWorker(wx, floorY + (built > 0 ? 2 : 0), wh, ts + i * 1.7, act, VESTS[(i + b.id + 1) % 4], dir);
      if (act === 'weld' && !quiet && !finishing && Math.random() < 0.3) {
        const hx = wx + (dir ? -1 : 1) * wh * 0.4, hy = floorY - wh * 0.62;
        for (let k = 0; k < 3; k++) parts.push({ x: hx, y: hy, vx: rnd(-40, 40), vy: rnd(-50, 10), t: 0, life: 0.25 + Math.random() * 0.2, c: Math.random() < 0.5 ? '#FFF6C8' : '#FFD34D', r: 1.2 + Math.random() });
      }
    }
    ctx.restore();
  }
}
function drawBuilding(b, now, z) {
  const t = TYPES[b.t];
  let lift = 0;
  if (b.fx) { const e = (now - b.fx) / 650; if (e < 1) lift = Math.sin(e * Math.PI) * 8; else b.fx = 0; }
  if (b.b > 0 && !b.up) {
    // obra nova
    const f = 1 - b.b / b.tt; const sr = spriteRect(b); const sp = SPR[sr.img];
    drawSite(b, now, z, f);
    if (f < 0.3) {
      if (z > 0.42) {
        const X = b.x * TW, Y = b.y * TH, W = t.w * TW, H = t.h * TH; const ground = Y + H - 3; const ts = now / 1000;
        for (let i = 0; i < 2; i++) drawWorker(X + W * (0.3 + 0.4 * i), Y + H * (0.5 + 0.2 * i), TH * 0.46, ts + i, 'shovel', VESTS[(i + b.id) % 4], i === 1);
        if (f >= 0.18) drawMixer(X + 4, ground, now);
      }
    } else drawConstruction(b, now, z, f, sr, sp, false);
    return;
  }
  const sr = spriteRect(b); const sp = SPR[sr.img];
  if (sp) ctx.drawImage(sp.c, sr.X, sr.Y - lift, sr.W, sr.H);
  else { ctx.fillStyle = '#556'; ctx.fillRect(sr.X, sr.Y, sr.W, sr.H); }
  if (b.up) {
    // melhoria: a nova maquete sobe andar por andar por cima da antiga
    const f = 1 - b.b / b.tt; const nr = spriteRect(b, b.up); const np = SPR[nr.img];
    drawConstruction(b, now, z, f, nr, np, true);
  }
  if (!b._on && b.b <= 0 && !b._con) { ctx.fillStyle = 'rgba(20,10,0,.25)'; ctx.fillRect(sr.X, sr.Y, sr.W, sr.H); }
  if (t.res && z > 0.5) {
    ctx.fillStyle = 'rgba(5,9,19,.8)'; const s = 12 / z;
    rr(ctx, sr.X + 3, sr.Yb - s - 3, s * 1.2, s, 3 / z); ctx.fill();
    ctx.fillStyle = '#E8CB86'; ctx.font = `700 ${9.5 / z}px "Barlow Semi Condensed", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(b.lvl), sr.X + 3 + s * 0.6, sr.Yb - s / 2 - 3);
  }
}
function badge(cx, cy, r, col, path, stroke) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = col; ctx.fill();
  ctx.lineWidth = r * 0.16; ctx.strokeStyle = 'rgba(5,9,19,.9)'; ctx.stroke();
  ctx.save(); ctx.translate(cx, cy); ctx.scale(r / 15, r / 15); ctx.translate(-12, -12);
  if (stroke) { ctx.lineWidth = 2.2; ctx.strokeStyle = '#10141D'; ctx.stroke(path); } else { ctx.fillStyle = '#10141D'; ctx.fill(path); }
  ctx.restore();
}
function drawBadges(b, now, z) {
  const t = TYPES[b.t]; const sr = spriteRect(b);
  if (b.b > 0) drawProgress(b, sr.X, sr.W, sr.Yb, z);
  if (b.b > 0 && !b.up) return;
  const r = 11 / z; const bob = Math.sin(now / 320 + b.id) * 2 / z;
  const cx = sr.X + sr.W / 2, top = Math.min(sr.Y, sr.Yb - t.h * TH * 0.8);
  let kind = null;
  if (!b._con) kind = 'road';
  else if ((t.res || t.useP) && D.effP < 0.999) kind = 'bolt';
  else if ((t.res || t.useW) && D.effW < 0.999) kind = 'drop';
  else if ((t.res || t.useR) && D.effR < 0.999) kind = 'recy';
  else if (b._jam) kind = 'jam';
  if (kind) {
    const col = { road: '#F08A3C', bolt: '#FFD34D', drop: '#5BC0EB', recy: '#86DB91', jam: '#FF6A5C' }[kind];
    const path = { road: P_ROAD, bolt: P_BOLT, drop: P_DROP, recy: P_RECY, jam: P_CAR }[kind];
    badge(cx - r * 1.3, top - r * 0.6 + bob, r, col, path);
  }
  // bolhas tocáveis
  let bx = cx + (kind ? r * 1.3 : 0);
  const bub = (kindB, col, path, text) => {
    const y = top - r * 0.6 + bob;
    badge(bx, y, r * 1.15, col, path);
    if (text != null) {
      ctx.fillStyle = 'rgba(5,9,19,.9)'; ctx.font = `700 ${9 / z}px "Barlow Semi Condensed", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(text).width + 8 / z; rr(ctx, bx - tw / 2, y + r * 0.8, tw, 12 / z, 4 / z); ctx.fill();
      ctx.fillStyle = '#ECE7DA'; ctx.fillText(text, bx, y + r * 0.8 + 6 / z);
    }
    hits.push({ x: bx, y, r: r * 1.5, b, kind: kindB }); bx += r * 2.6;
  };
  if (b.done && b.done.length) bub('collect', '#E8CB86', P_BOX, '×' + b.done.length);
  if (b.t === 'sede' && S.taxAcc >= Math.max(20, taxCap() * 0.05)) bub('tax', '#E8CB86', P_COIN, '§' + fmt(S.taxAcc));
  if (t.res && b.need && !b.up && hasNeed(b.need)) bub('upgrade', '#46E3B5', P_UP, null);
  if (b.req) bub('req', '#8C7CFF', P_CHAT, ITEMS[b.req.k].short);
  if (b.t === 'tra1' && S.cargo.order && S.cargo.order.every(l => l.ok)) bub('cargo', '#46E3B5', P_BOX, 'Despachar');
}
function drawGhost(now, z) {
  const t = TYPES[ghost.t]; const b = { t: ghost.t, x: ghost.x, y: ghost.y, lvl: 1 };
  const sr = spriteRect(b); const sp = SPR[sr.img];
  const X = ghost.x * TW, Y = ghost.y * TH, W = t.w * TW, H = t.h * TH;
  const ok = !ghost.err;
  ctx.fillStyle = ok ? 'rgba(70,227,181,.3)' : 'rgba(255,106,92,.35)'; ctx.fillRect(X, Y, W, H);
  if (sp) { ctx.globalAlpha = 0.88; ctx.drawImage(sp.c, sr.X, sr.Y - 6, sr.W, sr.H); ctx.globalAlpha = 1; }
  ctx.strokeStyle = ok ? '#46E3B5' : '#FF6A5C'; ctx.lineWidth = 3 / z; ctx.setLineDash([10 / z, 6 / z]);
  ctx.lineDashOffset = -now / 50; ctx.strokeRect(X, Y, W, H); ctx.setLineDash([]); ctx.lineDashOffset = 0;
  const cx = X + W / 2, cy = Y + H + 14 / z;
  ctx.fillStyle = 'rgba(5,9,19,.85)'; rr(ctx, cx - 40 / z, cy - 10 / z, 80 / z, 20 / z, 10 / z); ctx.fill();
  ctx.fillStyle = '#ECE7DA'; ctx.font = `600 ${11 / z}px "Barlow Semi Condensed", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('✥ arraste para mover', cx, cy + 0.5 / z);
}
function drawRadius(cx, cy, rad, a, z, col = '70,227,181') {
  ctx.beginPath(); ctx.ellipse(cx * TW, cy * TH, rad * TW, rad * TH, 0, 0, TAU);
  ctx.fillStyle = `rgba(${col},${0.08 * a})`; ctx.fill();
  ctx.strokeStyle = `rgba(${col},${0.6 * a})`; ctx.lineWidth = 2 / z; ctx.setLineDash([8 / z, 6 / z]); ctx.stroke(); ctx.setLineDash([]);
}

/* ---------------- quadro ---------------- */
let lastRender = performance.now();
function render(now) {
  const fdt = Math.min(0.1, (now - lastRender) / 1000); lastRender = now;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
  const k = dpr * cam.z;
  ctx.setTransform(k, 0, 0, k, dpr * (vw / 2 - cam.x * cam.z), dpr * (vh / 2 - cam.y * cam.z));
  drawFrame();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tcv, 0, 0, tcv.width, tcv.height, 0, 0, N * TW, N * TH);

  const [ax, ay] = s2w(0, 0), [bx, by] = s2w(vw, vh);
  const x0 = clamp(Math.floor(ax / TW) - 1, 0, N - 1), y0 = clamp(Math.floor(ay / TH) - 1, 0, N - 1);
  const x1 = clamp(Math.ceil(bx / TW) + 1, 0, N - 1), y1 = clamp(Math.ceil(by / TH) + 3, 0, N - 1);
  const z = cam.z;

  // brilho da água
  ctx.strokeStyle = 'rgba(180,225,255,.09)'; ctx.lineWidth = 1.5; ctx.beginPath();
  const ph = now / 1400;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (WATER[y * N + x] && !ROAD[y * N + x] && hash(x, y, 21) < 0.5) {
    const ox = x * TW + TW * (0.2 + 0.5 * hash(x, y, 22)) + Math.sin(ph + x) * 3, oy = y * TH + TH * (0.3 + 0.4 * hash(x, y, 23));
    ctx.moveTo(ox, oy); ctx.lineTo(ox + TW * 0.28, oy);
  }
  ctx.stroke();

  drawRoads(x0, y0, x1, y1, z);

  // terreno bloqueado
  const r = landRect();
  ctx.fillStyle = 'rgba(4,8,18,.6)';
  ctx.fillRect(0, 0, N * TW, r.y0 * TH); ctx.fillRect(0, (r.y1 + 1) * TH, N * TW, (N - r.y1 - 1) * TH);
  ctx.fillRect(0, r.y0 * TH, r.x0 * TW, r.s * TH); ctx.fillRect((r.x1 + 1) * TW, r.y0 * TH, (N - r.x1 - 1) * TW, r.s * TH);
  if (r.s < N) {
    ctx.setLineDash([10, 8]); ctx.strokeStyle = 'rgba(232,203,134,.7)'; ctx.lineWidth = 2 / z;
    ctx.strokeRect(r.x0 * TW, r.y0 * TH, r.s * TW, r.s * TH); ctx.setLineDash([]);
  }
  if (mode !== 'normal') {
    ctx.strokeStyle = 'rgba(236,231,218,.09)'; ctx.lineWidth = 1 / z; ctx.beginPath();
    for (let x = Math.max(x0, r.x0); x <= Math.min(x1 + 1, r.x1 + 1); x++) { ctx.moveTo(x * TW, Math.max(y0, r.y0) * TH); ctx.lineTo(x * TW, Math.min(y1 + 1, r.y1 + 1) * TH); }
    for (let y = Math.max(y0, r.y0); y <= Math.min(y1 + 1, r.y1 + 1); y++) { ctx.moveTo(Math.max(x0, r.x0) * TW, y * TH); ctx.lineTo(Math.min(x1 + 1, r.x1 + 1) * TW, y * TH); }
    ctx.stroke();
  }

  // raios de cobertura
  if (mode === 'place' && ghost) {
    const gt = TYPES[ghost.t];
    if (gt.radius) drawRadius(ghost.x + gt.w / 2, ghost.y + gt.h / 2, gt.radius, 0.9, z, gt.cov === 'par' || gt.transit ? '70,227,181' : gt.cov === 'seg' ? '140,124,255' : gt.cov === 'sau' ? '255,120,140' : '240,180,76');
    if (gt.res) for (const f of D.covs) { const ft = TYPES[f.t]; if (ft.cov === 'par') drawRadius(f.x + ft.w / 2, f.y + ft.h / 2, ft.radius, 0.35, z); }
  } else if (sel && TYPES[sel.t].radius) { const st = TYPES[sel.t]; drawRadius(sel.x + st.w / 2, sel.y + st.h / 2, st.radius, 0.9, z, st.cov === 'par' || st.transit ? '70,227,181' : st.cov === 'seg' ? '140,124,255' : st.cov === 'sau' ? '255,120,140' : '240,180,76'); }

  // seleção no chão
  if (sel && !(ghost && ghost.moving === sel)) {
    const t = TYPES[sel.t]; const pulse = 0.55 + 0.45 * Math.sin(now / 260);
    ctx.strokeStyle = `rgba(232,203,134,${pulse})`; ctx.lineWidth = 3 / z;
    rr(ctx, sel.x * TW - 3 / z, sel.y * TH - 3 / z, t.w * TW + 6 / z, t.h * TH + 6 / z, 6); ctx.stroke();
  }

  // lista de desenho ordenada (árvores, construções, carros)
  const list = treeList(x0, y0, x1, y1);
  for (const b of S.bld) {
    const t = TYPES[b.t]; if (ghost && ghost.moving === b) continue;
    const sr = spriteRect(b);
    if (sr.X + sr.W < ax || sr.X > bx || sr.Yb < ay || sr.Y > by) continue;
    groundShadow(b);
    list.push({ kind: 'bld', b, by: b.y + t.h - 0.01, x: b.x });
  }
  if (!quiet) updateCars(fdt);
  if (z > 0.3) for (const c of cars) { const y = (c.i / N) | 0, x = c.i % N; if (x >= x0 && x <= x1 && y >= y0 && y <= y1) list.push({ kind: 'car', c, by: y + 0.5 }); }
  list.sort((a, b) => a.by - b.by || (a.x || 0) - (b.x || 0));
  for (const it of list) { if (it.kind === 'tree') drawTree(it, z); else if (it.kind === 'bld') drawBuilding(it.b, now, z); else drawCar(it.c, z); }

  if (mode === 'place' && ghost) drawGhost(now, z);

  // selos e bolhas
  hits = [];
  if (z > 0.38) for (const it of list) if (it.kind === 'bld') drawBadges(it.b, now, z);

  // partículas e textos flutuantes
  for (const p of parts) { p.t += fdt; p.x += p.vx * fdt; p.y += p.vy * fdt; p.vy += 120 * fdt; }
  parts = parts.filter(p => p.t < p.life);
  for (const p of parts) { ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r / Math.max(z, 0.6), 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  const fs = 13 / z;
  ctx.font = `700 ${fs}px "Barlow Semi Condensed", "Arial Narrow", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 3 / z; ctx.strokeStyle = 'rgba(5,9,19,.85)';
  for (const f of floats) {
    const p = f.t / f.life, a = p < 0.15 ? p / 0.15 : 1 - Math.max(0, (p - 0.55) / 0.45);
    const y = f.y - p * 34 / Math.max(z, 0.6);
    ctx.globalAlpha = clamp(a, 0, 1); ctx.strokeText(f.text, f.x, y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, y);
  }
  ctx.globalAlpha = 1;
}
