/* =========================================================
   05c · modelos 3D das construções (procedurais, inspirados nas maquetes)
   Cada gerador devolve um Group com origem no centro da base (chão em y=0).
   ========================================================= */
const FH = 0.34;           // altura de um andar
const PI = Math.PI;

/* ---------------- peças reutilizáveis ---------------- */
// prédio em arco/anel com terraços verdes e faixas de vidro iluminado
function arcBuilding(o) {
  const { r0 = 0, r1 = 1, a0 = 0, a1 = TAU, floors = 3, step = 0.12, cx = 0, cz = 0 } = o;
  const win = o.win || MAT.win; const full = Math.abs(a1 - a0) >= TAU - 0.001; const g = new T3.Group();
  let prev = r1;
  for (let i = 0; i < floors; i++) {
    const ro = r1 - i * step; const y = i * FH;
    g.add(extrudeY(ringShape(r0, prev, a0, a1), 0.06, MAT.white, y));
    if (i > 0 && prev - ro > 0.02) g.add(extrudeY(ringShape(ro, prev, a0, a1), 0.035, MAT.roof, y + 0.06));
    g.add(arcWall(ro - 0.015, a0, a1, FH - 0.06, win, y + 0.06));
    if (r0 > 0.05) g.add(arcWall(r0 + 0.015, a0, a1, FH - 0.06, o.inner || MAT.whitePlain, y + 0.06, { inward: true }));
    if (!full) {
      const A = [a0, a1]; for (const a of A) { const c = Math.cos(a), s = Math.sin(a); const x0 = c * r0, z0 = s * r0, x1 = c * ro, z1 = s * ro; g.add(a === a0 ? flatWall(x1, z1, x0, z0, FH - 0.06, MAT.white, y + 0.06) : flatWall(x0, z0, x1, z1, FH - 0.06, MAT.white, y + 0.06)); }
    }
    prev = ro;
  }
  const top = floors * FH; const rt = r1 - (floors - 1) * step;
  g.add(extrudeY(ringShape(r0, rt, a0, a1), 0.05, MAT.white, top));
  g.add(extrudeY(ringShape(r0 + 0.04, rt - 0.05, a0, a1), 0.04, o.roofMat || MAT.roof, top + 0.05));
  g.add(arcWall(rt - 0.01, a0, a1, 0.09, MAT.glass, top + 0.05));
  if (o.lit !== false) g.add(arcWall(rt - 0.03, a0, a1, 0.012, MAT.lit, top + 0.02));
  g.position.set(cx, 0, cz); return g;
}
// torre curva de vidro (planta em losango arredondado, andares deslocados)
function curvedTower(o) {
  const { w = 1.1, d = 0.7, floors = 5, lean = 0.06, twist = 0.05, cx = 0, cz = 0, pool = true } = o; const g = new T3.Group();
  const shape = roundedRectShape(w, d, Math.min(w, d) * 0.48);
  for (let i = 0; i < floors; i++) {
    const y = i * FH; const off = Math.sin(i * 0.9) * lean; const rot = i * twist;
    const slab = extrudeY(shape, 0.06, MAT.white, y); slab.scale.set(1.06, 1, 1.06); slab.position.x = off; slab.rotation.y = rot; g.add(slab);
    const wall = extrudeY(shape, FH - 0.06, MAT.win, y + 0.06); wall.position.x = off; wall.rotation.y = rot; g.add(wall);
    if (i > 0 && i % 2 === 0) { const t = extrudeY(shape, 0.03, MAT.roof, y); t.scale.set(1.12, 1, 1.12); t.position.x = off - 0.03; t.rotation.y = rot; g.add(t); }
  }
  const top = floors * FH; const off = Math.sin(floors * 0.9) * lean;
  const roof = extrudeY(shape, 0.05, MAT.white, top); roof.position.x = off; g.add(roof);
  const rg = extrudeY(shape, 0.04, MAT.roof, top + 0.05); rg.scale.set(0.9, 1, 0.9); rg.position.x = off; g.add(rg);
  if (pool) { const pw = plane(0.9, 0.55, MAT.water, w * 0.55 + 0.35, 0.03, d * 0.3); g.add(pw); g.add(extrudeY(roundedRectShape(1.05, 0.7, 0.3), 0.025, MAT.pave, 0).translateX(w * 0.55 + 0.35).translateZ(d * 0.3)); }
  g.position.set(cx, 0, cz); return g;
}
// torre em degraus (cilindros decrescentes) com rampa em espiral
function spiralTower(o) {
  const { r = 0.8, levels = 5, lh = 0.4, cx = 0, cz = 0, spire = true } = o; const g = new T3.Group(); let prev = r + 0.08;
  for (let i = 0; i < levels; i++) {
    const ri = r * (1 - i * 0.11); const y = i * lh;
    g.add(cyl(prev, prev, 0.06, MAT.white, 0, y, 0, 40));
    if (i > 0) { const ring = new T3.RingGeometry(ri + 0.02, prev - 0.02, 40); ring.rotateX(-PI / 2); const rm = new T3.Mesh(ring, MAT.roof); rm.position.y = y + 0.065; rm.receiveShadow = true; g.add(rm); }
    g.add(arcWall(ri, 0, TAU, lh - 0.06, MAT.win, y + 0.06, { density: 5 }));
    prev = ri + 0.06;
  }
  const top = levels * lh; g.add(cyl(prev, prev, 0.05, MAT.white, 0, top, 0, 40)); g.add(cyl(prev - 0.06, prev - 0.06, 0.04, MAT.roof, 0, top + 0.05, 0, 40));
  if (spire) { g.add(cyl(0.02, 0.06, 0.5, MAT.steel, 0, top + 0.05, 0, 8)); g.add(sph(0.05, MAT.lit, 0, top + 0.58, 0)); }
  // rampa helicoidal
  const pts = []; for (let i = 0; i <= 60; i++) { const a = i / 60 * TAU * 1.5; const rr2 = r * 1.12 - (i / 60) * r * 0.42; pts.push(V3(Math.cos(a) * rr2, 0.08 + (i / 60) * top * 0.9, Math.sin(a) * rr2)); }
  const tube = new T3.Mesh(new T3.TubeGeometry(new T3.CatmullRomCurve3(pts), 90, 0.035, 6, false), MAT.whitePlain); tube.castShadow = true; g.add(tube);
  g.position.set(cx, 0, cz); return g;
}
function domeGeo(r, o = {}) {
  const g = new T3.Group();
  const sg = new T3.SphereGeometry(r, 18, 10, 0, TAU, 0, PI / 2); const s = new T3.Mesh(sg, o.mat || MAT.glass); s.castShadow = false; g.add(s);
  const lat = new T3.LineSegments(new T3.EdgesGeometry(new T3.IcosahedronGeometry(r * 1.002, o.detail == null ? 2 : o.detail)), MAT.edge);
  lat.scale.y = 1; g.add(lat); // treliça geodésica
  const clip = new T3.Mesh(new T3.CylinderGeometry(r + 0.06, r + 0.1, 0.08, 32), MAT.white); clip.position.y = 0.04; g.add(clip); // anel de base
  g.position.set(o.cx || 0, 0, o.cz || 0); return g;
}
function treeAt(x, z, s = 1, ry = 0, canopyColor) { const m = new T3.Mesh(treeGeo, MAT.leaf); m.position.set(x, 0, z); m.rotation.y = ry; m.scale.set(s, s, s); m.castShadow = true; return m; }
function trees(list, seed = 1) { const g = new T3.Group(); list.forEach(([x, z, s], i) => g.add(treeAt(x, z, s || 0.8, hash(i, seed, 5) * TAU))); return g; }
function acacia(x, z, s = 1) { const g = new T3.Group(); g.add(cyl(0.02, 0.035, 0.45 * s, MAT.trunk, 0, 0, 0, 5)); const c = new T3.Mesh(new T3.CylinderGeometry(0.34 * s, 0.14 * s, 0.1 * s, 9), MAT.leaf); c.position.y = 0.48 * s; c.castShadow = true; g.add(c); g.position.set(x, 0, z); return g; }
function pool(shapePts, y = 0.025, rim = true) {
  const g = new T3.Group(); const sh = blobShape(shapePts);
  if (rim) { const r = extrudeY(sh, 0.03, MAT.pave, 0); r.scale.set(1.12, 1, 1.12); g.add(r); }
  const w = extrudeY(sh, 0.005, MAT.water, y); w.castShadow = false; g.add(w); return g;
}
function fountain(x, z, s = 1) {
  const g = new T3.Group(); g.add(cyl(0.06 * s, 0.08 * s, 0.14 * s, MAT.white, 0, 0, 0, 10));
  const jet = new T3.Mesh(new T3.ConeGeometry(0.09 * s, 0.34 * s, 10), MAT.glassWarm); jet.position.y = 0.3 * s; jet.castShadow = false; g.add(jet);
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; g.add(sph(0.025 * s, MAT.lit, Math.cos(a) * 0.1 * s, 0.32 * s, Math.sin(a) * 0.1 * s)); }
  g.position.set(x, 0, z); return g;
}
function paveArea(w, d, x = 0, z = 0, r = 0.2) { const m = extrudeY(roundedRectShape(w, d, r), 0.02, MAT.pave, 0); m.position.set(x, 0, z); return m; }
function lawn(w, d, x = 0, z = 0, r = 0.3) { const m = extrudeY(roundedRectShape(w, d, r), 0.015, MAT.lawn, 0); m.position.set(x, 0, z); return m; }
function boxBuilding(o) {
  const { w = 1, d = 0.8, floors = 3, cx = 0, cz = 0, win = MAT.winDark, roof = true } = o; const g = new T3.Group();
  for (let i = 0; i < floors; i++) {
    const y = i * FH; g.add(box(w + 0.04, 0.06, d + 0.04, MAT.white, 0, y, 0));
    const hw = w / 2, hd = d / 2, yy = y + 0.06, h = FH - 0.06;
    g.add(flatWall(-hw, hd, hw, hd, h, win, yy), flatWall(hw, hd, hw, -hd, h, win, yy), flatWall(hw, -hd, -hw, -hd, h, win, yy), flatWall(-hw, -hd, -hw, hd, h, win, yy));
  }
  const top = floors * FH; g.add(box(w + 0.04, 0.05, d + 0.04, MAT.white, 0, top, 0)); if (roof) g.add(box(w - 0.1, 0.03, d - 0.1, MAT.roof, 0, top + 0.05, 0));
  g.position.set(cx, 0, cz); return g;
}
function fenceRing(r, h, cx = 0, cz = 0) { const g = new T3.Group(); g.add(arcWall(r, 0, TAU, h, MAT.mesh, 0, { density: 4 })); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.add(cyl(0.012, 0.012, h, MAT.steel, Math.cos(a) * r, 0, Math.sin(a) * r, 5)); } g.position.set(cx, 0, cz); return g; }
function gorilla(x, z, s = 1, ry = 0) { const g = new T3.Group(); g.add(sph(0.11 * s, MAT.animalDark, 0, 0.13 * s, 0, { sx: 1.25, sy: 0.9, sz: 1 })); g.add(sph(0.07 * s, MAT.animalDark, 0.12 * s, 0.24 * s, 0)); g.add(cyl(0.03 * s, 0.035 * s, 0.14 * s, MAT.animalDark, 0.1 * s, 0, 0.06 * s, 6), cyl(0.03 * s, 0.035 * s, 0.14 * s, MAT.animalDark, 0.1 * s, 0, -0.06 * s, 6)); g.position.set(x, 0, z); g.rotation.y = ry; return g; }
function elephant(x, z, s = 1, ry = 0) {
  const g = new T3.Group(); g.add(sph(0.16 * s, MAT.animal, 0, 0.26 * s, 0, { sx: 1.5, sy: 1, sz: 1 })); g.add(sph(0.1 * s, MAT.animal, 0.24 * s, 0.32 * s, 0));
  g.add(cyl(0.025 * s, 0.035 * s, 0.28 * s, MAT.animal, 0.34 * s, 0.05 * s, 0, 6)); // tromba
  for (const [lx, lz] of [[0.12, 0.07], [0.12, -0.07], [-0.12, 0.07], [-0.12, -0.07]]) g.add(cyl(0.04 * s, 0.045 * s, 0.22 * s, MAT.animal, lx * s, 0, lz * s, 6));
  g.add(box(0.02 * s, 0.12 * s, 0.1 * s, MAT.animal, 0.26 * s, 0.28 * s, 0.1 * s), box(0.02 * s, 0.12 * s, 0.1 * s, MAT.animal, 0.26 * s, 0.28 * s, -0.1 * s));
  g.position.set(x, 0, z); g.rotation.y = ry; return g;
}
function giraffe(x, z, s = 1, ry = 0) {
  const g = new T3.Group(); g.add(box(0.28 * s, 0.14 * s, 0.12 * s, MAT.giraffe, 0, 0.3 * s, 0)); const neck = box(0.05 * s, 0.4 * s, 0.06 * s, MAT.giraffe, 0.16 * s, 0.38 * s, 0); neck.rotation.z = -0.4; g.add(neck);
  g.add(box(0.1 * s, 0.06 * s, 0.06 * s, MAT.giraffe, 0.34 * s, 0.76 * s, 0)); for (const [lx, lz] of [[0.1, 0.04], [0.1, -0.04], [-0.1, 0.04], [-0.1, -0.04]]) g.add(cyl(0.02 * s, 0.02 * s, 0.3 * s, MAT.giraffe, lx * s, 0, lz * s, 5));
  g.position.set(x, 0, z); g.rotation.y = ry; return g;
}
function hippo(x, z, s = 1, ry = 0) { const g = new T3.Group(); g.add(sph(0.14 * s, MAT.animal, 0, 0.02 * s, 0, { sx: 1.6, sy: 0.7, sz: 1 })); g.add(sph(0.08 * s, MAT.animal, 0.2 * s, 0.06 * s, 0, { sx: 1.3, sy: 0.8, sz: 1 })); g.position.set(x, 0, z); g.rotation.y = ry; return g; }
function rock(x, z, s = 1) { const m = new T3.Mesh(new T3.IcosahedronGeometry(0.18 * s, 0), MAT.rock); m.position.set(x, 0.08 * s, z); m.scale.set(1.3, 0.7, 1); m.rotation.y = hash(x * 10, z * 10, 4) * 3; m.castShadow = true; return m; }
function turbine(x, z, s = 1) {
  const g = new T3.Group(); g.add(cyl(0.02 * s, 0.035 * s, 1.1 * s, MAT.whitePlain, 0, 0, 0, 8)); g.add(box(0.12 * s, 0.07 * s, 0.07 * s, MAT.whitePlain, 0, 1.06 * s, 0));
  const hub = new T3.Group(); hub.position.set(0.07 * s, 1.095 * s, 0); for (let i = 0; i < 3; i++) { const b = box(0.02 * s, 0.5 * s, 0.05 * s, MAT.whitePlain, 0, 0, 0); b.position.y = 0; b.geometry.translate(0, 0.25 * s, 0); b.rotation.x = i * TAU / 3; hub.add(b); }
  hub.userData.keep = true; hub.userData.spin = true; g.add(hub); g.position.set(x, 0, z); return g;
}
function solarRows(x, z, n = 3, len = 0.7) { const g = new T3.Group(); for (let i = 0; i < n; i++) { const p = box(len, 0.02, 0.25, MAT.solar, 0, 0.12, i * 0.32); p.rotation.x = -0.45; g.add(p); g.add(cyl(0.01, 0.01, 0.12, MAT.steel, -len * 0.35, 0, i * 0.32, 4), cyl(0.01, 0.01, 0.12, MAT.steel, len * 0.35, 0, i * 0.32, 4)); } g.position.set(x, 0, z); return g; }
function bridge(x0, z0, x1, z1, h = 0.35, w = 0.16) {
  const g = new T3.Group(); const len = Math.hypot(x1 - x0, z1 - z0); const a = Math.atan2(x1 - x0, z1 - z0);
  const deck = box(w, 0.03, len, MAT.whitePlain, 0, h, 0); deck.rotation.y = a; deck.position.set((x0 + x1) / 2, h, (z0 + z1) / 2); g.add(deck);
  const rail = box(w + 0.02, 0.1, len, MAT.glass, 0, 0, 0); rail.position.set((x0 + x1) / 2, h + 0.08, (z0 + z1) / 2); rail.rotation.y = a; rail.castShadow = false; g.add(rail);
  const n = Math.max(2, Math.round(len / 0.6)); for (let i = 0; i <= n; i++) { const t = i / n; g.add(cyl(0.02, 0.025, h, MAT.whitePlain, x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, 6)); }
  return g;
}
function ribbonRoad(points, w = 0.42, y = 0) {
  const g = new T3.Group(); const curve = new T3.CatmullRomCurve3(points.map(p => V3(p[0], p[1] + y, p[2])));
  const sh = new T3.Shape(); sh.moveTo(-w / 2, -0.02); sh.lineTo(w / 2, -0.02); sh.lineTo(w / 2, 0.02); sh.lineTo(-w / 2, 0.02); sh.closePath();
  const geo = new T3.ExtrudeGeometry(sh, { steps: 48, extrudePath: curve, bevelEnabled: false }); const m = new T3.Mesh(geo, MAT.asphaltLight); m.castShadow = true; m.receiveShadow = true; g.add(m);
  const sh2 = new T3.Shape(); sh2.moveTo(-w / 2 - 0.02, 0.02); sh2.lineTo(w / 2 + 0.02, 0.02); sh2.lineTo(w / 2 + 0.02, 0.04); sh2.lineTo(-w / 2 - 0.02, 0.04); sh2.closePath();
  const edge = new T3.Mesh(new T3.ExtrudeGeometry(sh2, { steps: 48, extrudePath: curve, bevelEnabled: false }), MAT.paintW); g.add(edge);
  const n = 6; for (let i = 0; i <= n; i++) { const p = curve.getPoint(i / n); if (p.y > 0.1) g.add(cyl(0.05, 0.06, p.y, MAT.curb, p.x, 0, p.z, 8)); }
  return g;
}
function playground(x, z) { const g = new T3.Group(); g.add(box(0.12, 0.12, 0.12, MAT.red, -0.15, 0, 0), cyl(0.05, 0.05, 0.16, MAT.yellow, 0.05, 0, 0.08, 8), box(0.25, 0.02, 0.06, MAT.blue, 0.15, 0.12, -0.1), cyl(0.01, 0.01, 0.13, MAT.steel, 0.05, 0, -0.1, 4), cyl(0.01, 0.01, 0.13, MAT.steel, 0.25, 0, -0.1, 4)); g.position.set(x, 0, z); return g; }
function lamps(list) { const g = new T3.Group(); for (const [x, z] of list) { g.add(cyl(0.01, 0.015, 0.4, MAT.steel, x, 0, z, 4)); g.add(sph(0.03, MAT.lampGlow, x, 0.42, z)); } return g; }
function base(w, d, mat = MAT.lawn) { const b = plane(w - 0.06, d - 0.06, mat, 0, 0.012, 0); b.castShadow = false; return b; }

