/* =========================================================
   06 · entrada: toque, mouse, modos de posicionar e ruas
   ========================================================= */
let mode = 'normal', ghost = null, sel = null, roadTool = 'draw';

function spiralFind(t, cx, cy, ignoreId) {
  const tp = TYPES[t]; let best = null;
  for (let rad = 0; rad < N; rad++) {
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
      const x = cx + dx - Math.floor(tp.w / 2), y = cy + dy - Math.floor(tp.h / 2);
      if (footprintOk(t, x, y, ignoreId)) continue;
      if (rectConnected(x, y, tp.w, tp.h)) return [x, y];
      if (!best) best = [x, y];
    }
    if (best && rad > 6) return best;
  }
  return best;
}
function startPlace(t, moving) {
  closeSheet(true); closeBuildMenu();
  mode = 'place';
  const [cx, cy] = tileAt(vw / 2, vh / 2);
  ghost = { t, x: 0, y: 0, moving: moving || null, err: '' };
  const spot = moving ? [moving.x, moving.y] : spiralFind(t, cx, cy, 0) || [cx, cy];
  setGhost(spot[0], spot[1]);
  if (!moving) centerOnGhost();
  $('#dock').hidden = true; $('#side').hidden = true; $('#placebar').hidden = false; $('#goal').hidden = true;
  $('#pOk').textContent = moving ? 'Mover aqui' : 'Construir';
  $('#pCancel').textContent = 'Cancelar';
  banner('Arraste a construção ou toque no mapa onde quer colocá-la');
}
function centerOnGhost() {
  const t = TYPES[ghost.t]; const cx = (ghost.x + t.w / 2) * TW, cy = (ghost.y + t.h / 2) * TH;
  const [ax, ay] = s2w(40, 150), [bx, by] = s2w(vw - 40, vh - 170);
  if (cx < ax || cx > bx || cy < ay || cy > by) { cam.x = cx; cam.y = cy; clampCam(); }
}
function setGhost(x, y) {
  const t = TYPES[ghost.t];
  ghost.x = clamp(x, 0, N - t.w); ghost.y = clamp(y, 0, N - t.h);
  ghost.err = footprintOk(ghost.t, ghost.x, ghost.y, ghost.moving ? ghost.moving.id : 0);
  updatePlaceBar();
}
function updatePlaceBar() {
  if (!ghost) return;
  const t = TYPES[ghost.t]; const pm = $('#pMsg');
  $('#pName').textContent = t.name;
  let msg, cls, ok = !ghost.err;
  if (ghost.err) { msg = ghost.err; cls = 'bad'; }
  else if (!ghost.moving && !canPay(t.cost, t.keys, t.items)) { msg = 'Faltam recursos: ' + lackText(t); cls = 'bad'; ok = false; }
  else if (!rectConnected(ghost.x, ghost.y, t.w, t.h)) { msg = 'Sem rua encostada — só funciona depois de ligar a uma rua'; cls = 'warn'; }
  else { msg = ghost.moving ? 'Local livre e ligado à rua' : `§${fmt(t.cost)}${t.keys ? ' + ' + t.keys + ' chaves' : ''}${t.items ? ' + itens' : ''} · obra de ${dur(t.time)}`; cls = 'ok'; }
  pm.textContent = msg; pm.className = cls;
  $('#pOk').disabled = !ok;
}
function lackText(t) {
  const out = []; if (S.credits < (t.cost || 0)) out.push('§' + fmt(t.cost - S.credits));
  if (t.keys && S.keys < t.keys) out.push((t.keys - S.keys) + ' chaves');
  if (t.items) for (const k in t.items) if ((S.items[k] || 0) < t.items[k]) out.push((t.items[k] - (S.items[k] || 0)) + ' ' + ITEMS[k].short);
  return out.join(', ');
}
function confirmPlace() {
  if (!ghost || ghost.err) return;
  const t = TYPES[ghost.t];
  if (ghost.moving) {
    const b = ghost.moving; b.x = ghost.x; b.y = ghost.y; b.fx = performance.now();
    recalc(); markDirty(); endPlace(); toast('Construção movida.', 'good'); return;
  }
  if (t.unique && cnt(ghost.t) > 0) { toast('Só é possível ter uma desta.', 'bad'); endPlace(); return; }
  if (!canPay(t.cost, t.keys, t.items)) { updatePlaceBar(); return; }
  pay(t.cost, t.keys, t.items);
  const b = { id: S.nextId++, t: ghost.t, x: ghost.x, y: ghost.y, lvl: 1, b: t.time, tt: t.time };
  initB(b); S.bld.push(b);
  recalc(); markDirty();
  burst(b.x + t.w / 2, b.y + t.h / 2, 10);
  if (t.unique || t.cat === 'mega') { endPlace(); return; }
  const spot = spiralFind(ghost.t, ghost.x + Math.floor(t.w / 2), ghost.y + Math.floor(t.h / 2), 0);
  if (spot) setGhost(spot[0], spot[1]); else setGhost(ghost.x, ghost.y);
  $('#pCancel').textContent = 'Pronto';
  banner('Obra iniciada! Toque em outro lugar para fazer mais uma, ou em Pronto');
}
function endPlace() {
  mode = 'normal'; ghost = null; sel = null;
  $('#placebar').hidden = true; $('#dock').hidden = false; $('#side').hidden = false; $('#goal').hidden = false; banner('');
}
function startRoads() {
  closeSheet(true); closeBuildMenu(); mode = 'road'; roadTool = 'draw'; syncRoadTool();
  $('#dock').hidden = true; $('#side').hidden = true; $('#roadbar').hidden = false; $('#goal').hidden = true;
  banner('Deslize um dedo para traçar · dois dedos movem o mapa');
}
function endRoads() { mode = 'normal'; $('#roadbar').hidden = true; $('#dock').hidden = false; $('#side').hidden = false; $('#goal').hidden = false; banner(''); recalc(); markDirty(); }
function syncRoadTool() {
  for (const [id, k] of [['#rDraw', 'draw'], ['#rUp', 'up'], ['#rErase', 'erase']]) $(id).classList.toggle('on', roadTool === k);
  $('#rMsg').textContent = roadTool === 'draw' ? `Rua §${ROAD_COST[1]} por quadrado · ponte 3×` : roadTool === 'up' ? `Avenida §${ROAD_COST[2]} · Via expressa §${ROAD_COST[3]} por quadrado` : 'Devolve metade do valor';
  banner(roadTool === 'draw' ? 'Deslize um dedo para traçar · dois dedos movem o mapa' : roadTool === 'up' ? 'Toque ou deslize sobre ruas para subir o nível (menos trânsito)' : 'Toque ou deslize sobre ruas para remover');
}
let roadWarned = 0;
function roadApply(x, y) {
  if (!inb(x, y)) return; const i = y * N + x;
  if (HWY[i]) return;
  if (roadTool === 'draw') {
    if (ROAD[i]) return;
    if (!unlocked(x, y)) { warnRoad('Terreno bloqueado — expanda a cidade na Sede'); return; }
    if (OCC[i]) return;
    const c = ROAD_COST[1] * (WATER[i] ? 3 : 1);
    if (S.credits < c) { warnRoad('Créditos insuficientes'); return; }
    S.credits -= c; ROAD[i] = 1; S.stats.roads++;
  } else if (roadTool === 'up') {
    if (!ROAD[i] || ROAD[i] >= 3) return;
    const c = ROAD_COST[ROAD[i] + 1] * (WATER[i] ? 2 : 1);
    if (S.credits < c) { warnRoad('Créditos insuficientes'); return; }
    S.credits -= c; ROAD[i]++;
  } else {
    if (!ROAD[i]) return;
    ROAD[i] = 0; S.credits += ROAD_COST[1] / 2 * (WATER[i] ? 3 : 1);
  }
  needRecalc = true;
}
function warnRoad(m) { const n = performance.now(); if (n - roadWarned > 1500) { roadWarned = n; toast(m, 'bad'); } }
function roadLine(a, b) {
  let [x, y] = a; let guard = 200;
  while ((x !== b[0] || y !== b[1]) && guard--) {
    if (Math.abs(b[0] - x) >= Math.abs(b[1] - y)) x += Math.sign(b[0] - x); else y += Math.sign(b[1] - y);
    roadApply(x, y);
  }
}

