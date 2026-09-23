/* =========================================================
   09 · início: laço principal e boot
   ========================================================= */
let last = performance.now(), uiT = 0, lsT = 0;
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  if (S) {
    tick(dt * S.speed);
    if (needRecalc) { needRecalc = false; recalc(); }
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
  try { initScene(); } catch (e) {
    document.body.innerHTML = `<div style="position:fixed;inset:0;display:grid;place-items:center;padding:24px;text-align:center;font:500 16px/1.5 system-ui,sans-serif;color:#ECE7DA;background:#0A1020"><div><h1 style="font:400 28px/1.2 Georgia,serif;color:#E8CB86">Arcologia de Held</h1><p>Este navegador não conseguiu iniciar o 3D (WebGL). Tente outro navegador ou atualize o sistema.</p><p style="color:#8E98AC;font-size:13px">${String(e && e.message || e)}</p></div></div>`;
    throw e;
  }
  resize();
  const sd = D.sede; if (sd) lookAtTile(sd.x + 2.5, sd.y + 1.5, clamp(vw < 600 ? 19 : 24, cam.minDist, cam.maxDist));
  if (loaded) catchUp((Date.now() - S.savedAt) / 1000, true);
  requestAnimationFrame(t => { last = t; frame(t); });
  initCloud();
  if (!loaded) setTimeout(() => queueModal(welcomeModal), 500);
  window.addEventListener('resize', resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { uiDirty = true; });
  window.__held = { get S() { return S; }, D, TYPES, ITEMS, ROAD, HWY, OCC, MODEL, tick, recalc, initB, startPlace, confirmPlace, setGhost, roadApply, openInfo, openBuildMenu, openStore, openCity, openGoals, openMarket, openCargo, endPlace, startRoads, endRoads, byId, get ghost() { return ghost; }, cam, lookAtTile, addXP, serialize, loadState, queueItem, collect, startUpgrade, collectTax, catchUp, newGame, saveLocal, fillCargo, dispatchCargo, newCargo, buyOffer, listDepot, expandLand, upgradeStore, spawnRequest, fulfillReq, get stretches() { return stretches; }, set roadTool(v) { roadTool = v; }, footprintOk, get renderer() { return renderer; }, get scene() { return scene; }, protoFor };
}
boot();
