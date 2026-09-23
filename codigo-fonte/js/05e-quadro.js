/* =========================================================
   05e · quadro: sincroniza o estado com a cena 3D, anima, desenha o overlay 2D
   ========================================================= */
const sceneB = new Map();     // id -> { b, key, group, upKey, upGroup, site }
let ghostGroup = null, ghostKey = '', ghostOk = null, selMesh = null, coverGroup = null;
let floats = [], parts = [], hits = [];
let lastRender = performance.now(), floatTimer2 = 0;

function addFloat(tx, ty, text, color, life = 1.5) {
  if (quiet) return; if (floats.length > 40) floats.shift();
  let y = 0.7; const id = inb(Math.floor(tx), Math.floor(ty)) ? OCC[Math.floor(ty) * N + Math.floor(tx)] : 0;
  if (id) { const r = sceneB.get(id); if (r) y = (r.group.userData.h || 0.6) + 0.35; }
  floats.push({ x: tx, y, z: ty, text, color, t: 0, life });
}
function burst(tx, ty, n = 18) {
  if (quiet) return;
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = 0.6 + Math.random() * 1.2; parts.push({ x: tx, y: 0.5, z: ty, vx: Math.cos(a) * sp, vy: 1.2 + Math.random() * 1.5, vz: Math.sin(a) * sp, t: 0, life: 0.8 + Math.random() * 0.6, c: Math.random() < 0.5 ? '#E8CB86' : '#46E3B5', r: 2.5 + Math.random() * 3, g: 3 }); }
}
function emitAmbientFloats() {
  const vis = S.bld.filter(b => TYPES[b.t].res && b._on && (b._joy || 0) > 0.6);
  if (!vis.length) return; const b = pick(vis); const [sx, sy, sz] = project(b.x + 1.5, 0.5, b.y + 1);
  if (sz < 1 && sx > 0 && sx < vw && sy > 0 && sy < vh) addFloat(b.x + 1.5 + rnd(-0.5, 0.5), b.y + 1, pick(['♥', '✦', '☺']), '#46E3B5', 1.6);
}

