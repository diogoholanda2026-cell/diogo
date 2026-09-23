/* =========================================================
   05a · materiais: texturas procedurais, materiais e utilidades de geometria
   ========================================================= */
const T3 = THREE;
const V3 = (x, y, z) => new T3.Vector3(x, y, z);

/* ---------------- texturas desenhadas em canvas ---------------- */
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  draw(g, w, h);
  const t = new T3.CanvasTexture(c);
  t.wrapS = t.wrapT = T3.RepeatWrapping; t.colorSpace = T3.SRGBColorSpace;
  t.anisotropy = 4; if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  if (opts.nearest) { t.magFilter = T3.NearestFilter; }
  return t;
}
function noiseFill(g, w, h, base, amp, seed, cell = 3) {
  for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
    const n = (vnoise(x, y, 18, seed) * 0.6 + hash(x, y, seed + 1) * 0.4 - 0.5) * amp;
    g.fillStyle = `rgb(${clamp(base[0] + n, 0, 255) | 0},${clamp(base[1] + n * 1.1, 0, 255) | 0},${clamp(base[2] + n * 0.8, 0, 255) | 0})`;
    g.fillRect(x, y, cell, cell);
  }
}
const TEX = {};
function makeTextures() {
  // janelas: vidro escuro com faixas iluminadas (usado como mapa e emissivo)
  TEX.win = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#1B2436'; g.fillRect(0, 0, w, h);
    const cols = 8, rows = 1; const cw = w / cols;
    for (let i = 0; i < cols; i++) {
      const lit = hash(i, 3, 77) < 0.62;
      g.fillStyle = lit ? (hash(i, 4, 77) < 0.5 ? '#FFD9A0' : '#FFE8C2') : '#24304A';
      g.fillRect(i * cw + 3, 8, cw - 6, h - 16);
      if (lit) { g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(i * cw + 3, 8, cw - 6, 6); }
    }
    g.fillStyle = '#E8E6DE'; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6);
    g.fillStyle = 'rgba(232,230,222,.55)'; for (let i = 0; i <= cols; i++) g.fillRect(i * cw - 1, 0, 2, h);
  });
  TEX.winDark = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#141B2A'; g.fillRect(0, 0, w, h);
    const cols = 10; const cw = w / cols;
    for (let i = 0; i < cols; i++) { const lit = hash(i, 5, 79) < 0.35; g.fillStyle = lit ? '#FFD08A' : '#1E2A40'; g.fillRect(i * cw + 2, 6, cw - 4, h - 12); }
    g.fillStyle = '#B9C2CC'; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
  });
  TEX.roof = canvasTex(128, 128, (g, w, h) => noiseFill(g, w, h, [70, 122, 60], 32, 21, 2));
  TEX.grass = canvasTex(256, 256, (g, w, h) => { noiseFill(g, w, h, [84, 136, 66], 28, 31, 2); g.fillStyle = 'rgba(20,50,20,.25)'; for (let i = 0; i < 900; i++) { const x = hash(i, 1, 33) * w, y = hash(i, 2, 33) * h; g.fillRect(x, y, 1 + hash(i, 3, 33) * 3, 1); } });
  TEX.sand = canvasTex(128, 128, (g, w, h) => noiseFill(g, w, h, [196, 176, 130], 22, 41, 2));
  TEX.pave = canvasTex(128, 128, (g, w, h) => { noiseFill(g, w, h, [176, 172, 168], 12, 51, 2); g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); } });
  TEX.concrete = canvasTex(128, 128, (g, w, h) => noiseFill(g, w, h, [226, 224, 216], 10, 61, 2));
  TEX.wood = canvasTex(256, 64, (g, w, h) => { noiseFill(g, w, h, [96, 62, 36], 26, 71, 2); g.fillStyle = 'rgba(40,20,8,.3)'; for (let i = 0; i < 40; i++) { const y = hash(i, 1, 72) * h; g.fillRect(0, y, w, 1 + hash(i, 2, 72) * 2); } });
  TEX.solar = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#1C2C4E'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8FA6C8'; g.lineWidth = 2; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16, h); g.moveTo(0, i * 16); g.lineTo(w, i * 16); g.stroke(); } g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 0, w, h / 2); });
  TEX.dirt = canvasTex(128, 128, (g, w, h) => noiseFill(g, w, h, [92, 74, 54], 28, 81, 2));
  TEX.field = canvasTex(256, 160, (g, w, h) => {
    noiseFill(g, w, h, [66, 128, 60], 16, 91, 2);
    g.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < 8; i += 2) g.fillRect(i * 32, 0, 32, h);
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.strokeRect(10, 10, w - 20, h - 20);
    g.beginPath(); g.moveTo(w / 2, 10); g.lineTo(w / 2, h - 10); g.stroke(); g.beginPath(); g.arc(w / 2, h / 2, 22, 0, TAU); g.stroke();
    g.strokeRect(10, h / 2 - 30, 34, 60); g.strokeRect(w - 44, h / 2 - 30, 34, 60);
  });
  TEX.water = canvasTex(256, 256, (g, w, h) => { noiseFill(g, w, h, [40, 120, 150], 30, 101, 2); g.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 200; i++) { const x = hash(i, 1, 102) * w, y = hash(i, 2, 102) * h; g.fillRect(x, y, 6 + hash(i, 3, 102) * 14, 1); } });
  TEX.mesh = canvasTex(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(230,230,235,.9)'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16, h); g.moveTo(0, i * 16); g.lineTo(w, i * 16); g.stroke(); } });
  TEX.lattice = canvasTex(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = '#C9A55A'; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16, h); g.moveTo(0, i * 16); g.lineTo(w, i * 16); g.stroke(); } g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke(); });
  TEX.stripes = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#F2F2F2'; g.fillRect(0, 0, w, h); g.fillStyle = '#F08A3C'; for (let i = -1; i < 5; i++) { g.beginPath(); g.moveTo(i * 24, h); g.lineTo(i * 24 + 12, h); g.lineTo(i * 24 + 12 + h, 0); g.lineTo(i * 24 + h, 0); g.closePath(); g.fill(); } });
}

