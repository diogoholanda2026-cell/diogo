/* =========================================================
   04 · simulação: economia, produção, melhorias, tempo
   ========================================================= */
let quiet = false;   // true durante o "catch-up" (sem animações/avisos)

/* ---------------- itens liberados e pedidos das moradias ---------------- */
function unlockedItems(level = S.level) {
  return Object.keys(ITEMS).filter(k => { const it = ITEMS[k]; return it.raw ? it.unlock <= level : TYPES[it.loja].unlock <= level; });
}
function genNeed(lvl) {
  if (lvl >= RES_MAX) return null;
  const budget = RES_BUDGET[lvl - 1], n = RES_ITEMS_N[lvl - 1];
  const pool = unlockedItems().filter(k => ITEMS[k].val <= budget * 0.8);
  const chosen = [];
  const bag = pool.slice();
  while (chosen.length < n && bag.length) { const i = (Math.random() * bag.length) | 0; chosen.push(bag.splice(i, 1)[0]); }
  if (!chosen.length) chosen.push('ligas');
  // reparte o orçamento entre os itens (mais peso para os baratos)
  const out = []; let left = budget;
  chosen.sort((a, b) => ITEMS[b].val - ITEMS[a].val);
  chosen.forEach((k, i) => {
    const share = i === chosen.length - 1 ? left : Math.round(budget / chosen.length * (0.7 + Math.random() * 0.6));
    let q = Math.max(1, Math.round(share / ITEMS[k].val)); q = Math.min(q, k === 'ligas' ? 8 : 6);
    left -= q * ITEMS[k].val; out.push([k, q]);
  });
  return out;
}
function needValue(need) { let v = 0; for (const [k, n] of need) v += ITEMS[k].val * n; return v; }

/* ---------------- experiência e nível ---------------- */
function addXP(n) {
  S.xp += n;
  while (S.level < MAXL && S.xp >= NEED[S.level + 1]) {
    S.level++;
    const reward = { c: 400 * S.level, gems: 3 + Math.floor(S.level / 4), pecas: S.level % 2 === 0 ? 1 : 0 };
    S.credits += reward.c; S.gems += reward.gems; S.pecas += reward.pecas;
    if (!quiet) queueModal(() => levelModal(S.level, reward));
  }
}

/* ---------------- pagamento e armazém ---------------- */
function canPay(c, keys, items) {
  if (S.credits < (c || 0) || S.keys < (keys || 0)) return false;
  if (items) for (const k in items) if ((S.items[k] || 0) < items[k]) return false;
  return true;
}
function pay(c, keys, items) { S.credits -= c || 0; S.keys -= keys || 0; if (items) takeItems(items); }
function hasItems(map) { for (const k in map) if ((S.items[k] || 0) < map[k]) return false; return true; }
function hasNeed(need) { return need.every(([k, n]) => (S.items[k] || 0) >= n); }
function takeItems(map) { for (const k in map) { S.items[k] = (S.items[k] || 0) - map[k]; if (S.items[k] <= 0) delete S.items[k]; } D.used = Object.values(S.items).reduce((a, b) => a + b, 0); }
function storeFree() { return Math.max(0, D.cap - D.used); }
function addItem(k, n) {
  const add = Math.min(n, storeFree()); if (add <= 0) return 0;
  S.items[k] = (S.items[k] || 0) + add; D.used += add; return add;
}
function gemsFor(items) { let g = 0; for (const k in items) g += Math.ceil(ITEMS[k].val * items[k] / 45); return Math.max(1, g); }
function gemsForNeed(need) { const m = {}; for (const [k, n] of need) { const miss = n - (S.items[k] || 0); if (miss > 0) m[k] = miss; } return Object.keys(m).length ? gemsFor(m) : 0; }
function gemsForTime(sec) { return Math.max(1, Math.ceil(sec / 40)); }
function missingOf(need) { const m = {}; for (const [k, n] of need) { const miss = n - (S.items[k] || 0); if (miss > 0) m[k] = miss; } return m; }
function buyMissingWithGems(need) {
  const m = missingOf(need); const g = gemsFor(m);
  if (!Object.keys(m).length) return true;
  if (S.gems < g) { toast(`${icon('gem', 'f')} Faltam cristais (${g}).`, 'bad'); return false; }
  let tot = 0; for (const k in m) tot += m[k];
  if (tot > storeFree()) { toast('Armazém sem espaço para receber os itens.', 'bad'); return false; }
  S.gems -= g; for (const k in m) addItem(k, m[k]);
  toast(`${icon('gem', 'f')} Itens comprados com ${g} cristais.`, 'good'); return true;
}