/* ---------------- sincronização ---------------- */
function syncBuildings(now) {
  const seen = new Set();
  for (const b of S.bld) {
    seen.add(b.id); const key = modelKey(b); let r = sceneB.get(b.id);
    if (!r) { r = { b, key: '', group: null, upKey: '', upGroup: null, site: null }; sceneB.set(b.id, r); }
    if (r.key !== key || !r.group) {
      if (r.site) { siteRemove(r.site); r.site = null; }
      if (r.group) bldRoot.remove(r.group);
      r.group = instanceFor(key, TYPES[b.t]); r.key = key; placeGroup(r.group, b); bldRoot.add(r.group);
    }
    const t = TYPES[b.t]; if (r.group.position.x !== b.x + t.w / 2 || r.group.position.z !== b.y + t.h / 2) { placeGroup(r.group, b); if (r.upGroup) placeGroup(r.upGroup, b); if (r.site) { siteRemove(r.site); r.site = null; } }
    // melhoria: modelo do próximo estágio
    const upKey = b.up ? modelKey(b, b.up) : '';
    if (r.upKey !== upKey) {
      if (r.site) { siteRemove(r.site); r.site = null; }
      if (r.upGroup) { bldRoot.remove(r.upGroup); r.upGroup = null; }
      if (upKey) { r.upGroup = instanceFor(upKey, TYPES[b.t]); placeGroup(r.upGroup, b); bldRoot.add(r.upGroup); }
      r.upKey = upKey;
    }
    // canteiro
    if (b.b > 0) { if (!r.site) r.site = siteCreate(r, b, !!b.up); }
    else if (r.site) { siteRemove(r.site); r.site = null; }
    r.group.visible = !(b.moving);
  }
  for (const [id, r] of sceneB) if (!seen.has(id)) { if (r.site) siteRemove(r.site); if (r.group) bldRoot.remove(r.group); if (r.upGroup) bldRoot.remove(r.upGroup); sceneB.delete(id); }
}
function syncGhost() {
  if (mode === 'place' && ghost) {
    const key = modelKey({ t: ghost.t, lvl: 1 }); const ok = !ghost.err;
    if (!ghostGroup || ghostKey !== key || ghostOk !== ok) {
      if (ghostGroup) fxRoot.remove(ghostGroup);
      ghostGroup = instanceFor(key, TYPES[ghost.t]); ghostGroup.traverse(o => { if (o.isMesh) { o.material = ok ? MAT.ghostOk : MAT.ghostBad; o.castShadow = false; } if (o.isLine) o.visible = false; });
      const t = TYPES[ghost.t]; const fp = plane(t.w, t.h, ok ? MAT.ghostOk : MAT.ghostBad, 0, 0.05, 0); fp.receiveShadow = false; ghostGroup.add(fp);
      ghostKey = key; ghostOk = ok; fxRoot.add(ghostGroup);
    }
    const t = TYPES[ghost.t]; ghostGroup.position.set(ghost.x + t.w / 2, 0, ghost.y + t.h / 2);
    if (ghost.moving) { const r = sceneB.get(ghost.moving.id); if (r) r.group.visible = false; }
  } else if (ghostGroup) { fxRoot.remove(ghostGroup); ghostGroup = null; ghostKey = ''; }
}
function syncSelection(now) {
  if (!selMesh) { selMesh = extrudeY(roundedRectShape(1, 1, 0.12), 0.01, MAT.sel, 0.045); selMesh.castShadow = false; selMesh.receiveShadow = false; fxRoot.add(selMesh); }
  if (sel && !(ghost && ghost.moving === sel) && S.bld.includes(sel)) { const t = TYPES[sel.t]; selMesh.visible = true; selMesh.position.set(sel.x + t.w / 2, 0, sel.y + t.h / 2); selMesh.scale.set(t.w + 0.2, 1, t.h + 0.2); MAT.sel.opacity = 0.35 + 0.3 * Math.sin(now / 260); }
  else selMesh.visible = false;
  // raios de cobertura
  if (!coverGroup) { coverGroup = new T3.Group(); fxRoot.add(coverGroup); }
  const want = [];
  if (mode === 'place' && ghost) { const gt = TYPES[ghost.t]; if (gt.radius) want.push([ghost.x + gt.w / 2, ghost.y + gt.h / 2, gt.radius, gt, 0.9]); if (gt.res) for (const f of D.covs) { const ft = TYPES[f.t]; if (ft.cov === 'par') want.push([f.x + ft.w / 2, f.y + ft.h / 2, ft.radius, ft, 0.35]); } }
  else if (sel && TYPES[sel.t].radius) { const st = TYPES[sel.t]; want.push([sel.x + st.w / 2, sel.y + st.h / 2, st.radius, st, 0.9]); }
  const sig = want.map(w => w.slice(0, 3).join(',') + w[4]).join('|');
  if (coverGroup.userData.sig !== sig) {
    coverGroup.userData.sig = sig; while (coverGroup.children.length) coverGroup.remove(coverGroup.children[0]);
    for (const [x, z, r, tp, a] of want) {
      const col = tp.cov === 'par' || tp.transit ? 0x46E3B5 : tp.cov === 'seg' ? 0x8C7CFF : tp.cov === 'sau' ? 0xFF788C : 0xF0B44C;
      const fill = new T3.Mesh(new T3.CircleGeometry(r, 48).rotateX(-PI / 2), new T3.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.1 * a, depthWrite: false })); fill.position.set(x, 0.055, z); coverGroup.add(fill);
      const ring = new T3.Mesh(new T3.RingGeometry(r - 0.06, r, 64).rotateX(-PI / 2), new T3.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7 * a, depthWrite: false })); ring.position.set(x, 0.06, z); coverGroup.add(ring);
    }
  }
}