/* ---------------- materiais compartilhados ---------------- */
const MAT = {};
function makeMaterials() {
  const std = (o) => new T3.MeshStandardMaterial(o);
  MAT.white = std({ color: 0xF2F0EA, roughness: 0.85, metalness: 0.02, map: TEX.concrete });
  MAT.whitePlain = std({ color: 0xEDEBE4, roughness: 0.8 });
  MAT.win = std({ color: 0xffffff, map: TEX.win, emissive: 0xFFD9A0, emissiveMap: TEX.win, emissiveIntensity: 0.85, roughness: 0.35, metalness: 0.25 });
  MAT.winDark = std({ color: 0xffffff, map: TEX.winDark, emissive: 0xFFC97A, emissiveMap: TEX.winDark, emissiveIntensity: 0.7, roughness: 0.35, metalness: 0.25 });
  MAT.glass = std({ color: 0x9FD9F2, transparent: true, opacity: 0.32, roughness: 0.08, metalness: 0.4, side: T3.DoubleSide, depthWrite: false, emissive: 0x1E3A55, emissiveIntensity: 0.25 });
  MAT.glassWarm = std({ color: 0xFFE2B0, transparent: true, opacity: 0.4, roughness: 0.1, metalness: 0.3, side: T3.DoubleSide, depthWrite: false, emissive: 0xFFC46B, emissiveIntensity: 0.45 });
  MAT.roof = std({ color: 0xffffff, map: TEX.roof, roughness: 0.95 });
  MAT.grass = std({ color: 0xffffff, map: TEX.grass, roughness: 0.95, vertexColors: true });
  MAT.lawn = std({ color: 0x6DB864, map: TEX.roof, roughness: 0.95 });
  MAT.sand = std({ color: 0xffffff, map: TEX.sand, roughness: 1 });
  MAT.pave = std({ color: 0xffffff, map: TEX.pave, roughness: 0.9 });
  MAT.field = std({ color: 0xffffff, map: TEX.field, roughness: 0.95 });
  MAT.dirt = std({ color: 0xffffff, map: TEX.dirt, roughness: 1 });
  MAT.water = std({ color: 0xffffff, map: TEX.water, transparent: true, opacity: 0.86, roughness: 0.12, metalness: 0.35, emissive: 0x0E3F55, emissiveIntensity: 0.4 });
  MAT.wood = std({ color: 0xffffff, map: TEX.wood, roughness: 0.8 });
  MAT.woodLight = std({ color: 0xC9A063, roughness: 0.7 });
  MAT.steel = std({ color: 0x8B95A5, roughness: 0.45, metalness: 0.7 });
  MAT.dark = std({ color: 0x2A303B, roughness: 0.7 });
  MAT.asphalt = std({ color: 0x2E333D, roughness: 0.92 });
  MAT.asphaltLight = std({ color: 0x3A4150, roughness: 0.9 });
  MAT.curb = std({ color: 0xA9ADB6, roughness: 0.85 });
  MAT.paintW = std({ color: 0xECE7DA, roughness: 0.8, emissive: 0x777066, emissiveIntensity: 0.25 });
  MAT.paintY = std({ color: 0xE8C25A, roughness: 0.8, emissive: 0x8A6A1A, emissiveIntensity: 0.3 });
  MAT.solar = std({ color: 0xffffff, map: TEX.solar, roughness: 0.3, metalness: 0.5 });
  MAT.brass = std({ color: 0xC9A55A, roughness: 0.35, metalness: 0.8 });
  MAT.mesh = std({ color: 0xffffff, map: TEX.mesh, transparent: true, alphaTest: 0.3, side: T3.DoubleSide, roughness: 0.6 });
  MAT.lattice = std({ color: 0xffffff, map: TEX.lattice, transparent: true, alphaTest: 0.3, side: T3.DoubleSide, roughness: 0.7 });
  MAT.stripes = std({ color: 0xffffff, map: TEX.stripes, roughness: 0.8 });
  MAT.yellow = std({ color: 0xF2C230, roughness: 0.6 });
  MAT.orange = std({ color: 0xF08A3C, roughness: 0.6 });
  MAT.red = std({ color: 0xE0533F, roughness: 0.6 });
  MAT.skin = std({ color: 0xE8C39E, roughness: 0.8 });
  MAT.blue = std({ color: 0x3E7BD1, roughness: 0.6 });
  MAT.gray = std({ color: 0x8E8E92, roughness: 0.85 });
  MAT.rock = std({ color: 0x8A7A66, roughness: 1 });
  MAT.animal = std({ color: 0x7A7470, roughness: 0.9 });
  MAT.animalDark = std({ color: 0x2B2622, roughness: 0.95 });
  MAT.giraffe = std({ color: 0xD9A650, roughness: 0.9 });
  MAT.leaf = std({ color: 0xffffff, roughness: 0.9, vertexColors: true });
  MAT.trunk = std({ color: 0x5A3E28, roughness: 0.95 });
  MAT.lampGlow = new T3.MeshBasicMaterial({ color: 0xFFE3A6 });
  MAT.lit = new T3.MeshBasicMaterial({ color: 0xFFF3CF });
  MAT.aurora = null; // criado na cena
  MAT.ghostOk = new T3.MeshBasicMaterial({ color: 0x46E3B5, transparent: true, opacity: 0.45, depthWrite: false });
  MAT.ghostBad = new T3.MeshBasicMaterial({ color: 0xFF6A5C, transparent: true, opacity: 0.45, depthWrite: false });
  MAT.sel = new T3.MeshBasicMaterial({ color: 0xE8CB86, transparent: true, opacity: 0.6, depthWrite: false });
  MAT.cover = new T3.MeshBasicMaterial({ color: 0x46E3B5, transparent: true, opacity: 0.18, depthWrite: false, side: T3.DoubleSide });
  MAT.locked = new T3.MeshBasicMaterial({ color: 0x04081A, transparent: true, opacity: 0.62, depthWrite: false });
  MAT.frame = std({ color: 0xD8B45A, roughness: 0.5, metalness: 0.4 });
  MAT.scaffold = new T3.LineBasicMaterial({ color: 0xD6D3C8, transparent: true, opacity: 0.8 });
  MAT.line = new T3.LineBasicMaterial({ color: 0xE8CB86, transparent: true, opacity: 0.6 });
  MAT.edge = new T3.LineBasicMaterial({ color: 0xD9DEE8, transparent: true, opacity: 0.85 });
  MAT.edgeWood = new T3.LineBasicMaterial({ color: 0xC9A55A });
}