/* ---------------- toque / mouse ---------------- */
const ptrs = new Map(); let gest = null; let needRecalc = false;
function onGhost(sx, sy) {
  if (!ghost) return false; const [tx, ty] = tileAt(sx, sy); const t = TYPES[ghost.t];
  return tx >= ghost.x - 1 && tx <= ghost.x + t.w && ty >= ghost.y - 2 && ty <= ghost.y + t.h;
}
function startPinch() {
  const [a, b] = [...ptrs.values()];
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; const [wx, wy] = s2w(mx, my);
  gest = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: cam.z, wx, wy, moved: true };
}
cv.addEventListener('pointerdown', e => {
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) {
    gest = { type: 'pending', sx: e.clientX, sy: e.clientY, moved: false };
    if (mode === 'place' && onGhost(e.clientX, e.clientY)) {
      const [tx, ty] = tileAt(e.clientX, e.clientY); gest.type = 'ghost'; gest.ox = tx - ghost.x; gest.oy = ty - ghost.y;
    } else if (mode === 'road') { gest.type = 'road'; gest.lt = tileAt(e.clientX, e.clientY); gest.started = false; }
  } else if (ptrs.size === 2) startPinch();
});
cv.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const px = p.x, py = p.y; p.x = e.clientX; p.y = e.clientY;
  if (!gest) return;
  if (gest.type === 'pinch') {
    if (ptrs.size < 2) return;
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    cam.z = clamp(gest.z0 * d / gest.d0, minZ(), maxZ);
    cam.x = gest.wx - (mx - vw / 2) / cam.z; cam.y = gest.wy - (my - vh / 2) / cam.z; clampCam(); return;
  }
  if (Math.hypot(e.clientX - gest.sx, e.clientY - gest.sy) > 8) gest.moved = true;
  if (gest.type === 'ghost') { const [tx, ty] = tileAt(e.clientX, e.clientY); if (tx - gest.ox !== ghost.x || ty - gest.oy !== ghost.y) setGhost(tx - gest.ox, ty - gest.oy); }
  else if (gest.type === 'road') {
    if (!gest.moved) return;
    if (!gest.started) { gest.started = true; roadApply(gest.lt[0], gest.lt[1]); }
    const tl = tileAt(e.clientX, e.clientY);
    if (tl[0] !== gest.lt[0] || tl[1] !== gest.lt[1]) { roadLine(gest.lt, tl); gest.lt = tl; }
  } else if (gest.moved) {
    gest.type = 'pan'; cv.classList.add('drag');
    cam.x -= (e.clientX - px) / cam.z; cam.y -= (e.clientY - py) / cam.z; clampCam();
  }
});
function endPtr(e, cancel) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId); cv.classList.remove('drag');
  if (!gest) return;
  if (gest.type === 'pinch') { gest = ptrs.size ? { type: 'pan', moved: true, sx: 0, sy: 0 } : null; return; }
  if (!cancel && !gest.moved) {
    if (gest.type === 'road') { const [tx, ty] = gest.lt; roadApply(tx, ty); }
    else if (gest.type === 'pending' || gest.type === 'ghost') tap(e.clientX, e.clientY, gest.type === 'ghost');
  }
  gest = null;
}
cv.addEventListener('pointerup', e => endPtr(e, false));
cv.addEventListener('pointercancel', e => endPtr(e, true));
cv.addEventListener('wheel', e => {
  e.preventDefault();
  const [wx, wy] = s2w(e.clientX, e.clientY);
  cam.z = clamp(cam.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), minZ(), maxZ);
  cam.x = wx - (e.clientX - vw / 2) / cam.z; cam.y = wy - (e.clientY - vh / 2) / cam.z; clampCam();
}, { passive: false });