/* ---------------- overlay 2D ---------------- */
const P_BOLT = new Path2D('M13.2 2 4.6 13.4h6.2L9.9 22l8.6-11.5h-6.2L13.2 2z');
const P_DROP = new Path2D('M12 2.4C9 6.9 5.4 10.2 5.4 14.6a6.6 6.6 0 0 0 13 0c0-4.4-3.4-7.7-6.4-12.2z');
const P_ROAD = new Path2D('M8 3 4.5 21h3L10 3zM16 3l3.5 18h-3L14 3zM11 4h2v3h-2zM11 10h2v4h-2zM11 17h2v3h-2z');
const P_BOX = new Path2D('M3.5 7.5 12 3.2l8.5 4.3v9L12 20.8l-8.5-4.3z');
const P_UP = new Path2D('M12 4 4 13h5v7h6v-7h5z');
const P_CAR = new Path2D('M5 11l1.5-4.5h11L19 11h1.5v6h-2a2 2 0 0 1-4 0h-5a2 2 0 0 1-4 0h-2v-6z');
const P_RECY = new Path2D('M12 3.5 15.5 9.5h-7zM4.2 17.2 7.7 11.2l3.5 6zm12.1 0-3.5-6 7-.1z');
const P_COIN = new Path2D('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 3.5v1.2c1.4.1 2.4.8 2.7 1.9l-1.9.5c-.2-.5-.6-.8-1.3-.8-.8 0-1.3.4-1.3 1 0 2 4.7.8 4.7 4 0 1.4-1 2.3-2.9 2.5v1.2h-1.4v-1.2c-1.6-.2-2.6-1-2.9-2.2l1.9-.5c.2.7.8 1.1 1.6 1.1.9 0 1.4-.4 1.4-1 0-2-4.7-.8-4.7-4 0-1.3.9-2.2 2.7-2.4V6.5z');
const P_CHAT = new Path2D('M4 4h16v11H9l-5 4z');
function badge(cx, cy, r, col, path, stroke) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = col; ctx.fill();
  ctx.lineWidth = r * 0.16; ctx.strokeStyle = 'rgba(5,9,19,.9)'; ctx.stroke();
  ctx.save(); ctx.translate(cx, cy); ctx.scale(r / 15, r / 15); ctx.translate(-12, -12);
  if (stroke) { ctx.lineWidth = 2.2; ctx.strokeStyle = '#10141D'; ctx.stroke(path); } else { ctx.fillStyle = '#10141D'; ctx.fill(path); }
  ctx.restore();
}
function phaseLabel(b, info) {
  const f = 1 - b.b / b.tt;
  if (info && info.phaseA) return 'Terraplanagem'; if (info && info.phaseB) return 'Fundação';
  if (f < 0.9 && info) return `Andar ${Math.min(info.K, info.built + 1)} de ${info.K}`;
  return 'Acabamento';
}
function drawProgress(b, sx, sy, k, info) {
  const f = 1 - b.b / b.tt; const bw = 110 * k;
  ctx.fillStyle = 'rgba(5,9,19,.85)'; rr(ctx, sx - bw / 2 - 3, sy - 3, bw + 6, 12 * k + 2, 6); ctx.fill();
  ctx.fillStyle = b.up ? '#8C7CFF' : '#46E3B5'; rr(ctx, sx - bw / 2, sy, Math.max(4, bw * f), 6 * k + 2, 4); ctx.fill();
  ctx.fillStyle = '#ECE7DA'; ctx.font = `700 ${11 * k}px "Barlow Semi Condensed", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(`${phaseLabel(b, info)} · ${dur(b.b)}`, sx, sy - 3);
}
function drawBadges(b, r, now, k) {
  const t = TYPES[b.t]; const h = (b.up && r.upGroup ? Math.max(r.group.userData.h, r.upGroup.userData.h) : r.group.userData.h) || 0.6;
  const [sx, sy, sz] = project(b.x + t.w / 2, h + 0.15, b.y + t.h / 2); if (sz > 1 || sx < -40 || sx > vw + 40 || sy < -40 || sy > vh + 40) return;
  const rad = 11 * k; const bob = Math.sin(now / 320 + b.id) * 2;
  if (b.b > 0) { drawProgress(b, sx, sy + 14 * k, k, r.site && r.site.info); if (!b.up) return; }
  let kind = null;
  if (!b._con) kind = 'road';
  else if ((t.res || t.useP) && D.effP < 0.999) kind = 'bolt';
  else if ((t.res || t.useW) && D.effW < 0.999) kind = 'drop';
  else if ((t.res || t.useR) && D.effR < 0.999) kind = 'recy';
  else if (b._jam) kind = 'jam';
  let bx = sx;
  const items = [];
  if (kind) items.push({ col: { road: '#F08A3C', bolt: '#FFD34D', drop: '#5BC0EB', recy: '#86DB91', jam: '#FF6A5C' }[kind], path: { road: P_ROAD, bolt: P_BOLT, drop: P_DROP, recy: P_RECY, jam: P_CAR }[kind] });
  const bubbles = [];
  if (b.done && b.done.length) bubbles.push(['collect', '#E8CB86', P_BOX, '×' + b.done.length]);
  if (b.t === 'sede' && S.taxAcc >= Math.max(20, taxCap() * 0.05)) bubbles.push(['tax', '#E8CB86', P_COIN, '§' + fmt(S.taxAcc)]);
  if (t.res && b.need && !b.up && hasNeed(b.need)) bubbles.push(['upgrade', '#46E3B5', P_UP, null]);
  if (b.req) bubbles.push(['req', '#8C7CFF', P_CHAT, ITEMS[b.req.k].short]);
  if (b.t === 'tra1' && S.cargo.order && S.cargo.order.every(l => l.ok)) bubbles.push(['cargo', '#46E3B5', P_BOX, 'Despachar']);
  const total = items.length + bubbles.length; if (!total) return;
  bx = sx - (total - 1) * rad * 1.3;
  for (const it of items) { badge(bx, sy - rad * 0.6 + bob, rad, it.col, it.path); bx += rad * 2.6; }
  for (const [kindB, col, path, text] of bubbles) {
    const y = sy - rad * 0.6 + bob; badge(bx, y, rad * 1.15, col, path);
    if (text != null) { ctx.fillStyle = 'rgba(5,9,19,.9)'; ctx.font = `700 ${9.5 * k}px "Barlow Semi Condensed", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const tw = ctx.measureText(text).width + 8 * k; rr(ctx, bx - tw / 2, y + rad * 0.85, tw, 12 * k, 4 * k); ctx.fill(); ctx.fillStyle = '#ECE7DA'; ctx.fillText(text, bx, y + rad * 0.85 + 6 * k); }
    hits.push({ sx: bx, sy: y, r: rad * 1.6, b, kind: kindB }); bx += rad * 2.6;
  }
  if (t.res) { ctx.fillStyle = 'rgba(5,9,19,.8)'; const s = 13 * k; const [lx, ly] = project(b.x + 0.25, 0.05, b.y + t.h - 0.1); rr(ctx, lx - s * 0.6, ly - s / 2, s * 1.2, s, 3 * k); ctx.fill(); ctx.fillStyle = '#E8CB86'; ctx.font = `700 ${10 * k}px "Barlow Semi Condensed", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(b.lvl), lx, ly); }
}
function drawOverlay(now, fdt) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, vw, vh);
  hits = [];
  const k = clamp(pxPerUnit() / 42, 0.75, 1.5);
  for (const [id, r] of sceneB) drawBadges(r.b, r, now, k);
  if (mode === 'place' && ghost) {
    const t = TYPES[ghost.t]; const [sx, sy, sz] = project(ghost.x + t.w / 2, 0, ghost.y + t.h + 0.2);
    if (sz < 1) { ctx.fillStyle = 'rgba(5,9,19,.85)'; rr(ctx, sx - 52, sy, 104, 22, 11); ctx.fill(); ctx.fillStyle = '#ECE7DA'; ctx.font = '600 12px "Barlow Semi Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✥ arraste para mover', sx, sy + 11); }
  }
  // partículas (coordenadas de mundo)
  for (const p of parts) { p.t += fdt; p.x += p.vx * fdt; p.y += p.vy * fdt; p.z += p.vz * fdt; p.vy -= (p.g || 3) * fdt; }
  parts = parts.filter(p => p.t < p.life);
  for (const p of parts) { const [sx, sy, sz] = project(p.x, p.y, p.z); if (sz > 1) continue; ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(sx, sy, p.r * k, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  // textos flutuantes
  for (const f of floats) f.t += fdt; floats = floats.filter(f => f.t < f.life);
  ctx.font = `700 ${13 * k}px "Barlow Semi Condensed", "Arial Narrow", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,9,19,.85)';
  for (const f of floats) {
    const p = f.t / f.life, a = p < 0.15 ? p / 0.15 : 1 - Math.max(0, (p - 0.55) / 0.45);
    const [sx, sy, sz] = project(f.x, f.y + p * 0.6, f.z); if (sz > 1) continue;
    ctx.globalAlpha = clamp(a, 0, 1); ctx.strokeText(f.text, sx, sy); ctx.fillStyle = f.color; ctx.fillText(f.text, sx, sy);
  }
  ctx.globalAlpha = 1;
}