/* ---------------- geometria ---------------- */
function mesh(geo, mat, x = 0, y = 0, z = 0, opts = {}) {
  const m = new T3.Mesh(geo, mat); m.position.set(x, y, z);
  if (opts.rx) m.rotation.x = opts.rx; if (opts.ry) m.rotation.y = opts.ry; if (opts.rz) m.rotation.z = opts.rz;
  m.castShadow = opts.shadow !== false; m.receiveShadow = true; return m;
}
function box(w, h, d, mat, x = 0, y = 0, z = 0, opts = {}) { return mesh(new T3.BoxGeometry(w, h, d), mat, x, y + h / 2, z, opts); }
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 24, opts = {}) { return mesh(new T3.CylinderGeometry(rt, rb, h, seg), mat, x, y + h / 2, z, opts); }
function sph(r, mat, x = 0, y = 0, z = 0, opts = {}) { const m = mesh(new T3.SphereGeometry(r, 14, 10), mat, x, y, z, opts); if (opts.sx) m.scale.set(opts.sx, opts.sy || 1, opts.sz || 1); return m; }
function grp(...ch) { const g = new T3.Group(); for (const c of ch) if (c) g.add(c); return g; }
function ringShape(r0, r1, a0, a1) {
  const s = new T3.Shape();
  s.absarc(0, 0, r1, a0, a1, false);
  if (r0 > 0.001) s.absarc(0, 0, r0, a1, a0, true); else s.lineTo(0, 0);
  s.closePath(); return s;
}
function extrudeY(shape, h, mat, y = 0, opts = {}) {
  // extrusão no eixo Y (a forma é desenhada no plano XZ)
  const g = new T3.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: opts.seg || 32 });
  g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
  const m = new T3.Mesh(g, mat); m.castShadow = opts.shadow !== false; m.receiveShadow = true; return m;
}
function arcWall(r, a0, a1, h, mat, y = 0, opts = {}) {
  // parede curva com UV pelo comprimento do arco (janelas repetem certinho)
  const seg = Math.max(4, Math.round(Math.abs(a1 - a0) * r * (opts.density || 3)));
  const pos = [], nor = [], uv = [], idx = [];
  const inward = opts.inward ? -1 : 1; const uScale = opts.uScale || 1.1;
  for (let i = 0; i <= seg; i++) {
    const a = a0 + (a1 - a0) * i / seg; const cx = Math.cos(a), sz = Math.sin(a);
    const u = (Math.abs(a1 - a0) * r * i / seg) / uScale;
    pos.push(cx * r, y, sz * r, cx * r, y + h, sz * r);
    nor.push(cx * inward, 0, sz * inward, cx * inward, 0, sz * inward);
    uv.push(u, 0, u, 1);
    if (i < seg) { const k = i * 2; if (opts.inward) idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); else idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new T3.BufferGeometry();
  g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T3.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new T3.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new T3.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
function flatWall(x0, z0, x1, z1, h, mat, y = 0, uScale = 1.1) {
  // parede reta entre dois pontos, normal para a esquerda do sentido
  const len = Math.hypot(x1 - x0, z1 - z0); const nx = -(z1 - z0) / len, nz = (x1 - x0) / len;
  const pos = [x0, y, z0, x1, y, z1, x0, y + h, z0, x1, y + h, z1];
  const nor = [nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz]; const uv = [0, 0, len / uScale, 0, 0, 1, len / uScale, 1];
  const g = new T3.BufferGeometry();
  g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T3.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new T3.Float32BufferAttribute(uv, 2)); g.setIndex([0, 1, 2, 1, 3, 2]);
  const m = new T3.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
function plane(w, d, mat, x = 0, y = 0, z = 0, opts = {}) {
  const g = new T3.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2);
  if (opts.rep) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * opts.rep[0], uv.getY(i) * opts.rep[1]); }
  const m = new T3.Mesh(g, mat); m.position.set(x, y, z); m.receiveShadow = true; m.castShadow = false; return m;
}
function disc(r, mat, x = 0, y = 0, z = 0, seg = 32) { const g = new T3.CircleGeometry(r, seg); g.rotateX(-Math.PI / 2); const m = new T3.Mesh(g, mat); m.position.set(x, y, z); m.receiveShadow = true; return m; }
function edges(geo, mat, x = 0, y = 0, z = 0) { const l = new T3.LineSegments(new T3.EdgesGeometry(geo), mat); l.position.set(x, y, z); return l; }
function roundedRectShape(w, d, r) {
  const s = new T3.Shape(); const x = -w / 2, y = -d / 2; r = Math.min(r, w / 2, d / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function blobShape(pts) {
  // curva fechada suave passando por pontos [x, z]
  const s = new T3.Shape(); const n = pts.length;
  const mid = (i) => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
  let m = mid(n - 1); s.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) { const p = pts[i]; m = mid(i); s.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
  s.closePath(); return s;
}
// mescla geometrias já posicionadas (para instanciar / reduzir draw calls)
function mergeGeos(list) {
  const out = new T3.BufferGeometry(); let pos = [], nor = [], uv = [], col = [], idx = []; let off = 0; let hasCol = false;
  for (const { geo, matrix, color } of list) {
    const g = geo.index ? geo.toNonIndexed() : geo; const p = g.attributes.position; const n = g.attributes.normal; const u = g.attributes.uv; const gc = g.attributes.color;
    const v = new T3.Vector3(); const nm = new T3.Matrix3().getNormalMatrix(matrix);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix); pos.push(v.x, v.y, v.z);
      if (n) { v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z); }
      uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
      if (color) { hasCol = true; col.push(color.r, color.g, color.b); }
      else if (gc) { hasCol = true; col.push(gc.getX(i), gc.getY(i), gc.getZ(i)); }
      else col.push(1, 1, 1);
      idx.push(off + i);
    }
    off += p.count;
  }
  out.setAttribute('position', new T3.Float32BufferAttribute(pos, 3));
  if (nor.length) out.setAttribute('normal', new T3.Float32BufferAttribute(nor, 3));
  if (uv.length) out.setAttribute('uv', new T3.Float32BufferAttribute(uv, 2));
  if (hasCol) out.setAttribute('color', new T3.Float32BufferAttribute(col, 3));
  out.setIndex(idx); return out;
}
function mat4(x, y, z, ry = 0, s = 1, sy) { const m = new T3.Matrix4(); m.compose(V3(x, y, z), new T3.Quaternion().setFromEuler(new T3.Euler(0, ry, 0)), V3(s, sy == null ? s : sy, s)); return m; }
