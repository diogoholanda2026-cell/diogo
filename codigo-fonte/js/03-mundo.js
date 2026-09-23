/* =========================================================
   03 · mundo: terreno, estradas, estado e recálculo
   ========================================================= */
const WATER = new Uint8Array(N * N);
const TREE = new Uint8Array(N * N);
const ROAD = new Uint8Array(N * N);     // 0 nada · 1 rua · 2 avenida · 3 via expressa
const HWY = new Uint8Array(N * N);      // rodovia de entrada (fixa)
const OCC = new Int32Array(N * N);      // id da construção
const CONN = new Uint8Array(N * N);     // estrada ligada à rodovia
const STRETCH = new Int32Array(N * N);  // id do trecho de rua (para o trânsito)
const HIGHWAY_Y = 24;
let stretches = [];                     // [{tiles:[], load, cap, jam, lvl}]

function genTerrain() {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x; let w = false;
    // rio serpenteando à direita
    const cx = 41 + 2.2 * Math.sin(y * 0.21) + 1.2 * Math.sin(y * 0.57 + 1.3);
    if (Math.abs(x + 0.5 - cx) < 1.15 + 0.4 * Math.sin(y * 0.4)) w = true;
    // lagos
    const lakes = [[40, 33, 4.2, 3.0], [7.5, 8, 3.0, 2.3], [8, 38, 2.6, 3.2], [30, 6, 2.4, 1.8]];
    for (const [lx, ly, rx, ry] of lakes) {
      const dx = (x + 0.5 - lx) / rx, dy = (y + 0.5 - ly) / ry;
      if (dx * dx + dy * dy < 1 + (vnoise(x, y, 3, 5) - 0.5) * 0.5) w = true;
    }
    if (y === HIGHWAY_Y) w = false;
    WATER[i] = w ? 1 : 0;
    TREE[i] = !w && hash(x, y, 7) < 0.16 + 0.5 * (vnoise(x, y, 5, 9) - 0.42) ? 1 : 0;
  }
}

/* ---------------- estado ---------------- */
let S = null;              // estado salvo
const D = {                // estado derivado (recalculado)
  pop: 0, joy: 0.5, taxH: 0, pS: 0, pD: 0, wS: 0, wD: 0, rS: 0, rD: 0, effP: 1, effW: 1, effR: 1, needR: false,
  taxMul: 1, prodMul: 1, cap: STORE_BASE, used: 0, counts: {}, done: {}, sede: null, covs: [], transit: [], jams: 0,
  ready: 0, // itens prontos para coletar em toda a cidade
};
const byId = new Map();

function landRect(k = S.land) { const s = LAND[k]; const o = (N - s) / 2; return { x0: o, y0: o, x1: o + s - 1, y1: o + s - 1, s }; }
function unlocked(x, y) { const r = landRect(); return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1; }
function layHighway() {
  // a rodovia de entrada vai da borda da mesa até o terreno inicial e é fixa
  HWY.fill(0);
  const x0 = landRect(0).x0;
  for (let x = 0; x < x0; x++) { const i = HIGHWAY_Y * N + x; HWY[i] = 1; ROAD[i] = 3; }
}

function newGame() {
  S = { v: 2, created: Date.now(), savedAt: Date.now(), credits: 3000, gems: 20, keys: 0, pecas: 0, xp: 0, level: 1, land: 0, storeUp: 0, speed: 1,
    items: {}, goal: 0, nextId: 1, bld: [], won: false, played: 0, taxAcc: 0,
    cargo: { order: null, wait: 0 }, market: { offers: [], wait: 0 }, depot: [null, null, null, null], reqT: 40,
    stats: { roads: 0, built: 0, upgrades: 0, earned: 0, made: {}, queued: 0, taxes: 0, cargo: 0, sold: 0 } };
  ROAD.fill(0); layHighway();
  const r = landRect();
  for (let x = r.x0; x < r.x0 + 11; x++) ROAD[HIGHWAY_Y * N + x] = 1;
  for (let y = HIGHWAY_Y - 4; y <= HIGHWAY_Y + 4; y++) if (y !== HIGHWAY_Y) ROAD[y * N + r.x0 + 6] = 1;
  const add = (t, x, y, lvl = 1) => { const b = { id: S.nextId++, t, x, y, lvl, b: 0, tt: 0 }; initB(b); S.bld.push(b); return b; };
  add('sede', r.x0 + 7, HIGHWAY_Y - 2);
  add('zona', r.x0 + 3, HIGHWAY_Y - 2);
  add('zona', r.x0 + 3, HIGHWAY_Y + 1);
  add('ener1', r.x0 + 7, HIGHWAY_Y + 1);
  add('agua1', r.x0 + 10, HIGHWAY_Y + 1);
  add('fab1', r.x0 + 7, HIGHWAY_Y + 3);
  S.items.ligas = 2;
  refreshMarket();
  recalc();
}
function initB(b) {
  const t = TYPES[b.t];
  if (t.res) { if (!b.need) b.need = genNeed(b.lvl); }
  if (t.slots) { if (!b.q) b.q = []; if (!b.done) b.done = []; }
}

