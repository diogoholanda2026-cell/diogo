/* =========================================================
   09 · início: laço principal e boot
   ========================================================= */
let last = performance.now(), uiT = 0, lsT = 0;
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  if (S) {
    tick(dt * S.speed);
    if (needRecalc) { needRecalc = false; recalc(); }
    for (const f of floats) f.t += dt; floats = floats.filter(f => f.t < f.life);
    render(now);
    uiT += dt; if (uiT > 0.25 || uiDirty) { uiT = 0; uiDirty = false; updateHUD(); if (sheetRefresh) sheetRefresh(); if (mode === 'place') updatePlaceBar(); if (buildOpen && buildRefresh) buildRefresh(); }
    lsT += dt; if (lsT > 10) { lsT = 0; saveLocal(); }
  }
  requestAnimationFrame(frame);
}

function boot() {
  genTerrain();
  let loaded = false;
  try { const raw = localStorage.getItem(LS_KEY); if (raw) { loadState(JSON.parse(raw)); loaded = true; lastLocal = S.savedAt; } } catch (_) { loaded = false; }
  hadLocal = loaded;
  if (!loaded) newGame();
  paintTerrain();
  resize();
  cam.z = clamp(Math.min(vw / (TW * 9), vh / (TH * 14)), minZ(), maxZ);
  const sd = D.sede; if (sd) { cam.x = (sd.x + 2.5) * TW; cam.y = (sd.y + 3) * TH; }
  clampCam();
  if (loaded) catchUp((Date.now() - S.savedAt) / 1000, true);
  loadImages().then(() => { paintTerrain(); uiDirty = true; });
  requestAnimationFrame(t => { last = t; frame(t); });
  initCloud();
  if (!loaded) setTimeout(() => queueModal(welcomeModal), 500);
  window.addEventListener('resize', resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { uiDirty = true; });
  window.__held = { get S() { return S; }, D, TYPES, ITEMS, ROAD, HWY, OCC, tick, recalc, initB, startPlace, confirmPlace, setGhost, roadApply, openInfo, openBuildMenu, openStore, openCity, openGoals, openMarket, openCargo, endPlace, startRoads, endRoads, byId, get ghost() { return ghost; }, cam, addXP, serialize, loadState, queueItem, collect, startUpgrade, collectTax, catchUp, newGame, saveLocal, fillCargo, dispatchCargo, newCargo, buyOffer, listDepot, expandLand, upgradeStore, spawnRequest, fulfillReq, get stretches() { return stretches; }, set roadTool(v) { roadTool = v; }, footprintOk };
}
boot();