/* ---------------- produção (fábricas e lojas) ---------------- */
function producible(b) {
  const t = TYPES[b.t];
  if (t.cat === 'fab') return RAW.filter(k => ITEMS[k].unlock <= S.level);
  return Object.keys(ITEMS).filter(k => ITEMS[k].loja === b.t);
}
function queueItem(b, k) {
  const t = TYPES[b.t]; const it = ITEMS[k];
  if (b.b > 0 && !b.up) return toast('A obra ainda não terminou.', 'bad');
  if (b.q.length >= t.slots) return toast('Fila cheia.', 'bad');
  if (it.in) { if (!hasItems(it.in)) return toast('Faltam insumos no armazém.', 'bad'); takeItems(it.in); }
  b.q.push({ k, t: it.time }); S.stats.queued++;
  markDirty();
}
function prodRate(b) { const t = TYPES[b.t]; return D.prodMul * (t.boost || 1) * (0.5 + 0.5 * Math.min(D.effP, D.effW)); }
function advanceProd(b, sec) {
  if (!b._on || !b.q || !b.q.length) return;
  let left = sec * prodRate(b);
  while (left > 0 && b.q.length) {
    const cur = b.q[0];
    if (cur.t > left) { cur.t -= left; left = 0; }
    else { left -= cur.t; b.q.shift(); b.done.push(cur.k); S.stats.made[cur.k] = (S.stats.made[cur.k] || 0) + 1; if (!quiet) { const t = TYPES[b.t]; addFloat(b.x + t.w / 2, b.y, ITEMS[cur.k].short + ' pronto', ITEMS[cur.k].color, 1.4); } }
  }
}
function collect(b) {
  if (!b.done || !b.done.length) return 0;
  let n = 0; const t = TYPES[b.t];
  while (b.done.length && storeFree() > 0) { addItem(b.done[0], 1); b.done.shift(); n++; }
  if (n && !quiet) { addFloat(b.x + t.w / 2, b.y + 0.4, '+' + n + ' no armazém', '#46E3B5', 1.4); addXP(n); }
  if (b.done.length && !quiet) toast(`${icon('box')} Armazém cheio: ${b.done.length} item(ns) esperando.`, 'bad');
  recalc(); markDirty(); return n;
}
function collectAll() { let n = 0; for (const b of S.bld) if (b.done && b.done.length) n += collect(b); return n; }
function speedUp(b) {
  if (!b.q || !b.q.length) return;
  const cur = b.q[0]; const g = gemsForTime(cur.t / prodRate(b));
  if (S.gems < g) return toast(`${icon('gem', 'f')} Faltam cristais (${g}).`, 'bad');
  S.gems -= g; cur.t = 0; advanceProd(b, 0.001); markDirty();
}