/* ---------------- regras de posição ---------------- */
function footprintOk(t, x, y, ignoreId) {
  const tp = TYPES[t];
  if (x < 0 || y < 0 || x + tp.w > N || y + tp.h > N) return 'Fora da mesa';
  for (let yy = y; yy < y + tp.h; yy++) for (let xx = x; xx < x + tp.w; xx++) {
    const i = yy * N + xx;
    if (!unlocked(xx, yy)) return 'Terreno bloqueado — expanda a cidade na Sede';
    if (WATER[i]) return 'Não dá para construir sobre a água';
    if (ROAD[i]) return 'Há uma rua no caminho';
    if (OCC[i] && OCC[i] !== ignoreId) return 'Espaço ocupado';
  }
  return '';
}
function adjRoads(x, y, w, h) {
  const out = [];
  for (let xx = x; xx < x + w; xx++) {
    if (y > 0 && ROAD[(y - 1) * N + xx]) out.push((y - 1) * N + xx);
    if (y + h < N && ROAD[(y + h) * N + xx]) out.push((y + h) * N + xx);
  }
  for (let yy = y; yy < y + h; yy++) {
    if (x > 0 && ROAD[yy * N + x - 1]) out.push(yy * N + x - 1);
    if (x + w < N && ROAD[yy * N + x + w]) out.push(yy * N + x + w);
  }
  return out;
}
function rectConnected(x, y, w, h) { return adjRoads(x, y, w, h).some(i => CONN[i]); }
function popOf(b) {
  const t = TYPES[b.t];
  if (t.res) return RES_STAGES[b.lvl - 1].pop;
  return t.pop || 0;
}
function coverDist(f, b) {
  const tf = TYPES[f.t], tb = TYPES[b.t];
  const cx = f.x + tf.w / 2, cy = f.y + tf.h / 2;
  const nx = clamp(cx, b.x, b.x + tb.w), ny = clamp(cy, b.y, b.y + tb.h);
  return Math.hypot(cx - nx, cy - ny);
}
function roadDeg(i) {
  const x = i % N, y = (i / N) | 0; let d = 0;
  if (x > 0 && ROAD[i - 1]) d++; if (x < N - 1 && ROAD[i + 1]) d++;
  if (y > 0 && ROAD[i - N]) d++; if (y < N - 1 && ROAD[i + N]) d++;
  return d;
}