/* ---------------- catálogo de modelos ---------------- */
// cada função recebe (w, d) do lote em quadrados e devolve o Group
const MODEL = {
  // --- moradias: 7 estágios ---
  res1: () => grp(base(3, 2), boxBuilding({ w: 0.55, d: 0.45, floors: 2, cx: 0.55, cz: 0.15 }), boxBuilding({ w: 0.4, d: 0.4, floors: 1, cx: 1.05, cz: -0.25 }), boxBuilding({ w: 0.45, d: 0.35, floors: 2, cx: 0.25, cz: -0.4 }),
    amphi(-0.75, -0.15, 0.55), trees([[-1.2, 0.6, 0.7], [1.3, 0.6, 0.6], [-0.3, 0.75, 0.6]], 11)),
  res2: () => { const g = grp(base(3, 2)); for (let i = 0; i < 6; i++) g.add(boxBuilding({ w: 0.42, d: 0.36, floors: 2 + (i % 2), cx: -0.95 + (i % 3) * 0.72, cz: -0.35 + Math.floor(i / 3) * 0.7 })); g.add(paveArea(2.6, 0.18, 0, 0), trees([[1.25, -0.7, 0.6], [-1.3, 0.75, 0.6]], 12)); return g; },
  res3: () => grp(base(3, 2), arcBuilding({ r0: 0.95, r1: 1.55, a0: PI * 1.08, a1: PI * 1.92, floors: 3, step: 0.13, cx: 0, cz: 1.05 }), trees([[-1.2, 0.7, 0.6], [1.2, 0.7, 0.6], [0, -0.75, 0.5]], 13)),
  res4: () => grp(base(3, 2), curvedTower({ w: 1.15, d: 0.7, floors: 5, lean: 0.07, twist: 0.06, cx: -0.35, cz: 0 }), trees([[-1.25, 0.7, 0.6], [1.2, -0.7, 0.6]], 14)),
  res5: () => grp(base(3, 2), curvedTower({ w: 1.2, d: 0.75, floors: 6, lean: 0.09, twist: -0.05, cx: -0.3, cz: 0.05 }), pool([[0.9, 0.6], [1.35, 0.55], [1.4, 0.85], [1.0, 0.9]], 0.025), trees([[-1.3, -0.7, 0.6], [1.25, -0.6, 0.6]], 15)),
  res6: () => grp(base(3, 2), spiralTower({ r: 0.62, levels: 6, lh: 0.36, cx: 0, cz: 0 }), lawn(2.6, 1.6, 0, 0, 0.8), trees([[-1.15, 0.65, 0.6], [1.15, 0.65, 0.6], [-1.15, -0.65, 0.6], [1.15, -0.65, 0.6]], 16)),
  res7: () => { const ring = arcBuilding({ r0: 0.82, r1: 1.38, a0: 0, a1: TAU, floors: 5, step: 0.035, win: MAT.win }); ring.scale.z = 0.7; const g = grp(base(3, 2), ring, disc(0.7, MAT.lawn, 0, 0.02, 0, 32), treeAt(0.1, 0.05, 0.7, 1), treeAt(-0.25, -0.15, 0.55, 2), fountain(0.3, -0.2, 0.5)); g.children[3].scale.z = 0.7; return g; },
  // --- fábricas ---
  fab1: () => { const g = grp(base(3, 2)); g.add(cyl(0.95, 1.0, 0.16, MAT.white, 0, 0, 0, 36)); g.add(cyl(0.82, 0.82, 0.17, MAT.dark, 0, 0, 0, 36)); const tor = new T3.Mesh(new T3.TorusGeometry(0.62, 0.06, 8, 36), MAT.glassWarm); tor.rotation.x = PI / 2; tor.position.y = 0.2; g.add(tor);
    g.add(box(0.3, 0.2, 0.2, MAT.steel, 0.2, 0.17, 0.1), box(0.25, 0.28, 0.2, MAT.blue, -0.3, 0.17, -0.15), box(0.2, 0.15, 0.15, MAT.whitePlain, 0.1, 0.17, -0.4)); g.add(lamps([[0.9, 0.7], [-0.9, -0.7]])); g.add(trees([[1.25, -0.65, 0.6], [-1.25, 0.6, 0.6]], 21)); return g; },
  fab2: () => grp(base(3, 2), labArc(1.15, 1.85, PI * 1.08, PI * 1.92, 0, 1.25, 2), trees([[-1.3, 0.75, 0.55], [1.3, 0.75, 0.55]], 22)),
  fab3: () => grp(base(4, 2), labArc(1.7, 2.45, PI * 1.1, PI * 1.9, 0, 1.75, 2), trees([[-1.8, 0.75, 0.55], [1.8, 0.75, 0.55]], 23)),
  fab4: () => { const g = grp(base(3, 2), paveArea(2.7, 1.7, 0, 0)); const w = 1.4, d = 0.9;
    for (let i = 0; i < 3; i++) { const y = i * FH; g.add(box(w, 0.05, d, MAT.white, 0, y, 0)); g.add(flatWall(w / 2, d / 2, w / 2, -d / 2, FH - 0.05, MAT.win, y + 0.05), flatWall(w / 2, -d / 2, -w / 2, -d / 2, FH - 0.05, MAT.win, y + 0.05), flatWall(-w / 2, -d / 2, -w / 2, d / 2, FH - 0.05, MAT.win, y + 0.05));
      g.add(box(0.25, 0.16, 0.2, i % 2 ? MAT.blue : MAT.steel, -0.35, y + 0.05, 0.1), box(0.3, 0.12, 0.25, MAT.whitePlain, 0.3, y + 0.05, -0.1), box(0.02, FH - 0.05, d - 0.1, MAT.whitePlain, 0.05, y + 0.05, 0)); }
    g.add(box(w, 0.05, d, MAT.white, 0, 3 * FH, 0), box(w - 0.12, 0.03, d - 0.12, MAT.roof, 0, 3 * FH + 0.05, 0)); g.add(trees([[-1.25, 0.6, 0.55], [1.25, 0.6, 0.55]], 24)); return g; },
  // --- lojas ---
  loja1: () => grp(base(3, 2), paveArea(2.6, 1.6, 0, 0.05), boxBuilding({ w: 1.2, d: 0.5, floors: 2, cx: 0, cz: -0.55, win: MAT.win }), pool([[-0.5, 0.25], [0.5, 0.15], [0.55, 0.65], [-0.45, 0.7]], 0.025), fountain(0, 0.42, 0.7), trees([[-1.15, 0.5, 0.6], [1.15, 0.5, 0.6]], 31), lamps([[-1.2, -0.7], [1.2, -0.7]])),
  loja2: () => grp(base(3, 2), paveArea(2.8, 1.8, 0, 0, 0.3), pool([[-0.25, -0.55], [0.25, -0.5], [0.3, 0.55], [-0.2, 0.6]], 0.025), bridge(-1.2, 0.1, 1.2, 0.1, 0.32), boxBuilding({ w: 0.5, d: 0.4, floors: 1, cx: 1.0, cz: -0.55, win: MAT.win }), trees([[-1.1, 0.6, 0.5], [1.05, 0.65, 0.5], [-1.15, -0.6, 0.5]], 32), lamps([[0.7, -0.7], [-0.7, 0.7]])),
  loja3: () => { const g = grp(base(3, 2)); for (let i = 0; i < 3; i++) { const w = 2.2 - i * 0.55, d = 1.2 - i * 0.28; const y = i * 0.3; g.add(box(w, 0.06, d, MAT.white, -i * 0.25, y, i * 0.12)); g.add(box(w - 0.08, 0.22, d - 0.08, MAT.win, -i * 0.25, y + 0.06, i * 0.12)); const roof = box(w - 0.1, 0.03, d - 0.1, MAT.glass, -i * 0.25, y + 0.29, i * 0.12); roof.castShadow = false; g.add(roof); if (i < 2) g.add(box(0.45, 0.02, d - 0.4, MAT.solar, -i * 0.25 + w / 2 - 0.35, y + 0.31, i * 0.12)); }
    g.add(trees([[1.3, 0.7, 0.55], [-1.3, -0.7, 0.55]], 33)); return g; },
  loja4: () => grp(base(3, 2), arcBuilding({ r0: 1.7, r1: 2.3, a0: PI * 1.1, a1: PI * 1.9, floors: 4, step: 0.03, cx: 0, cz: 2.15, win: MAT.win }), trees([[-1.2, 0.75, 0.55], [1.2, 0.75, 0.55]], 34)),
  loja5: () => { const g = grp(base(4, 2)); const sh = blobShape([[-1.6, -0.5], [-0.6, -0.75], [0.6, -0.55], [1.6, -0.6], [1.7, 0.4], [0.7, 0.7], [-0.5, 0.5], [-1.5, 0.7]]);
    for (let i = 0; i < 2; i++) { const y = i * FH; const s = extrudeY(sh, 0.06, MAT.white, y); s.scale.set(1.03, 1, 1.03); g.add(s); g.add(extrudeY(sh, FH - 0.06, MAT.win, y + 0.06)); }
    g.add(extrudeY(sh, 0.05, MAT.white, 2 * FH)); const r = extrudeY(sh, 0.04, MAT.roof, 2 * FH + 0.05); r.scale.set(0.92, 1, 0.92); g.add(r);
    const patio = extrudeY(blobShape([[-0.4, -0.2], [0.4, -0.25], [0.45, 0.2], [-0.35, 0.25]]), 0.02, MAT.pave, 2 * FH + 0.09); g.add(patio); g.add(trees([[-1.9, 0.8, 0.55], [1.9, -0.8, 0.55]], 35)); return g; },
  // --- energia ---
  ener1: () => grp(base(3, 2), turbine(-0.9, -0.3, 0.9), turbine(0.1, -0.55, 1.0), turbine(1.0, -0.2, 0.85), solarRows(-0.6, 0.25, 2, 1.0), solarRows(0.6, 0.25, 2, 1.0), boxBuilding({ w: 0.5, d: 0.35, floors: 1, cx: 1.1, cz: 0.65 }), trees([[-1.3, 0.75, 0.5]], 41)),
  ener2: () => { const g = grp(base(4, 2), arcBuilding({ r0: 0.9, r1: 1.45, a0: PI * 0.9, a1: PI * 2.1, floors: 3, step: 0.06, cx: 0.3, cz: 0.9, lit: false }));
    for (const [x, z, r] of [[-1.0, -0.2, 0.62], [0.35, -0.45, 0.7], [1.35, 0.1, 0.55]]) { g.add(cyl(0.05, 0.07, 1.15, MAT.white, x, 0, z, 8)); g.add(cyl(r, r * 0.9, 0.05, MAT.solar, x, 1.15, z, 24)); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; const rib = box(r, 0.012, 0.03, MAT.white, x + Math.cos(a) * r / 2, 1.2, z + Math.sin(a) * r / 2); rib.rotation.y = -a; g.add(rib); } }
    g.add(trees([[-1.8, 0.8, 0.5], [1.85, 0.8, 0.5]], 42)); return g; },
  ener3: () => { const g = grp(base(4, 2), arcBuilding({ r0: 1.15, r1: 1.75, a0: PI * 0.85, a1: PI * 2.05, floors: 3, step: 0.1, cx: 0.2, cz: 0.75 }));
    const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new T3.Vector2(0.05 + t * 1.5, 1.6 - t * t * 0.7)); } const can = new T3.Mesh(new T3.LatheGeometry(pts, 24), MAT.glass); can.position.set(0.2, 0, -0.1); can.castShadow = false; g.add(can);
    g.add(cyl(0.05, 0.08, 1.6, MAT.white, 0.2, 0, -0.1, 10)); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; const rib = box(1.5, 0.02, 0.025, MAT.white, 0.2 + Math.cos(a) * 0.78, 1.28, -0.1 + Math.sin(a) * 0.78); rib.rotation.y = -a; rib.rotation.z = 0.42; g.add(rib); }
    g.add(turbine(-1.7, -0.6, 0.75), turbine(1.75, -0.65, 0.75), solarRows(1.2, 0.3, 2, 0.8), trees([[-1.8, 0.8, 0.5]], 43)); return g; },
  // --- água ---
  agua1: () => grp(base(2, 1), paveArea(1.8, 0.85, 0, 0, 0.2), pool([[-0.55, -0.15], [0.55, -0.2], [0.6, 0.25], [-0.5, 0.3]], 0.025), fountain(0, 0.05, 0.6), trees([[-0.85, 0.35, 0.45], [0.85, 0.35, 0.45]], 51), lamps([[-0.85, -0.35], [0.85, -0.35]])),
  agua2: () => grp(base(2, 1), pool([[-0.8, -0.25], [-0.1, -0.35], [0.7, -0.2], [0.85, 0.2], [0.2, 0.38], [-0.7, 0.3]], 0.02, false), boxBuilding({ w: 0.3, d: 0.25, floors: 1, cx: 0.8, cz: -0.32 }), rock(-0.4, 0.05, 0.6), trees([[-0.85, -0.3, 0.5], [0.9, 0.3, 0.45], [-0.15, 0.4, 0.4]], 52)),
  agua3: () => grp(base(3, 1), arcBuilding({ r0: 0.95, r1: 1.2, a0: 0.15, a1: TAU - 0.15, floors: 2, step: 0.04, cx: 0, cz: 0, lit: false }), disc(0.9, MAT.water, 0, 0.02, 0, 40), fountain(0, 0, 0.8), trees([[-1.35, 0.35, 0.4], [1.35, -0.35, 0.4]], 53)),
  // --- reciclagem ---
  rec1: () => grp(base(2, 2), cyl(0.5, 0.5, 0.18, MAT.white, -0.35, 0, 0.3, 32), disc(0.44, MAT.water, -0.35, 0.185, 0.3, 32), boxBuilding({ w: 0.7, d: 0.5, floors: 1, cx: 0.45, cz: -0.45, roof: true }), cyl(0.04, 0.04, 0.5, MAT.steel, 0.15, 0.1, 0.1, 6, { rz: PI / 2 }), trees([[0.75, 0.7, 0.5], [-0.75, -0.7, 0.5]], 54)),
  rec2: () => grp(base(3, 2), labArc(1.2, 1.85, PI * 1.15, PI * 1.85, 0, 1.35, 2, true), cyl(0.3, 0.3, 0.14, MAT.white, 1.0, 0, 0.4, 24), disc(0.26, MAT.water, 1.0, 0.145, 0.4, 24), trees([[-1.3, 0.7, 0.5]], 55)),
  rec3: () => grp(base(4, 2), arcBuilding({ r0: 1.5, r1: 2.1, a0: PI * 1.05, a1: PI * 1.95, floors: 3, step: 0.1, cx: -0.3, cz: 1.7 }), boxBuilding({ w: 0.5, d: 0.4, floors: 2, cx: 1.2, cz: 0.3 }), boxBuilding({ w: 0.4, d: 0.4, floors: 1, cx: 1.6, cz: -0.25 }), trees([[-1.8, 0.8, 0.5], [1.85, 0.8, 0.5]], 56)),
  // --- segurança ---
  seg1: () => grp(base(2, 2), paveArea(1.7, 1.7, 0, 0, 0.2), boxBuilding({ w: 0.7, d: 0.6, floors: 5, cx: 0, cz: 0 }), cyl(0.012, 0.012, 0.4, MAT.steel, 0.2, 5 * FH + 0.08, 0.2, 4), sph(0.03, MAT.red, 0.2, 5 * FH + 0.5, 0.2), trees([[-0.7, 0.7, 0.45], [0.7, -0.7, 0.45]], 61)),
  seg2: () => grp(base(3, 2), paveArea(2.8, 1.8, 0, 0, 0.3), pool([[-0.2, -0.55], [0.2, -0.5], [0.25, 0.55], [-0.15, 0.6]], 0.025), bridge(-1.2, -0.05, 1.2, -0.05, 0.34), boxBuilding({ w: 0.6, d: 0.45, floors: 2, cx: -0.95, cz: 0.5, win: MAT.win }), boxBuilding({ w: 0.5, d: 0.4, floors: 1, cx: 1.0, cz: 0.5 }), lamps([[0.9, -0.7], [-0.9, -0.7]]), trees([[1.25, -0.65, 0.45]], 62)),
  // --- saúde ---
  sau1: () => grp(base(3, 2), paveArea(2.6, 1.6, 0, 0, 0.3), domeGeo(0.75, { cx: -0.3, cz: 0 }), boxBuilding({ w: 0.5, d: 0.45, floors: 1, cx: -0.3, cz: 0, roof: false }), boxBuilding({ w: 0.6, d: 0.4, floors: 1, cx: 0.95, cz: -0.4 }), sph(0.06, MAT.red, 0.95, FH + 0.12, -0.4), trees([[1.2, 0.55, 0.5], [-1.25, -0.6, 0.5]], 63)),
  sau2: () => { const g = grp(base(3, 2), arcBuilding({ r0: 1.2, r1: 1.85, a0: PI * 1.05, a1: PI * 1.95, floors: 3, step: 0.16, cx: 0, cz: 1.35 })); const pw = extrudeY(blobShape([[-0.5, -0.3], [0.3, -0.35], [0.5, 0.05], [-0.4, 0.1]]), 0.02, MAT.water, 3 * FH + 0.1); pw.position.set(-0.1, 0, -0.35); g.add(pw); g.add(trees([[-1.25, 0.7, 0.5], [1.25, 0.7, 0.5]], 64)); return g; },
  sau3: () => grp(base(3, 2), paveArea(2.7, 1.7, 0, 0, 0.3), curvedTower({ w: 0.8, d: 0.55, floors: 5, lean: 0.08, twist: 0.07, cx: -0.75, cz: -0.1, pool: false }), curvedTower({ w: 0.9, d: 0.6, floors: 6, lean: -0.07, twist: -0.06, cx: 0.15, cz: 0.15, pool: false }), curvedTower({ w: 0.7, d: 0.5, floors: 4, lean: 0.06, twist: 0.05, cx: 0.95, cz: -0.3, pool: false }), sph(0.07, MAT.red, 0.15, 6 * FH + 0.2, 0.15), trees([[-1.25, 0.65, 0.45], [1.25, 0.65, 0.45]], 65)),
  // --- educação ---
  edu1: () => grp(base(3, 2), arcBuilding({ r0: 1.0, r1: 1.7, a0: PI * 1.05, a1: PI * 1.95, floors: 2, step: 0.22, cx: 0, cz: 1.15 }), playground(-0.9, -0.05), playground(0.4, -0.25), lawn(1.2, 0.5, 0.2, 0.45), trees([[-1.25, 0.7, 0.5], [1.3, 0.7, 0.5]], 71)),
  edu2: () => grp(base(3, 2), arcBuilding({ r0: 1.35, r1: 1.95, a0: PI * 0.95, a1: PI * 2.02, floors: 3, step: 0.12, cx: 0.2, cz: 1.0 }), plane(1.1, 0.7, MAT.field, 0.2, 0.02, 0.05), paveArea(0.5, 0.4, -0.75, 0.2), playground(-0.75, 0.2), trees([[-1.3, 0.75, 0.45], [1.35, 0.75, 0.45]], 72)),
  edu3: () => { const g = grp(base(2, 2), paveArea(1.8, 1.8, 0, 0, 0.2)); const s = 1.05; const core = box(s - 0.2, s, s - 0.2, MAT.glassWarm, 0, 0.1, 0); core.castShadow = false; g.add(core);
    for (let i = 0; i < 3; i++) g.add(box(s - 0.24, 0.04, s - 0.24, MAT.wood, 0, 0.12 + i * 0.32, 0));
    const hw = s / 2, y0 = 0.1; g.add(flatWall(-hw, hw, hw, hw, s, MAT.lattice, y0), flatWall(hw, hw, hw, -hw, s, MAT.lattice, y0), flatWall(hw, -hw, -hw, -hw, s, MAT.lattice, y0), flatWall(-hw, -hw, -hw, hw, s, MAT.lattice, y0));
    for (const [x, z] of [[-hw, -hw], [hw, -hw], [hw, hw], [-hw, hw]]) g.add(cyl(0.03, 0.03, s + 0.1, MAT.wood, x, 0, z, 6));
    g.add(box(s + 0.1, 0.04, s + 0.1, MAT.wood, 0, s + 0.1, 0), box(s - 0.3, 0.03, s - 0.3, MAT.roof, 0, s + 0.14, 0)); g.add(trees([[-0.75, 0.75, 0.4], [0.75, -0.75, 0.4]], 73)); return g; },
  edu4: () => grp(base(4, 2), arcBuilding({ r0: 1.5, r1: 2.1, a0: PI * 0.92, a1: PI * 2.06, floors: 3, step: 0.12, cx: 0, cz: 0.95 }), plane(1.4, 0.8, MAT.field, 0, 0.02, 0.05), trees([[-1.85, 0.8, 0.45], [1.85, 0.8, 0.45], [0.9, -0.5, 0.4]], 74)),
  // --- parques ---
  par1: () => grp(base(2, 1), paveArea(1.8, 0.85, 0, 0, 0.2), pool([[-0.5, -0.12], [0.45, -0.15], [0.5, 0.2], [-0.45, 0.22]], 0.025), fountain(0, 0.03, 0.55), trees([[-0.8, 0.3, 0.42], [0.8, 0.3, 0.42], [0.8, -0.3, 0.4]], 81), lamps([[-0.8, -0.3]])),
  par2: () => grp(base(2, 1), plane(1.3, 0.8, MAT.field, 0.25, 0.02, 0), playground(-0.72, 0), cyl(0.012, 0.012, 0.15, MAT.steel, -0.35, 0, -0.4, 4), trees([[0.9, 0.42, 0.35]], 82)),
  par3: () => grp(base(3, 2), amphi(0.2, 0.2, 1.0), boxBuilding({ w: 0.6, d: 0.4, floors: 2, cx: -1.05, cz: -0.55, win: MAT.win }), trees([[1.3, -0.7, 0.5], [-1.2, 0.6, 0.5]], 83), lamps([[1.2, 0.75]])),
  par4: () => grp(base(2, 1), disc(0.62, MAT.lawn, 0.15, 0.02, 0, 32), fenceRing(0.64, 0.28, 0.15, 0), gorilla(0.0, 0.1, 1, 0.5), gorilla(0.4, -0.15, 0.8, -1.2), gorilla(-0.25, -0.2, 0.7, 2.4), rock(0.45, 0.25, 0.5), trees([[-0.85, 0.3, 0.4], [-0.85, -0.3, 0.4]], 84)),
  par5: () => grp(base(2, 1), pool([[-0.85, -0.3], [0.0, -0.4], [0.85, -0.2], [0.8, 0.3], [0.1, 0.42], [-0.8, 0.3]], 0.02, false), hippo(-0.3, 0.02, 0.9, 0.4), hippo(0.35, -0.05, 0.8, -2.2), bridge(-0.9, 0.35, 0.9, -0.3, 0.14, 0.1), trees([[0.85, 0.42, 0.35], [-0.9, -0.42, 0.35]], 85)),
  par6: () => { const g = grp(base(3, 2)); const t = []; for (let i = 0; i < 16; i++) t.push([-1.3 + hash(i, 1, 86) * 2.6, -0.85 + hash(i, 2, 86) * 1.7, 0.55 + hash(i, 3, 86) * 0.45]); g.add(trees(t, 86)); g.add(bridge(-1.3, -0.6, 1.3, 0.6, 0.06, 0.12), lamps([[-0.6, -0.3], [0.6, 0.3]])); return g; },
  par7: () => { const g = grp(base(3, 2), pool([[0.3, -0.5], [1.3, -0.6], [1.35, 0.4], [0.5, 0.5]], 0.02, false)); const t = []; for (let i = 0; i < 12; i++) t.push([-1.3 + hash(i, 1, 87) * 1.5, -0.85 + hash(i, 2, 87) * 1.7, 0.55 + hash(i, 3, 87) * 0.45]); g.add(trees(t, 87)); g.add(bridge(-0.2, -0.7, 0.9, 0.7, 0.08, 0.1)); return g; },
  par8: () => grp(base(3, 2), plane(2.4, 1.5, MAT.sand, 0.1, 0.02, 0), arcBuilding({ r0: 0.9, r1: 1.2, a0: PI * 1.05, a1: PI * 1.45, floors: 2, step: 0.05, cx: -0.9, cz: 1.1, lit: false }), rock(0.2, -0.3, 1.1), rock(0.7, 0.2, 0.9), rock(-0.3, 0.35, 0.7), box(0.32, 0.12, 0.13, MAT.orange, 0.15, 0.06, 0.15), box(0.28, 0.11, 0.12, MAT.orange, 0.75, 0.06, -0.35), trees([[1.25, 0.7, 0.5], [-1.2, -0.6, 0.5], [1.2, -0.7, 0.45]], 88)),
  par9: () => { const g = grp(base(2, 2)); for (const [x, z, h] of [[-0.42, 0.25, 1.5], [0.42, -0.3, 1.7]]) { g.add(arcWall(0.42, 0, TAU, h, MAT.mesh, 0, { density: 4 }).translateX(x).translateZ(z)); g.add(cyl(0.44, 0.44, 0.05, MAT.white, x, h, z, 24)); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.add(cyl(0.012, 0.012, h, MAT.steel, x + Math.cos(a) * 0.42, 0, z + Math.sin(a) * 0.42, 4)); } g.add(treeAt(x, z, 1.5, 0.5), treeAt(x + 0.15, z - 0.1, 1.1, 2)); }
    g.add(bridge(-0.42, 0.25, 0.42, -0.3, 0.9, 0.1)); return g; },
  par10: () => { const g = grp(base(3, 2), paveArea(2.6, 1.6, 0, 0, 0.4), domeGeo(1.05, { cx: 0, cz: 0 })); g.add(disc(0.95, MAT.water, 0, 0.02, 0, 40)); g.add(rock(0.3, -0.2, 0.9), rock(-0.4, 0.3, 0.7)); g.add(sph(0.05, MAT.white, -0.2, 0.03, -0.3, { sx: 2.5, sy: 0.4, sz: 1 })); g.add(trees([[-1.2, 0.7, 0.45], [1.2, -0.7, 0.45]], 90)); return g; },
  par11: () => grp(base(4, 2), plane(3.6, 1.7, MAT.sand, 0, 0.02, 0), pool([[0.9, 0.2], [1.5, 0.15], [1.55, 0.6], [0.95, 0.65]], 0.03, false), elephant(-1.0, 0.1, 1, 0.4), elephant(-0.35, -0.4, 0.8, -1.5), giraffe(0.6, -0.3, 1, 0.3), giraffe(1.2, -0.55, 0.9, 2.5), acacia(-1.5, -0.5, 1.1), acacia(0.1, 0.5, 1), acacia(1.6, 0.6, 0.9), rock(-0.4, 0.55, 0.8), fenceRing(2.3, 0.12, 0, 0)),
  par12: () => { const g = grp(base(4, 1), arcBuilding({ r0: 1.35, r1: 1.6, a0: PI * 1.05, a1: PI * 1.95, floors: 2, step: 0.04, cx: 0, cz: 1.55, lit: false }), pool([[-0.5, -0.3], [0.2, -0.35], [0.4, 0.05], [-0.4, 0.1]], 0.02, false)); const t = []; for (let i = 0; i < 12; i++) t.push([-1.8 + hash(i, 1, 92) * 3.6, -0.4 + hash(i, 2, 92) * 0.8, 0.45 + hash(i, 3, 92) * 0.35]); g.add(trees(t, 92)); return g; },
  // --- transporte e comércio ---
  tra1: () => grp(base(3, 2), ribbonRoad([[-1.45, 0.05, -0.9], [-0.5, 0.35, -0.3], [0.5, 0.5, 0.2], [1.45, 0.3, 0.85]]), ribbonRoad([[-1.45, 0.02, 0.8], [-0.4, 0.12, 0.2], [0.6, 0.02, -0.5], [1.45, 0.02, -0.85]]), ribbonRoad([[-0.9, 0.7, 0.95], [-0.2, 0.75, 0.1], [0.9, 0.6, -0.95]], 0.32), boxBuilding({ w: 0.5, d: 0.35, floors: 1, cx: 1.05, cz: 0.6 }), trees([[-1.25, 0.7, 0.45], [1.25, -0.6, 0.45]], 93)),
  tra2: () => grp(base(2, 1), paveArea(1.8, 0.85, 0, 0, 0.15), bridge(-0.85, -0.2, 0.85, -0.2, 0.36), box(0.5, 0.16, 0.2, MAT.blue, 0.3, 0.02, 0.25), box(0.42, 0.06, 0.16, MAT.glass, 0.3, 0.18, 0.25), box(0.7, 0.03, 0.4, MAT.glassWarm, -0.4, 0.42, 0.2), cyl(0.015, 0.015, 0.42, MAT.steel, -0.7, 0, 0.35, 4), cyl(0.015, 0.015, 0.42, MAT.steel, -0.1, 0, 0.35, 4), lamps([[0.8, 0.35]])),
  mer1: () => grp(base(3, 2), disc(1.25, MAT.water, 0, 0.02, 0, 48), disc(0.95, MAT.pave, 0, 0.03, 0, 40), spiralTower({ r: 0.72, levels: 5, lh: 0.42, cx: 0, cz: 0 }), bridge(-1.45, 0, -0.9, 0, 0.05, 0.14), trees([[-1.3, 0.75, 0.4], [1.3, -0.75, 0.4]], 94)),
  // --- sede e marcos ---
  sede: () => grp(base(5, 2), arcBuilding({ r0: 0.62, r1: 0.98, a0: 0, a1: TAU, floors: 3, step: 0.02, cx: -0.9, cz: 0, win: MAT.win }), disc(0.55, MAT.lawn, -0.9, 0.02, 0, 32), treeAt(-0.9, 0.05, 0.7, 1), treeAt(-1.05, -0.2, 0.55, 2),
    arcBuilding({ r0: 0.7, r1: 1.0, a0: PI * 1.15, a1: PI * 1.85, floors: 2, step: 0.08, cx: 1.35, cz: 0.75, lit: false }), pool([[0.3, 0.1], [1.0, 0.0], [1.3, 0.45], [0.5, 0.55]], 0.02), bridge(0.2, -0.6, 2.0, -0.6, 0.1, 0.14), trees([[2.2, 0.5, 0.5], [0.4, -0.75, 0.45], [-2.2, 0.6, 0.5], [-2.2, -0.6, 0.5]], 95), lamps([[2.3, -0.8], [-0.2, 0.8]])),
  arco: () => { const g = grp(base(4, 2), arcBuilding({ r0: 0.95, r1: 1.4, a0: PI * 0.75, a1: PI * 2.25, floors: 3, step: 0.05, cx: 0, cz: 0.1 }), disc(0.85, MAT.water, 0, 0.02, 0.1, 40), treeAt(0.3, 0.05, 0.5, 1));
    const arch = new T3.Mesh(new T3.TorusGeometry(1.75, 0.42, 10, 30, PI), MAT.glass); arch.position.set(0, 0.05, 0.1); arch.scale.set(1, 0.75, 0.55); arch.castShadow = false; g.add(arch);
    const lat = new T3.LineSegments(new T3.EdgesGeometry(new T3.TorusGeometry(1.76, 0.42, 6, 18, PI)), MAT.edge); lat.position.set(0, 0.05, 0.1); lat.scale.set(1, 0.75, 0.55); g.add(lat);
    const inner = new T3.Mesh(new T3.TorusGeometry(1.75, 0.3, 8, 24, PI), MAT.glassWarm); inner.position.set(0, 0.05, 0.1); inner.scale.set(1, 0.72, 0.5); inner.castShadow = false; g.add(inner);
    for (const x of [-1.75, 1.75]) g.add(cyl(0.2, 0.26, 0.12, MAT.white, x, 0, 0.1, 16));
    g.add(trees([[-1.85, 0.8, 0.45], [1.85, 0.8, 0.45]], 96)); return g; },
  arcoCirc: () => { const g = grp(base(7, 3, MAT.lawn));
    g.add(arcBuilding({ r0: 2.55, r1: 3.15, a0: PI * 1.12, a1: PI * 1.88, floors: 4, step: 0.05, cx: 0, cz: 2.4 })); g.add(disc(1.75, MAT.water, 0, 0.02, 0.1, 48)); g.add(spiralTower({ r: 0.75, levels: 5, lh: 0.4, cx: 0, cz: 0.1 }));
    g.add(curvedTower({ w: 0.9, d: 0.6, floors: 4, lean: 0.07, twist: 0.06, cx: -2.7, cz: 0.6, pool: false }), curvedTower({ w: 0.9, d: 0.6, floors: 4, lean: -0.07, twist: -0.06, cx: 2.7, cz: 0.6, pool: false }));
    g.add(bridge(-1.7, 0.1, -0.85, 0.1, 0.08, 0.14), bridge(1.7, 0.1, 0.85, 0.1, 0.08, 0.14), bridge(0, 1.85, 0, 1.0, 0.08, 0.14));
    const t = []; for (let i = 0; i < 18; i++) t.push([-3.2 + hash(i, 1, 97) * 6.4, 0.9 + hash(i, 2, 97) * 0.5, 0.45 + hash(i, 3, 97) * 0.35]); g.add(trees(t, 97)); g.add(fountain(-1.0, 1.1, 0.6), fountain(1.0, 1.1, 0.6)); return g; },
  ciencia: () => { const g = grp(base(7, 3, MAT.lawn));
    g.add(arcBuilding({ r0: 1.35, r1: 1.85, a0: 0.2, a1: TAU - 0.2, floors: 3, step: 0.08, cx: -1.4, cz: -0.15 }), disc(1.25, MAT.water, -1.4, 0.02, -0.15, 40));
    g.add(arcBuilding({ r0: 0.9, r1: 1.25, a0: PI * 0.9, a1: PI * 2.1, floors: 3, step: 0.1, cx: 1.9, cz: 0.3, lit: true }));
    const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new T3.Vector2(0.05 + t * 1.2, 1.55 - t * t * 0.6)); } const can = new T3.Mesh(new T3.LatheGeometry(pts, 24), MAT.glass); can.position.set(1.9, 0, -0.45); can.castShadow = false; g.add(can); g.add(cyl(0.05, 0.08, 1.55, MAT.white, 1.9, 0, -0.45, 10));
    g.add(curvedTower({ w: 0.7, d: 0.5, floors: 4, lean: 0.06, twist: 0.06, cx: 0.55, cz: 0.75, pool: false }), turbine(3.1, -1.1, 0.7), turbine(2.6, -1.25, 0.6));
    g.add(plane(0.9, 0.55, MAT.field, -1.4, 0.03, -0.15)); g.add(elephant(2.9, 1.0, 0.7, 0.5), giraffe(3.2, 0.5, 0.7, 2)); const t = []; for (let i = 0; i < 14; i++) t.push([-3.3 + hash(i, 1, 98) * 6.6, -1.35 + hash(i, 2, 98) * 0.4, 0.4 + hash(i, 3, 98) * 0.3]); g.add(trees(t, 98)); return g; },
  santuario: () => { const g = grp(base(7, 3, MAT.lawn));
    const arc = MODEL.arco(); arc.position.set(-1.9, 0, -0.35); arc.scale.set(0.9, 0.9, 0.9); g.add(arc);
    g.add(plane(2.6, 1.3, MAT.sand, 1.4, 0.02, 0.2), elephant(0.9, 0.4, 0.8, 0.3), elephant(1.7, -0.1, 0.7, -1.2), giraffe(2.2, 0.5, 0.8, 0.5), acacia(0.5, -0.3, 0.9), acacia(2.4, -0.4, 0.8));
    g.add(pool([[0.2, 0.9], [1.4, 0.8], [1.6, 1.3], [0.4, 1.35]], 0.02, false), hippo(0.8, 1.1, 0.7, 0.4));
    for (const [x, z, h] of [[2.9, -0.9, 1.3], [3.15, 0.9, 1.5]]) { g.add(arcWall(0.32, 0, TAU, h, MAT.mesh, 0, { density: 4 }).translateX(x).translateZ(z)); g.add(cyl(0.34, 0.34, 0.05, MAT.white, x, h, z, 24)); g.add(treeAt(x, z, 1.2, 1)); }
    g.add(disc(0.45, MAT.lawn, -2.9, 0.02, 1.1, 24), fenceRing(0.46, 0.25, -2.9, 1.1), gorilla(-2.9, 1.1, 0.8, 0.5), gorilla(-3.15, 0.95, 0.6, 2));
    const t = []; for (let i = 0; i < 12; i++) t.push([-3.3 + hash(i, 1, 99) * 6.6, -1.4 + hash(i, 2, 99) * 0.35, 0.4 + hash(i, 3, 99) * 0.3]); g.add(trees(t, 99)); return g; },
  holding: () => { const g = grp(base(7, 3, MAT.lawn));
    g.add(arcBuilding({ r0: 1.3, r1: 1.75, a0: 0.15, a1: TAU - 0.15, floors: 3, step: 0.06, cx: 0.3, cz: -0.2 }), disc(1.2, MAT.water, 0.3, 0.02, -0.2, 40));
    for (const [x, z, r] of [[-2.9, -0.7, 0.55], [-2.2, -1.0, 0.5], [-2.6, 0.2, 0.5]]) { g.add(cyl(0.05, 0.07, 1.1, MAT.white, x, 0, z, 8)); g.add(cyl(r, r * 0.9, 0.05, MAT.solar, x, 1.1, z, 24)); }
    g.add(arcBuilding({ r0: 0.8, r1: 1.2, a0: PI * 0.9, a1: PI * 1.9, floors: 2, step: 0.12, cx: -2.5, cz: 0.5, lit: false }));
    g.add(labArc(1.1, 1.6, PI * 1.1, PI * 1.9, 2.2, 1.6, 2)); g.add(plane(1.6, 1.0, MAT.sand, 2.6, 0.02, -0.6), elephant(2.4, -0.6, 0.6, 0.4), giraffe(3.0, -0.8, 0.6, 2));
    g.add(disc(0.4, MAT.lawn, 3.0, 0.02, 1.1, 24), fenceRing(0.41, 0.22, 3.0, 1.1), gorilla(3.0, 1.1, 0.7, 0.4));
    const t = []; for (let i = 0; i < 10; i++) t.push([-3.3 + hash(i, 1, 100) * 6.6, 1.05 + hash(i, 2, 100) * 0.35, 0.4 + hash(i, 3, 100) * 0.3]); g.add(trees(t, 100)); return g; },
  held: () => { const g = grp(base(7, 3, MAT.lawn));
    g.add(arcBuilding({ r0: 1.15, r1: 1.6, a0: PI * 0.95, a1: PI * 2.05, floors: 3, step: 0.1, cx: -2.2, cz: 0.2 }), plane(0.9, 0.55, MAT.field, -2.2, 0.03, 0.25), playground(-1.6, -0.5));
    const ed3 = MODEL.edu3(); ed3.position.set(0.6, 0, 0.3); ed3.scale.set(0.95, 0.95, 0.95); g.add(ed3);
    const nano = MODEL.loja5(); nano.position.set(-0.6, 0, -0.95); nano.scale.set(0.6, 0.8, 0.6); g.add(nano);
    g.add(domeGeo(0.6, { cx: 2.6, cz: -0.1 }), disc(0.52, MAT.water, 2.6, 0.02, -0.1, 32));
    const pit = MODEL.fab1(); pit.position.set(0.3, 0, 1.05); pit.scale.set(0.55, 0.7, 0.55); g.add(pit);
    g.add(plane(1.4, 0.8, MAT.sand, 2.5, 0.02, 0.85), elephant(2.3, 0.85, 0.55, 0.5), giraffe(2.9, 0.7, 0.55, 2.2));
    g.add(disc(0.35, MAT.lawn, 3.05, 0.02, -1.0, 20), fenceRing(0.36, 0.2, 3.05, -1.0), gorilla(3.05, -1.0, 0.6, 0.5));
    g.add(arcBuilding({ r0: 0.9, r1: 1.2, a0: PI * 1.05, a1: PI * 1.6, floors: 2, step: 0.08, cx: 1.9, cz: -1.5, lit: false }));
    const t = []; for (let i = 0; i < 14; i++) t.push([-3.3 + hash(i, 1, 101) * 6.6, -1.4 + hash(i, 2, 101) * 0.3, 0.35 + hash(i, 3, 101) * 0.3]); g.add(trees(t, 101)); return g; },
};
// laboratório em arco aberto por cima (vê-se o interior)
function labArc(r0, r1, a0, a1, cx, cz, floors = 2, halfRoof = false) {
  const g = new T3.Group();
  for (let i = 0; i < floors; i++) {
    const y = i * FH; g.add(extrudeY(ringShape(r0, r1, a0, a1), 0.06, MAT.white, y));
    const last = i === floors - 1;
    g.add(arcWall(r1 - 0.015, a0, a1, last ? FH * 0.55 : FH - 0.06, last ? MAT.white : MAT.win, y + 0.06));
    g.add(arcWall(r0 + 0.015, a0, a1, last ? FH * 0.55 : FH - 0.06, MAT.whitePlain, y + 0.06, { inward: true }));
    if (last) {
      const n = Math.round((a1 - a0) * (r0 + r1) / 2 / 0.35);
      for (let k = 0; k < n; k++) { const a = a0 + (a1 - a0) * (k + 0.5) / n; const rr2 = (r0 + r1) / 2 + (hash(k, 1, 7) - 0.5) * (r1 - r0) * 0.5; const x = Math.cos(a) * rr2, z = Math.sin(a) * rr2; const mm = k % 3 === 0 ? MAT.blue : k % 3 === 1 ? MAT.steel : MAT.whitePlain; const b = box(0.14, 0.1 + hash(k, 2, 7) * 0.12, 0.12, mm, x, y + 0.06, z); b.rotation.y = -a; g.add(b); if (k % 4 === 0) { const wl = box(0.02, FH * 0.5, r1 - r0 - 0.08, MAT.whitePlain, Math.cos(a) * (r0 + r1) / 2, y + 0.06, Math.sin(a) * (r0 + r1) / 2); wl.rotation.y = -a; g.add(wl); } }
      const lit = extrudeY(ringShape(r0 + 0.02, r1 - 0.02, a0, a1), 0.01, MAT.lit, y + 0.062); lit.castShadow = false; g.add(lit);
      if (halfRoof) g.add(extrudeY(ringShape(r0, r1, a0, a0 + (a1 - a0) * 0.45), 0.05, MAT.roof, y + FH * 0.55 + 0.06));
    }
  }
  g.position.set(cx, 0, cz); return g;
}
function amphi(cx, cz, s) {
  const g = new T3.Group(); const steps = 5;
  for (let i = 0; i < steps; i++) { const r1 = (0.35 + i * 0.14) * s, r0 = i === 0 ? 0.1 * s : (0.35 + (i - 1) * 0.14) * s; const h = (0.05 + i * 0.045) * s; g.add(extrudeY(ringShape(r0, r1, PI * 0.15, PI * 0.85), h, i % 2 ? MAT.roof : MAT.white, 0)); }
  g.add(disc(0.34 * s, MAT.pave, 0, 0.015, 0, 24)); g.position.set(cx, 0, cz); return g;
}