/* ---------------- quadro ---------------- */
function render(now) {
  const fdt = Math.min(0.1, (now - lastRender) / 1000); lastRender = now;
  if (worldDirty) rebuildWorld();
  syncBuildings(now); syncGhost(); syncSelection(now);
  const out = { dust: [], sparks: [] };
  for (const [id, r] of sceneB) {
    if (r.site) r.site.info = siteUpdate(r.site, r.b, now, out);
    for (const s of r.group.userData.spins) s.rotation.x += fdt * 2.2;
  }
  if (!quiet) {
    for (const [x, y, z, w] of out.dust) for (let i = 0; i < 10; i++) parts.push({ x: x + (Math.random() - 0.5) * w, y, z: z + (Math.random() - 0.5) * 0.6, vx: (Math.random() - 0.5) * 0.6, vy: 0.3 + Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.6, t: 0, life: 0.7, c: 'rgba(200,190,170,.55)', r: 2 + Math.random() * 2.5, g: 0.2 });
    for (const [x, y, z] of out.sparks) for (let i = 0; i < 3; i++) parts.push({ x, y, z, vx: (Math.random() - 0.5) * 1.2, vy: Math.random() * 0.8, vz: (Math.random() - 0.5) * 1.2, t: 0, life: 0.25 + Math.random() * 0.2, c: Math.random() < 0.5 ? '#FFF6C8' : '#FFD34D', r: 1.2 + Math.random(), g: 4 });
  }
  if (!quiet) updateCars(fdt);
  for (const a of anims) a.update(now);
  floatTimer2 += fdt; if (floatTimer2 > 3) { floatTimer2 = 0; emitAmbientFloats(); }
  applyCamera();
  sun.position.set(cam.x + 30, 60, cam.y + 20); sun.target.position.set(cam.x, 0, cam.y); sun.target.updateMatrixWorld();
  renderer.render(scene, camera);
  drawOverlay(now, fdt);
}