function buildingAt(wx, wy) {
  // testa os sprites de frente para trás (o mais ao sul primeiro)
  const list = S.bld.slice().sort((a, b) => (b.y + TYPES[b.t].h) - (a.y + TYPES[a.t].h) || b.x - a.x);
  for (const b of list) { const sr = spriteRect(b); if (wx >= sr.X && wx <= sr.X + sr.W && wy >= sr.Y && wy <= sr.Yb) return b; }
  return null;
}
function tap(sx, sy, onG) {
  const [tx, ty] = tileAt(sx, sy); const [wx, wy] = s2w(sx, sy);
  if (mode === 'place') { if (!onG) { const t = TYPES[ghost.t]; setGhost(tx - Math.floor(t.w / 2), ty - Math.floor(t.h / 2)); } return; }
  if (buildOpen) { closeBuildMenu(); return; }
  // bolhas
  for (const h of hits) if (Math.hypot(wx - h.x, wy - h.y) <= h.r) {
    if (h.kind === 'collect') { collect(h.b); return; }
    if (h.kind === 'tax') { collectTax(); return; }
    if (h.kind === 'cargo') { dispatchCargo(); return; }
    openInfo(h.b); return;
  }
  const b = buildingAt(wx, wy);
  if (b) { openInfo(b); return; }
  if (!inb(tx, ty)) { closeSheet(); return; }
  if (!unlocked(tx, ty) && LAND[S.land + 1]) { openInfo(D.sede, 'land'); return; }
  closeSheet();
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('#modal').hidden) nextModal(); else if (mode === 'place') endPlace(); else if (mode === 'road') endRoads(); else if (buildOpen) closeBuildMenu(); else closeSheet(); }
});