/* ---------------- fabricação, cache e instâncias ---------------- */
function bake(g) {
  // mescla malhas por material (menos draw calls); mantém linhas e peças animadas
  g.updateMatrixWorld(true); const byMat = new Map(); const remove = [];
  g.traverse(o => {
    if (!o.isMesh || o.userData.keep) return; let p = o; let keep = false; while (p && p !== g) { if (p.userData.keep) keep = true; p = p.parent; } if (keep) return;
    const key = o.material.uuid; if (!byMat.has(key)) byMat.set(key, { mat: o.material, list: [], shadow: o.castShadow });
    const rel = new T3.Matrix4().copy(o.matrixWorld).premultiply(new T3.Matrix4().copy(g.matrixWorld).invert());
    byMat.get(key).list.push({ geo: o.geometry, matrix: rel }); remove.push(o);
  });
  for (const o of remove) o.parent.remove(o);
  // limpa grupos vazios
  const prune = (n) => { for (const c of n.children.slice()) { prune(c); if (c.isGroup && !c.children.length) n.remove(c); } }; prune(g);
  for (const { mat, list, shadow } of byMat.values()) { const m = new T3.Mesh(mergeGeos(list), mat); m.castShadow = shadow; m.receiveShadow = true; g.add(m); }
  return g;
}
const PROTO = new Map();   // chave -> { g, h, bb }
function modelKey(b, lvl) { const t = TYPES[b.t]; return t.res ? RES_STAGES[(lvl || b.lvl) - 1].img : t.img; }
function protoFor(key, t) {
  if (!PROTO.has(key)) {
    const gen = MODEL[key]; const g = gen ? gen() : grp(box(1, 0.5, 1, MAT.gray)); bake(g);
    let bb = new T3.Box3().setFromObject(g);
    if (t) {
      // encaixa no lote (com folga de 0,1 por lado), mantendo as proporções, e centraliza
      const sx = (t.w + 0.2) / Math.max(0.01, bb.max.x - bb.min.x), sz = (t.h + 0.2) / Math.max(0.01, bb.max.z - bb.min.z);
      const s = Math.min(1, sx, sz);
      const wrap = new T3.Group(); wrap.add(g); g.scale.setScalar(s);
      g.position.set(-(bb.max.x + bb.min.x) / 2 * s, 0, -(bb.max.z + bb.min.z) / 2 * s);
      bb = new T3.Box3().setFromObject(wrap);
      PROTO.set(key, { g: wrap, h: Math.max(0.3, bb.max.y), bb, bbB: buildingBox(wrap, bb) });
    } else PROTO.set(key, { g, h: Math.max(0.3, bb.max.y), bb, bbB: buildingBox(g, bb) });
  }
  return PROTO.get(key);
}
// caixa só das partes "edifício" (ignora chão, água, vegetação e animais) — usada pelo canteiro de obras
function buildingBox(root, bb) {
  const skip = new Set([MAT.leaf, MAT.trunk, MAT.water, MAT.lawn, MAT.pave, MAT.sand, MAT.field, MAT.dirt, MAT.grass, MAT.mesh, MAT.rock, MAT.animal, MAT.animalDark, MAT.giraffe, MAT.curb, MAT.asphaltLight, MAT.paintW]);
  const out = new T3.Box3(); let any = false;
  root.traverse(o => { if (o.isMesh && !skip.has(o.material)) { const b = new T3.Box3().setFromObject(o); if (b.max.y - b.min.y > 0.25) { out.union(b); any = true; } } });
  return any ? out : bb.clone();
}
function instanceFor(key, t) {
  const p = protoFor(key, t); const c = p.g.clone(true); const spins = [];
  c.traverse(o => { if (o.userData.spin) spins.push(o); });
  c.userData = { h: p.h, bb: p.bb, bbB: p.bbB, key, spins };
  return c;
}
function placeGroup(g, b) { const t = TYPES[b.t]; g.position.set(b.x + t.w / 2, 0, b.y + t.h / 2); }