/* ---------------- recálculo do estado derivado ---------------- */
function recalc() {
  OCC.fill(0); byId.clear(); D.counts = {}; D.done = {};
  for (const b of S.bld) {
    const t = TYPES[b.t]; byId.set(b.id, b);
    D.counts[b.t] = (D.counts[b.t] || 0) + 1;
    if (b.b <= 0 || b.up) D.done[b.t] = (D.done[b.t] || 0) + 1;
    for (let y = b.y; y < b.y + t.h; y++) for (let x = b.x; x < b.x + t.w; x++) OCC[y * N + x] = b.id;
  }
  // estradas ligadas à rodovia
  CONN.fill(0);
  const q = [];
  for (let i = 0; i < N * N; i++) if (HWY[i]) { CONN[i] = 1; q.push(i); }
  while (q.length) {
    const i = q.pop(), x = i % N, y = (i / N) | 0;
    const nb = [x > 0 ? i - 1 : -1, x < N - 1 ? i + 1 : -1, y > 0 ? i - N : -1, y < N - 1 ? i + N : -1];
    for (const j of nb) if (j >= 0 && ROAD[j] && !CONN[j]) { CONN[j] = 1; q.push(j); }
  }
  // trechos de rua (entre cruzamentos)
  STRETCH.fill(-1); stretches = [];
  for (let i = 0; i < N * N; i++) {
    if (!ROAD[i] || STRETCH[i] >= 0) continue;
    const st = { tiles: [], load: 0, cap: 0, jam: false, lvl: 3, hwy: false };
    const id = stretches.length; stretches.push(st);
    if (roadDeg(i) > 2) { STRETCH[i] = id; st.tiles.push(i); st.lvl = ROAD[i]; if (HWY[i]) st.hwy = true; continue; }
    const stack = [i]; STRETCH[i] = id;
    while (stack.length) {
      const j = stack.pop(); st.tiles.push(j); st.lvl = Math.min(st.lvl, ROAD[j]); if (HWY[j]) st.hwy = true;
      const x = j % N, y = (j / N) | 0;
      const nb = [x > 0 ? j - 1 : -1, x < N - 1 ? j + 1 : -1, y > 0 ? j - N : -1, y < N - 1 ? j + N : -1];
      for (const k of nb) if (k >= 0 && ROAD[k] && STRETCH[k] < 0 && roadDeg(k) <= 2) { STRETCH[k] = id; stack.push(k); }
    }
  }
  for (const st of stretches) st.cap = ROAD_CAP[st.lvl] * (st.tiles.length <= 2 ? 0.6 : 1);
  // ligações, oferta e demanda
  let pS = 0, pD = 0, wS = 0, wD = 0, rS = 0, rD = 0; const has = {}; const covs = []; const transit = [];
  D.sede = null; D.ready = 0;
  for (const b of S.bld) {
    const t = TYPES[b.t];
    b._adj = adjRoads(b.x, b.y, t.w, t.h);
    b._con = b._adj.some(i => CONN[i]);
    b._on = b._con && (b.b <= 0 || !!b.up);
    b._jam = false;
    if (b.t === 'sede') D.sede = b;
    if (t.slots) D.ready += (b.done || []).length;
    if (!b._on) continue;
    has[b.t] = true;
    if (t.power) pS += t.power; if (t.water) wS += t.water; if (t.waste) rS += t.waste;
    const p = popOf(b);
    if (p) { pD += p / 12; wD += p / 12; rD += p / 16; }
    pD += t.useP || 0; wD += t.useW || 0; rD += t.useR || 0;
    if (t.cov) covs.push(b);
    if (t.transit) transit.push(b);
    // tráfego gerado nas ruas encostadas
    if (b._adj.length) {
      const wgt = (t.traffic || 0) + (t.res ? 1 + b.lvl * 0.8 : 0) + (t.pop ? t.pop / 800 : 0);
      const per = wgt / b._adj.length;
      for (const i of b._adj) if (STRETCH[i] >= 0) stretches[STRETCH[i]].load += per;
    }
  }
  // estações transit ampliam a capacidade dos trechos por perto
  for (const st of stretches) {
    for (const tr of transit) {
      const t = TYPES[tr.t]; const cx = tr.x + t.w / 2, cy = tr.y + t.h / 2;
      if (st.tiles.some(i => Math.hypot(i % N + 0.5 - cx, ((i / N) | 0) + 0.5 - cy) <= t.radius)) st.cap += t.transit;
    }
    st.jam = !st.hwy && st.load > st.cap + 0.001;
  }
  D.jams = 0;
  for (const st of stretches) if (st.jam) D.jams++;
  D.pS = pS; D.pD = pD; D.wS = wS; D.wD = wD; D.rS = rS; D.rD = rD;
  D.effP = pD > 0 ? Math.min(1, pS / pD) : 1;
  D.effW = wD > 0 ? Math.min(1, wS / wD) : 1;
  // a reciclagem só passa a ser exigida quando a primeira estação fica disponível
  D.needR = S.level >= TYPES.rec1.unlock;
  D.effR = D.needR && rD > 0 ? Math.min(1, rS / rD) : 1;
  const askSeg = S.level >= TYPES.seg1.unlock, askSau = S.level >= TYPES.sau1.unlock, askEdu = S.level >= TYPES.edu1.unlock;
  D.prodMul = 1 + (has.ciencia ? 0.25 : 0) + (has.held ? 0.25 : 0);
  D.taxMul = (1 + (has.arco ? 0.1 : 0) + (has.holding ? 0.25 : 0) + (has.held ? 0.5 : 0));
  D.cap = STORE_BASE + STORE_STEP * S.storeUp + (has.holding ? 60 : 0);
  D.covs = covs; D.transit = transit;
  // felicidade e impostos
  let pop = 0, joyW = 0, taxH = 0;
  for (const b of S.bld) {
    const t = TYPES[b.t]; b._inc = 0;
    if (!b._on) continue;
    if (b._adj.some(i => STRETCH[i] >= 0 && stretches[STRETCH[i]].jam)) b._jam = true;
    const p = popOf(b);
    if (t.res || t.pop) {
      const c = { seg: false, sau: false, edu: false, par: 0 };
      for (const f of covs) {
        if (f === b) continue; const ft = TYPES[f.t];
        if (coverDist(f, b) <= ft.radius) { if (ft.cov === 'par') c.par += ft.joy || 0; else c[ft.cov] = true; if (ft.joy && ft.cov !== 'par') c.par += ft.joy; }
      }
      let h = 0.5;
      h += D.effP >= 0.999 ? 0.08 : -0.22 * (1 - D.effP) - 0.06;
      h += D.effW >= 0.999 ? 0.08 : -0.22 * (1 - D.effW) - 0.06;
      if (D.needR) h += D.effR >= 0.999 ? 0.05 : -0.12 * (1 - D.effR) - 0.03;
      if (askSeg) h += c.seg ? 0.08 : -0.06;
      if (askSau) h += c.sau ? 0.08 : -0.06;
      if (askEdu) h += c.edu ? 0.06 : -0.03;
      h += Math.min(0.32, c.par);
      if (b._jam) h -= 0.14;
      b._cov = c; b._joy = clamp(h, 0.02, 1);
      const tf = clamp((b._joy - 0.3) / 0.6, 0.1, 1.15);
      b._inc = p * 2.0 * tf * D.taxMul;
      taxH += b._inc; pop += p; joyW += p * b._joy;
    }
    if (t.tourism) { b._inc = t.tourism * D.taxMul; taxH += b._inc; }
  }
  D.pop = pop; D.joy = pop ? joyW / pop : 0.5; D.taxH = taxH;
  D.used = 0; for (const k in S.items) D.used += S.items[k] || 0;
  uiDirty = true; worldDirty = true;
}