/* ---------------- moradias: melhorias e pedidos ---------------- */
function startUpgrade(b, useGems) {
  const t = TYPES[b.t]; if (!t.res || !b.need || b.up || b.b > 0) return;
  if (!b._con) return toast('A moradia precisa estar ligada à rua.', 'bad');
  if (!hasNeed(b.need)) { if (!useGems || !buyMissingWithGems(b.need)) return; }
  const need = b.need; for (const [k, n] of need) takeItems({ [k]: n });
  const val = needValue(need); const cred = Math.round(val * 1.6) + 40; const xp = Math.round(val / 9) + 4;
  S.credits += cred; S.stats.earned += cred; addXP(xp); S.stats.upgrades++;
  b.up = b.lvl + 1; b.b = RES_STAGES[b.lvl].up; b.tt = b.b; b.need = null;
  if (Math.random() < 0.35) { S.pecas++; if (!quiet) addFloat(b.x + t.w / 2, b.y - 0.6, '+1 peça de expansão', '#E8CB86', 2); }
  if (!quiet) { addFloat(b.x + t.w / 2, b.y, `+§${fmt(cred)} · +${xp} XP`, '#E8CB86', 1.8); }
  recalc(); markDirty();
}
function finishUpgrade(b) {
  b.lvl = b.up; b.up = 0; b.b = 0; b.need = genNeed(b.lvl); b.fx = performance.now();
  const t = TYPES[b.t];
  if (!quiet) { addFloat(b.x + t.w / 2, b.y, RES_STAGES[b.lvl - 1].name + '!', '#46E3B5', 2); burst(b.x + t.w / 2, b.y + t.h / 2); }
}
function spawnRequest() {
  const homes = S.bld.filter(b => TYPES[b.t].res && b._on && !b.req);
  if (!homes.length) return;
  const b = pick(homes); const pool = unlockedItems();
  const cheap = pool.filter(k => ITEMS[k].val <= 40 + S.level * 40);
  const k = pick(cheap.length ? cheap : pool); const n = 1 + Math.min(3, Math.floor(Math.random() * (1 + S.level / 3)));
  const val = ITEMS[k].val * n;
  b.req = { k, n, cred: Math.round(val * 2.4) + 60, xp: Math.round(val / 10) + 3, exp: 720 };
}
function fulfillReq(b) {
  const r = b.req; if (!r) return;
  if ((S.items[r.k] || 0) < r.n) return toast('Você ainda não tem esses itens.', 'bad');
  takeItems({ [r.k]: r.n }); S.credits += r.cred; S.stats.earned += r.cred; addXP(r.xp); b.req = null;
  const t = TYPES[b.t]; addFloat(b.x + t.w / 2, b.y, `+§${fmt(r.cred)} · +${r.xp} XP`, '#E8CB86', 1.8);
  toast(`${icon('check')} Pedido entregue: +§${fmt(r.cred)}`, 'good'); recalc(); markDirty();
}

/* ---------------- impostos ---------------- */
function taxCap() { return D.taxH * TAX_CAP_H; }
function collectTax() {
  const n = Math.floor(S.taxAcc); if (n < 1) return;
  S.credits += n; S.stats.earned += n; S.taxAcc -= n; S.stats.taxes++;
  addXP(Math.max(1, Math.round(n / 150)));
  const sd = D.sede; if (sd) addFloat(sd.x + 2.5, sd.y, '+§' + fmt(n), '#E8CB86', 2);
  toast(`${icon('coin', 'f')} Impostos coletados: +§${fmt(n)}`, 'good'); markDirty();
}

/* ---------------- terminal de cargas ---------------- */
function cargoActive() { return S.bld.some(b => b.t === 'tra1' && b._on); }
function newCargo() {
  const pool = unlockedItems(); const lines = 2 + Math.min(2, Math.floor(S.level / 5));
  const order = []; const bag = pool.slice(); let val = 0;
  for (let i = 0; i < lines && bag.length; i++) {
    const k = bag.splice((Math.random() * bag.length) | 0, 1)[0];
    const n = Math.max(1, Math.round((60 + S.level * 35) / ITEMS[k].val * (0.6 + Math.random() * 0.8)));
    const q = Math.min(n, 8); order.push({ k, n: q, ok: false }); val += ITEMS[k].val * q;
  }
  S.cargo.order = order;
  S.cargo.reward = { keys: 2 + Math.min(3, Math.floor(val / 500)), pecas: 1 + (val > 800 ? 1 : 0), c: Math.round(val * 1.5) + 100, xp: Math.round(val / 6) + 20 };
}
function fillCargo(i) {
  const o = S.cargo.order; if (!o || !o[i] || o[i].ok) return;
  const l = o[i]; if ((S.items[l.k] || 0) < l.n) return toast('Faltam itens no armazém.', 'bad');
  takeItems({ [l.k]: l.n }); l.ok = true; addXP(3); markDirty();
}
function dispatchCargo() {
  const o = S.cargo.order; if (!o || !o.every(l => l.ok)) return;
  const r = S.cargo.reward; S.keys += r.keys; S.pecas += r.pecas; S.credits += r.c; S.stats.earned += r.c; addXP(r.xp); S.stats.cargo++;
  S.cargo.order = null; S.cargo.wait = 150;
  toast(`${icon('key', 'f')} Encomenda despachada: +${r.keys} chaves, +${r.pecas} peças, +§${fmt(r.c)}`, 'good');
  const tb = S.bld.find(b => b.t === 'tra1'); if (tb) addFloat(tb.x + 1.5, tb.y, `+${r.keys} chaves`, '#E8CB86', 2.2);
  markDirty();
}

