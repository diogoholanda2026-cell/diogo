/* =========================================================
   08 · salvar: neste aparelho (localStorage) e na conta (nuvem, se houver)
   ========================================================= */
const LS_KEY = 'arcologia-held:v2';
let lastLocal = 0, dirtyT = 0, hadLocal = false;
const cloud = { ref: null, last: 0, timer: 0, writing: false, again: false };
function serialize() {
  const roads = []; for (let i = 0; i < N * N; i++) if (ROAD[i] && !HWY[i]) roads.push(i * 4 + ROAD[i]);
  const bld = S.bld.map(b => {
    const o = { id: b.id, t: b.t, x: b.x, y: b.y, lvl: b.lvl, b: Math.round(b.b * 10) / 10, tt: b.tt || 0 };
    if (b.up) o.up = b.up; if (b.need) o.need = b.need; if (b.q && b.q.length) o.q = b.q.map(q => ({ k: q.k, t: Math.round(q.t * 10) / 10 }));
    if (b.done && b.done.length) o.done = b.done.slice(); if (b.req) o.req = { ...b.req, exp: Math.round(b.req.exp) };
    return o;
  });
  return { v: 2, savedAt: Date.now(), created: S.created, credits: Math.round(S.credits * 100) / 100, gems: S.gems, keys: S.keys, pecas: S.pecas, xp: Math.round(S.xp * 100) / 100, level: S.level, land: S.land, storeUp: S.storeUp, speed: S.speed,
    items: { ...S.items }, goal: S.goal, nextId: S.nextId, won: S.won, played: Math.round(S.played), taxAcc: Math.round(S.taxAcc * 10) / 10,
    cargo: S.cargo, market: S.market, depot: S.depot, reqT: Math.round(S.reqT), stats: { ...S.stats, earned: Math.round(S.stats.earned) }, roads, bld };
}
function loadState(o) {
  if (!o || o.v !== 2 || !Array.isArray(o.bld)) throw new Error('save inválido');
  S = { v: 2, created: o.created || Date.now(), savedAt: o.savedAt || Date.now(), credits: +o.credits || 0, gems: o.gems | 0, keys: o.keys | 0, pecas: o.pecas | 0, xp: +o.xp || 0,
    level: clamp(o.level | 0, 1, MAXL), land: clamp(o.land | 0, 0, LAND.length - 1), storeUp: o.storeUp | 0, speed: [1, 2, 3].includes(o.speed) ? o.speed : 1,
    items: {}, goal: o.goal | 0, nextId: o.nextId | 0 || 1, won: !!o.won, played: +o.played || 0, taxAcc: +o.taxAcc || 0,
    cargo: o.cargo && typeof o.cargo === 'object' ? { order: o.cargo.order || null, reward: o.cargo.reward || null, wait: +o.cargo.wait || 0 } : { order: null, wait: 0 },
    market: o.market && Array.isArray(o.market.offers) ? { offers: o.market.offers, wait: +o.market.wait || 0 } : { offers: [], wait: 0 },
    depot: Array.isArray(o.depot) ? o.depot.slice(0, 4).map(d => d && ITEMS[d.k] ? d : null) : [null, null, null, null],
    reqT: +o.reqT || 60, stats: { roads: 0, built: 0, upgrades: 0, earned: 0, made: {}, queued: 0, taxes: 0, cargo: 0, sold: 0, ...(o.stats || {}) }, bld: [] };
  while (S.depot.length < 4) S.depot.push(null);
  if (!S.stats.made || typeof S.stats.made !== 'object') S.stats.made = {};
  for (const k in (o.items || {})) if (ITEMS[k] && o.items[k] > 0) S.items[k] = o.items[k] | 0;
  ROAD.fill(0); layHighway();
  for (const v of o.roads || []) { const i = Math.floor(v / 4), lvl = v % 4; if (i >= 0 && i < N * N && !HWY[i] && lvl) ROAD[i] = lvl; }
  for (const a of o.bld) {
    if (!TYPES[a.t]) continue;
    const b = { id: a.id, t: a.t, x: a.x | 0, y: a.y | 0, lvl: clamp(a.lvl | 0, 1, RES_MAX), b: +a.b || 0, tt: +a.tt || 0, up: a.up | 0, need: Array.isArray(a.need) ? a.need.filter(p => ITEMS[p[0]]) : null, q: Array.isArray(a.q) ? a.q.filter(q => ITEMS[q.k]) : null, done: Array.isArray(a.done) ? a.done.filter(k => ITEMS[k]) : null, req: a.req && ITEMS[a.req.k] ? a.req : null };
    if (b.up && b.b <= 0) { b.lvl = b.up; b.up = 0; }
    if (!b.need && TYPES[b.t].res && !b.up) b.need = genNeed(b.lvl);
    initB(b); S.bld.push(b); S.nextId = Math.max(S.nextId, a.id + 1);
  }
  if (!S.bld.some(b => b.t === 'sede')) { const r = landRect(); const b = { id: S.nextId++, t: 'sede', x: r.x0 + 7, y: HIGHWAY_Y - 3, lvl: 1, b: 0, tt: 0 }; initB(b); S.bld.push(b); }
  if (!S.market.offers.length) refreshMarket();
  recalc();
}
function saveLocal() {
  try { const s = serialize(); localStorage.setItem(LS_KEY, JSON.stringify(s)); lastLocal = Date.now(); S.savedAt = s.savedAt; } catch (_) {}
}
function markDirty() {
  uiDirty = true;
  const n = Date.now(); if (n - dirtyT > 1500) { dirtyT = n; saveLocal(); }
  scheduleCloud(6000);
}
function scheduleCloud(ms) { if (!cloud.ref) return; clearTimeout(cloud.timer); cloud.timer = setTimeout(cloudSave, ms); }
async function cloudSave() {
  if (!cloud.ref) return;
  if (cloud.writing) { cloud.again = true; return; }
  cloud.writing = true; clearTimeout(cloud.timer);
  try { await cloud.ref.set({ save: serialize() }); cloud.last = Date.now(); }
  catch (e) { if (e && e.code === 'unavailable') setTimeout(cloudSave, 3000 + Math.random() * 3000); else if (e && (e.code === 'revoked' || e.code === 'not_granted' || e.code === 'invalid_argument')) cloud.ref = null; }
  cloud.writing = false;
  if (cloud.again) { cloud.again = false; scheduleCloud(1500); }
}
async function initCloud() {
  try {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    const [user, db] = await Promise.all([window.claude.use('user'), window.claude.use('db')]);
    if (!user || !db) return;
    const uid = await user.id(); if (!uid) return;
    const ref = db.doc('data/users/' + uid + '/save-v2');
    const snap = await ref.get();
    cloud.ref = ref;
    if (snap.exists) {
      const d = snap.data(); const sv = d && d.save;
      if (sv && sv.v === 2 && (!hadLocal || (sv.savedAt || 0) > (S.savedAt || 0) + 3000)) {
        try {
          loadState(sv); saveLocal();
          catchUp((Date.now() - (sv.savedAt || Date.now())) / 1000, true);
          toast(`${icon('check')} Cidade carregada da sua conta.`, 'good');
        } catch (_) { /* mantém a cidade atual */ }
      }
    }
    scheduleCloud(2000);
  } catch (_) { /* segue salvando só neste aparelho */ }
}
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); saveLocal(); cloudSave(); }
  else if (hiddenAt) { const s = (Date.now() - hiddenAt) / 1000; hiddenAt = 0; catchUp(s, s > 60); last = performance.now(); }
});
window.addEventListener('pagehide', () => { saveLocal(); });
