/* =========================================================
   05d · canteiro de obras em 3D: operários, máquinas, guindaste, andaime,
        prédio subindo andar por andar (plano de corte)
   ========================================================= */
const VEST_MATS = [MAT.orange, MAT.yellow, MAT.blue, MAT.red];
function workerFig(vest) {
  const g = new T3.Group(); const s = 1;
  const legL = cyl(0.022, 0.028, 0.14, MAT.dark, -0.03, 0, 0, 6), legR = cyl(0.022, 0.028, 0.14, MAT.dark, 0.03, 0, 0, 6);
  legL.geometry.translate(0, -0.07, 0); legR.geometry.translate(0, -0.07, 0); legL.position.y = 0.14; legR.position.y = 0.14; // pivô no quadril
  const torso = box(0.11, 0.14, 0.07, vest, 0, 0.14, 0);
  const head = sph(0.042, MAT.skin, 0, 0.32, 0); const hat = new T3.Mesh(new T3.SphereGeometry(0.05, 10, 6, 0, TAU, 0, PI / 2), MAT.yellow); hat.position.y = 0.325; hat.castShadow = false;
  const armL = cyl(0.014, 0.016, 0.12, MAT.skin, -0.07, 0, 0, 5), armR = cyl(0.014, 0.016, 0.12, MAT.skin, 0.07, 0, 0, 5);
  armL.geometry.translate(0, -0.06, 0); armR.geometry.translate(0, -0.06, 0); armL.position.y = 0.27; armR.position.y = 0.27;
  const tool = box(0.05, 0.02, 0.02, MAT.steel, 0, -0.12, 0); armR.add(tool);
  g.add(legL, legR, torso, head, hat, armL, armR); g.scale.set(s, s, s);
  g.userData.parts = { legL, legR, armL, armR, tool };
  return g;
}
function craneRig(reach) {
  const g = new T3.Group(); const mast = box(0.08, 1, 0.08, MAT.yellow, 0, 0, 0); mast.geometry.translate(0, 0.5, 0); mast.position.y = 0;
  const top = new T3.Group(); const jib = box(reach, 0.05, 0.06, MAT.yellow, reach / 2 - 0.15, 0, 0); const counter = box(0.35, 0.06, 0.08, MAT.dark, -0.3, 0, 0);
  const cab = box(0.12, 0.1, 0.1, MAT.orange, 0, -0.1, 0); const trolley = new T3.Group(); trolley.position.x = reach * 0.6;
  const cable = box(0.012, 1, 0.012, MAT.dark, 0, 0, 0); cable.geometry.translate(0, -0.5, 0); const hook = box(0.16, 0.05, 0.12, MAT.gray, 0, -1, 0); trolley.add(cable, hook);
  top.add(jib, counter, cab, trolley); g.add(mast, top); g.userData = { mast, top, trolley, cable, hook };
  return g;
}
function mixerRig() {
  const g = new T3.Group(); g.add(box(0.5, 0.06, 0.22, MAT.dark, 0, 0.06, 0)); g.add(box(0.16, 0.16, 0.2, MAT.orange, 0.2, 0.12, 0)); g.add(box(0.12, 0.06, 0.16, MAT.glass, 0.2, 0.2, 0));
  const drum = cyl(0.11, 0.08, 0.28, MAT.curb, 0, 0, 0, 12); drum.geometry.translate(0, 0, 0); drum.rotation.z = 1.25; drum.position.set(-0.08, 0.24, 0);
  const stripe = box(0.02, 0.3, 0.02, MAT.orange, 0, 0, 0); stripe.position.set(0.1, 0, 0); drum.add(stripe);
  g.add(drum); for (const [x, z] of [[-0.18, 0.1], [-0.18, -0.1], [0.14, 0.1], [0.14, -0.1]]) { const w = cyl(0.05, 0.05, 0.04, MAT.dark, x, 0.03, z, 8); w.rotation.x = PI / 2; g.add(w); }
  g.userData.drum = drum; return g;
}
function dozerRig() {
  const g = new T3.Group(); g.add(box(0.3, 0.14, 0.2, MAT.yellow, 0, 0.06, 0), box(0.12, 0.1, 0.14, MAT.dark, -0.05, 0.2, 0), box(0.04, 0.16, 0.26, MAT.gray, 0.2, 0.02, 0));
  g.add(box(0.3, 0.06, 0.05, MAT.dark, 0, 0, 0.11), box(0.3, 0.06, 0.05, MAT.dark, 0, 0, -0.11)); return g;
}
function scaffoldRig(w, d) {
  // postes a cada 0,5, travessas em quatro alturas e diagonais, escalado em Y pela altura
  const pts = []; const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  for (let s = 0; s < 4; s++) {
    const [x0, z0] = corners[s], [x1, z1] = corners[(s + 1) % 4]; const len = Math.hypot(x1 - x0, z1 - z0); const n = Math.max(1, Math.round(len / 0.5));
    for (let i = 0; i <= n; i++) { const t = i / n; const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; pts.push(x, 0, z, x, 1, z); }
    for (const y of [0.02, 0.34, 0.67, 1]) pts.push(x0, y, z0, x1, y, z1);
    for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n; pts.push(x0 + (x1 - x0) * t0, 0.34, z0 + (z1 - z0) * t0, x0 + (x1 - x0) * t1, 0.67, z0 + (z1 - z0) * t1); }
  }
  const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.Float32BufferAttribute(pts, 3));
  return new T3.LineSegments(g, MAT.scaffold);
}
function frameRig(w, d) {
  const g = new T3.Group(); const nx = Math.max(2, Math.round(w / 0.8)), nz = Math.max(1, Math.round(d / 0.8));
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) { const c = box(0.03, 1, 0.03, MAT.frame, -w / 2 + w * i / nx, 0, -d / 2 + d * j / nz); c.geometry.translate(0, 0.5, 0); c.position.y = 0; g.add(c); }
  const beams = new T3.Group();
  for (let j = 0; j <= nz; j++) beams.add(box(w, 0.03, 0.03, MAT.frame, 0, 0, -d / 2 + d * j / nz));
  for (let i = 0; i <= nx; i++) beams.add(box(0.03, 0.03, d, MAT.frame, -w / 2 + w * i / nx, 0, 0));
  g.add(beams); g.userData.beams = beams; return g;
}
function siteCreate(rec, b, upgrade) {
  const t = TYPES[b.t]; const w = t.w, d = t.h;
  const site = { upgrade, group: new T3.Group(), workers: [], lastFloor: -1, floorAt: 0, floorH: FH, h: 1 };
  const g = site.group; g.position.set(b.x + w / 2, 0, b.y + d / 2);
  if (!upgrade) {
    const dirt = plane(w - 0.1, d - 0.1, MAT.dirt, 0, 0.03, 0); site.dirt = dirt; g.add(dirt);
    const slab = box(w - 0.3, 0.05, d - 0.3, MAT.curb, 0, 0.03, 0); slab.scale.x = 0.001; site.slab = slab; g.add(slab);
    for (const [x, z] of [[-w / 2 + 0.1, -d / 2 + 0.1], [w / 2 - 0.1, -d / 2 + 0.1], [w / 2 - 0.1, d / 2 - 0.1], [-w / 2 + 0.1, d / 2 - 0.1]]) g.add(cyl(0.015, 0.015, 0.2, MAT.woodLight, x, 0, z, 5));
    g.add(new T3.Mesh(new T3.ConeGeometry(0.04, 0.1, 6), MAT.orange).translateX(-w / 2 + 0.25).translateY(0.08).translateZ(d / 2 - 0.15));
    const sign = box(0.3, 0.16, 0.02, MAT.stripes, w / 2 - 0.3, 0.16, d / 2 + 0.02); g.add(sign, cyl(0.01, 0.01, 0.16, MAT.dark, w / 2 - 0.3, 0, d / 2 + 0.02, 4));
    site.dozer = dozerRig(); g.add(site.dozer);
    site.mixer = mixerRig(); site.mixer.position.set(-w / 2 + 0.35, 0.03, d / 2 - 0.2); site.mixer.rotation.y = 0.3; site.mixer.visible = false; g.add(site.mixer);
  }
  const model0 = upgrade ? rec.upGroup : rec.group; const bb = model0.userData.bbB || model0.userData.bb;
  const sw = bb ? clamp(bb.max.x - bb.min.x + 0.12, 0.6, w) : w - 0.15, sd = bb ? clamp(bb.max.z - bb.min.z + 0.12, 0.6, d) : d - 0.15;
  const scx = bb ? (bb.max.x + bb.min.x) / 2 : 0, scz = bb ? (bb.max.z + bb.min.z) / 2 : 0;
  site.crane = craneRig(Math.max(0.9, sw * 0.8)); site.crane.position.set(scx + sw / 2 + 0.12, 0, scz + sd / 2 + 0.12); site.crane.visible = false; g.add(site.crane);
  site.scaffold = scaffoldRig(sw, sd); site.scaffold.position.set(scx, 0, scz); site.scaffold.visible = false; g.add(site.scaffold);
  site.frame = frameRig(sw - 0.16, sd - 0.16); site.frame.position.set(scx, 0, scz); site.frame.visible = false; g.add(site.frame);
  const nW = upgrade ? 3 : 4;
  for (let i = 0; i < nW; i++) { const f = workerFig(VEST_MATS[(i + b.id) % 4]); f.userData.anim = { ph: hash(i, b.id, 91) * TAU, sp: 0.6 + hash(i, b.id, 92) * 0.5, act: ['walk', 'carry', 'hammer', 'weld'][i % 4], x0: (hash(i, b.id, 93) - 0.5) * (w - 0.6), rng: 0.25 + hash(i, b.id, 94) * (w * 0.3) }; g.add(f); site.workers.push(f); }
  fxRoot.add(g);
  // materiais clonados com plano de corte para o modelo que sobe
  site.plane = new T3.Plane(V3(0, -1, 0), 0);
  const model = upgrade ? rec.upGroup : rec.group; site.model = model; site.mats = [];
  model.traverse(o => { if (o.isMesh) { const m = o.material.clone(); m.clippingPlanes = [site.plane]; m.clipShadows = true; site.mats.push([o, o.material, m]); o.material = m; } });
  site.h = model.userData.h || 1; site.K = clamp(Math.round(site.h / FH), 3, 10); site.floorH = site.h / site.K;
  return site;
}
function siteRemove(site) {
  if (!site) return; fxRoot.remove(site.group);
  for (const [o, orig, cl] of site.mats) { o.material = orig; cl.dispose(); }
  site.group.traverse(o => { if (o.geometry && o.userData.own) o.geometry.dispose(); });
}
function siteUpdate(site, b, now, out) {
  const t = TYPES[b.t]; const w = t.w, d = t.h; const f = 1 - b.b / b.tt; const ts = now / 1000;
  const c = site.upgrade ? clamp(f / 0.9, 0, 1) : clamp((f - 0.3) / 0.6, 0, 1);
  const K = site.K, fh = site.floorH; const p = c * K; const built = Math.min(K, Math.floor(p)); const q = p - built;
  const finishing = f >= 0.9; const dd = finishing ? clamp((f - 0.9) / 0.1, 0, 1) : 0;
  const phaseA = !site.upgrade && f < 0.18, phaseB = !site.upgrade && f >= 0.18 && f < 0.3, phaseC = !phaseA && !phaseB && !finishing;
  // altura visível do prédio (plano de corte)
  let visH = built * fh; if (phaseC && q >= 0.35) visH += fh * clamp((q - 0.35) / 0.5, 0, 1); if (finishing) visH = site.h + 1;
  site.plane.constant = visH + 0.001; site.model.visible = !(phaseA || phaseB) || site.upgrade;
  if (site.lastFloor >= 0 && built > site.lastFloor && !quiet) out.dust.push([b.x + w / 2, built * fh, b.y + d / 2, w]);
  site.lastFloor = built;
  if (site.slab) { site.slab.scale.x = clamp((f - 0.14) / 0.14, 0.001, 1); site.slab.visible = f >= 0.14; site.dirt.visible = !finishing; }
  if (site.dozer) { site.dozer.visible = phaseA; const u = Math.sin(ts * 0.9 + b.id); site.dozer.position.set(u * (w / 2 - 0.35), 0.03, 0.1); site.dozer.rotation.y = Math.cos(ts * 0.9 + b.id) > 0 ? 0 : PI; }
  if (site.mixer) { site.mixer.visible = phaseB || phaseC; site.mixer.userData.drum.rotation.y = ts * 2.2; }
  // guindaste sobe com a obra
  const cr = site.crane; cr.visible = phaseB || phaseC || finishing; const mastH = Math.max(1.2, visH + 1.1); cr.userData.mast.scale.y = mastH; cr.userData.top.position.y = mastH; cr.userData.top.rotation.y = Math.sin(ts * 0.35 + b.id) * 0.9 - 0.6;
  const u = 0.5 + 0.5 * Math.sin(ts * 0.8); const hookDrop = 0.15 + (mastH - 0.1 - Math.min(visH, site.h)) * u; cr.userData.cable.scale.y = hookDrop; cr.userData.hook.position.y = -hookDrop;
  if (finishing) { cr.scale.setScalar(1 - dd * 0.999); }
  // andaime nos andares de cima
  const sc = site.scaffold; sc.visible = phaseC || finishing; const scH = phaseC ? Math.min(site.h, built * fh + fh * 1.5) : site.h; sc.scale.y = Math.max(0.05, scH); sc.position.y = 0; sc.material.opacity = finishing ? 0.8 * (1 - dd) : 0.8;
  // esqueleto de aço do andar em obra
  const fr = site.frame; fr.visible = phaseC && built < K && q < 0.7;
  if (fr.visible) { const grow = clamp(q / 0.35, 0.02, 1); fr.position.y = built * fh; fr.children.forEach(ch => { if (ch !== fr.userData.beams) ch.scale.y = fh * grow; }); fr.userData.beams.position.y = fh * grow; fr.userData.beams.visible = q > 0.25; }
  // operários
  const floorY = built * fh; const alpha = finishing ? 1 - dd : 1;
  site.workers.forEach((wk, i) => {
    const a = wk.userData.anim; const P = wk.userData.parts; wk.visible = alpha > 0.05;
    let act = a.act; if (phaseA) act = i % 2 ? 'walk' : 'shovel'; if (phaseB) act = i % 2 ? 'walk' : 'hammer';
    const onFloor = phaseC && i >= 2 && built < K; const tt = ts * a.sp + a.ph;
    if (act === 'walk' || act === 'carry') { const x = a.x0 + Math.sin(tt) * a.rng; const dir = Math.cos(tt) >= 0 ? 1 : -1; wk.position.set(x, onFloor ? floorY : 0.03, onFloor ? (hash(i, b.id, 95) - 0.5) * (d - 0.8) : d / 2 - 0.25); wk.rotation.y = dir > 0 ? PI / 2 : -PI / 2;
      const sw = Math.sin(tt * 6) * 0.6; P.legL.rotation.x = sw; P.legR.rotation.x = -sw; P.armL.rotation.x = act === 'carry' ? -2.6 : -sw; P.armR.rotation.x = act === 'carry' ? -2.6 : sw; wk.position.y += Math.abs(Math.sin(tt * 6)) * 0.015; }
    else { wk.position.set(a.x0 * 0.8, onFloor ? floorY : 0.03, onFloor ? (hash(i, b.id, 96) - 0.5) * (d - 0.8) : d / 2 - 0.3); wk.rotation.y = a.ph; P.legL.rotation.x = 0; P.legR.rotation.x = 0;
      if (act === 'hammer') { P.armR.rotation.x = -1.2 - Math.max(0, Math.sin(tt * 7)) * 1.4; P.armL.rotation.x = -0.4; }
      else if (act === 'weld') { P.armR.rotation.x = -1.4; P.armL.rotation.x = -0.9; if (!quiet && phaseC && Math.random() < 0.3) out.sparks.push([b.x + w / 2 + wk.position.x + Math.sin(wk.rotation.y) * 0.2, wk.position.y + 0.22, b.y + d / 2 + wk.position.z + Math.cos(wk.rotation.y) * 0.2]); }
      else { P.armR.rotation.x = -0.6 + Math.sin(tt * 3) * 0.6; P.armL.rotation.x = -0.6 + Math.sin(tt * 3 + 1) * 0.6; } }
  });
  return { built, K, f, phaseA, phaseB, finishing };
}