/* ---------------- mercado global e depósito comercial ---------------- */
function marketActive() { return S.bld.some(b => b.t === 'mer1' && b._on); }
function refreshMarket() {
  const pool = unlockedItems(); const offers = [];
  for (let i = 0; i < 8; i++) {
    const k = pick(pool); const n = 1 + ((Math.random() * Math.min(5, 1 + S.level / 2)) | 0);
    offers.push({ k, n, price: Math.round(ITEMS[k].val * n * (1.05 + Math.random() * 0.4)), sold: false });
  }
  S.market.offers = offers; S.market.wait = 300;
}
function buyOffer(i) {
  const o = S.market.offers[i]; if (!o || o.sold) return;
  if (S.credits < o.price) return toast('Créditos insuficientes.', 'bad');
  if (o.n > storeFree()) return toast('Armazém sem espaço.', 'bad');
  S.credits -= o.price; addItem(o.k, o.n); o.sold = true; addXP(2); markDirty();
}
function listDepot(slot, k, n) {
  if (S.depot[slot]) return;
  n = Math.min(n, S.items[k] || 0); if (n <= 0) return;
  takeItems({ [k]: n });
  S.depot[slot] = { k, n, price: Math.round(ITEMS[k].val * n * 1.15), t: 25 + Math.random() * 90 + ITEMS[k].val / 12 };
  markDirty();
}
function sellNow(slot) {
  const d = S.depot[slot]; if (!d) return;
  S.credits += d.price; S.stats.earned += d.price; S.stats.sold += d.n; addXP(Math.max(1, Math.round(d.price / 200)));
  if (!quiet) toast(`${icon('coin', 'f')} Vendido no depósito: ${d.n}× ${ITEMS[d.k].short} por §${fmt(d.price)}`, 'good');
  S.depot[slot] = null; markDirty();
}

/* ---------------- terreno e armazém ---------------- */
function expandLand() {
  const next = S.land + 1, req = LAND_REQ[next]; if (!req) return;
  if (S.level < req.lvl || S.credits < req.c || S.pecas < req.p) return;
  S.credits -= req.c; S.pecas -= req.p; S.land = next; layHighway(); recalc(); markDirty();
  toast(`${icon('city')} Terreno expandido para ${LAND[next]}×${LAND[next]}!`, 'good'); addXP(50);
}
function upgradeStore() {
  const req = storeReq(S.storeUp);
  if (S.credits < req.c || S.pecas < req.p) return;
  S.credits -= req.c; S.pecas -= req.p; S.storeUp++; recalc(); markDirty();
  toast(`${icon('box')} Armazém ampliado para ${D.cap} itens.`, 'good'); addXP(20);
}

/* ---------------- metas ---------------- */
function checkGoal() {
  const g = GOALS[S.goal]; if (!g) return;
  if (g.v() >= g.n) {
    S.credits += g.r; addXP(g.xp); if (g.keys) S.keys += g.keys; if (g.gems) S.gems += g.gems;
    if (!quiet) toast(`${icon('check')} Meta cumprida: +§${fmt(g.r)}, +${g.xp} XP${g.keys ? `, +${g.keys} chaves` : ''}${g.gems ? `, +${g.gems} cristais` : ''}`, 'good');
    S.goal++; markDirty(); uiDirty = true;
    if (sheetKind === 'goals') openGoals();
  }
}

/* ---------------- ciclo do jogo ---------------- */
let floatTimer = 0, goalTimer = 0;
function tick(dt) {
  S.played += dt;
  let changed = false;
  for (const b of S.bld) if (b.b > 0) {
    b.b -= dt;
    if (b.b <= 0) { b.b = 0; changed = true; if (b.up) finishUpgrade(b); else onBuilt(b); }
  }
  if (changed) recalc();
  // impostos acumulam na Sede
  const cap = taxCap();
  if (S.taxAcc < cap) S.taxAcc = Math.min(cap, S.taxAcc + D.taxH / 3600 * dt);
  // produção
  for (const b of S.bld) if (b.q) advanceProd(b, dt);
  // pedidos dos moradores
  S.reqT -= dt;
  if (S.reqT <= 0) { S.reqT = 70 + Math.random() * 60; if (Math.random() < 0.6) spawnRequest(); }
  for (const b of S.bld) if (b.req) { b.req.exp -= dt; if (b.req.exp <= 0) b.req = null; }
  // terminal de cargas
  if (cargoActive()) { if (!S.cargo.order) { S.cargo.wait -= dt; if (S.cargo.wait <= 0) newCargo(); } }
  // mercado
  S.market.wait -= dt; if (S.market.wait <= 0) refreshMarket();
  // depósito
  for (let i = 0; i < S.depot.length; i++) { const d = S.depot[i]; if (d) { d.t -= dt; if (d.t <= 0) sellNow(i); } }
  floatTimer += dt;
  if (floatTimer > 3) { floatTimer = 0; emitAmbientFloats(); }
  goalTimer += dt;
  if (goalTimer > 0.5) { goalTimer = 0; checkGoal(); }
}
function onBuilt(b) {
  const t = TYPES[b.t];
  addXP(t.xp || 10);
  if (!quiet) { addFloat(b.x + t.w / 2, b.y, 'Pronto! +' + (t.xp || 10) + ' XP', '#46E3B5', 1.8); burst(b.x + t.w / 2, b.y + t.h / 2); }
  b.fx = performance.now();
  if (t.cat === 'mega' && !quiet) toast(`${icon('star', 'f')} ${t.name} concluída!`, 'good');
  if (b.t === 'held' && !S.won) { S.won = true; queueModal(winModal); }
  S.stats.built++;
  markDirty();
}
function catchUp(sec, show) {
  if (!(sec > 3)) return;
  sec = Math.min(sec, 10 * 3600);
  quiet = true;
  recalc();
  const before = { c: S.credits, k: S.keys, xp: S.xp, lvl: S.level };
  let built = 0; const made = {};
  const doneBefore = {}; for (const b of S.bld) if (b.done) doneBefore[b.id] = b.done.length;
  // simula em passos grandes (obras podem liberar produção, etc.)
  let left = sec;
  while (left > 0) { const step = Math.min(left, 600); tick(step); left -= step; }
  for (const b of S.bld) if (b.done) { const n = b.done.length - (doneBefore[b.id] || 0); if (n > 0) for (const k of b.done.slice(-n)) made[k] = (made[k] || 0) + 1; }
  built = S.stats.built; // não usado além do aviso
  quiet = false;
  if (S.level > before.lvl) { const L = S.level; queueModal(() => levelModal(L, { c: 0, gems: 0, pecas: 0 }).replace(/<p>Recompensa:.*?<\/p>/, '<p>Recompensas já creditadas enquanto você esteve fora.</p>')); }
  const earned = S.credits - before.c;
  const prod = Object.keys(made).map(k => `${made[k]}× ${ITEMS[k].short}`).join(', ');
  if (show && (earned > 0 || prod || S.taxAcc > 10)) {
    queueModal(() => `<small>Bem-vindo de volta</small><h2 class="m">A cidade trabalhou por ${dur(sec)}</h2>
      <p>${earned > 0 ? `Vendas e entregas: <b style="color:var(--brass-hi)">+§${fmt(earned)}</b><br>` : ''}${prod ? `Produção pronta para coletar: ${prod}<br>` : ''}${S.taxAcc > 10 ? `Impostos esperando na Sede: <b style="color:var(--brass-hi)">§${fmt(S.taxAcc)}</b>` : ''}</p>
      <button class="btn brass" data-close>Continuar</button>`);
  }
  recalc(); markDirty();
}
