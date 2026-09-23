/* =========================================================
   05b · cena: renderizador, câmera, céu, mesa, terreno, água, ruas, árvores, carros
   ========================================================= */
const cv = $('#map'), ctx = cv.getContext('2d');           // overlay 2D (selos, textos, barras)
const glc = $('#gl');
let vw = 0, vh = 0, dpr = 1;
let renderer = null, scene = null, camera = null, sun = null, hemi = null;
const world = new T3.Group();     // tudo que está sobre a mesa
const bldRoot = new T3.Group();   // construções
const fxRoot = new T3.Group();    // seleção, raios, fantasma
let groundMesh = null, waterMesh = null, roadGroup = null, treeMesh = null, carMesh = null, lockGroup = null, skyMesh = null, plaqueMat = null;
const anims = [];                 // objetos com update(now)
let worldDirty = true;            // ruas/árvores/terreno precisam ser reconstruídos

/* ---------------- câmera orbital estilo BuildIt ---------------- */
const cam = { x: N / 2, y: N / 2, dist: 24, rot: 0, tilt: 0.95, minDist: 7, maxDist: 80 };
function lookAtTile(x, y, dist) { cam.x = x; cam.y = y; if (dist) cam.dist = dist; clampCam(); }
function clampCam() {
  cam.dist = clamp(cam.dist, cam.minDist, cam.maxDist); cam.tilt = clamp(cam.tilt, 0.45, 1.35);
  cam.x = clamp(cam.x, -4, N + 4); cam.y = clamp(cam.y, -4, N + 4);
}
function applyCamera() {
  const cx = cam.x, cz = cam.y;
  const px = cx + cam.dist * Math.cos(cam.tilt) * Math.sin(cam.rot), pz = cz + cam.dist * Math.cos(cam.tilt) * Math.cos(cam.rot), py = cam.dist * Math.sin(cam.tilt);
  camera.position.set(px, py, pz); camera.lookAt(cx, 0, cz);
}
const _ray = new T3.Raycaster(), _ndc = new T3.Vector2(), _plane = new T3.Plane(V3(0, 1, 0), 0), _hit = new T3.Vector3();
function groundPoint(sx, sy) {
  _ndc.set(sx / vw * 2 - 1, -(sy / vh) * 2 + 1); _ray.setFromCamera(_ndc, camera);
  return _ray.ray.intersectPlane(_plane, _hit) ? [_hit.x, _hit.z] : null;
}
function tileAt(sx, sy) { const p = groundPoint(sx, sy); return p ? [Math.floor(p[0]), Math.floor(p[1])] : [-99, -99]; }
const _v = new T3.Vector3();
function project(x, y, z) { _v.set(x, y, z).project(camera); return [(_v.x + 1) / 2 * vw, (1 - _v.y) / 2 * vh, _v.z]; }
function pxPerUnit() { // pixels por unidade de mundo no alvo da câmera (para escalar selos)
  const a = project(cam.x, 0, cam.y), b = project(cam.x + 1, 0, cam.y); return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/* ---------------- inicialização ---------------- */
function initGL() {
  renderer = new T3.WebGLRenderer({ canvas: glc, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = T3.SRGBColorSpace; renderer.toneMapping = T3.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T3.PCFSoftShadowMap; renderer.localClippingEnabled = true;
  scene = new T3.Scene(); scene.fog = new T3.Fog(0x0A1020, 70, 190);
  camera = new T3.PerspectiveCamera(42, 1, 0.5, 400);
  makeTextures(); makeMaterials();
  hemi = new T3.HemisphereLight(0x7E92D6, 0x3A5A34, 1.25); scene.add(hemi);
  scene.add(new T3.AmbientLight(0x4A5068, 0.45));
  sun = new T3.DirectionalLight(0xFFE3C4, 1.7); sun.position.set(30, 60, 20); sun.castShadow = true;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048); sun.shadow.camera.near = 5; sun.shadow.camera.far = 200; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);
  scene.add(world); world.add(bldRoot); world.add(fxRoot);
  makeSky(); makeTable();
}
function makeSky() {
  const g = new T3.SphereGeometry(320, 32, 16);
  MAT.aurora = new T3.ShaderMaterial({ side: T3.BackSide, depthWrite: false, fog: false, uniforms: { t: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float t; varying vec3 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      void main(){ vec3 d = normalize(vP); float y = d.y;
        vec3 col = mix(vec3(0.05,0.08,0.17), vec3(0.02,0.04,0.09), smoothstep(0.0,0.7,y));
        col = mix(vec3(0.09,0.12,0.24), col, smoothstep(-0.05,0.25,y));
        float ang = atan(d.x, d.z);
        float a1 = smoothstep(0.25,0.55,y) * (1.0-smoothstep(0.55,0.9,y));
        float band = sin(ang*3.0 + t*0.15 + sin(ang*7.0+t*0.1)*0.6) * 0.5 + 0.5;
        float band2 = sin(ang*5.0 - t*0.12 + 1.7) * 0.5 + 0.5;
        col += vec3(0.1,0.55,0.4) * a1 * pow(band,3.0) * 0.55 + vec3(0.35,0.2,0.6) * a1 * pow(band2,4.0) * 0.4;
        vec2 sp = floor(vec2(ang*60.0, y*220.0)); float s = h(sp); float star = step(0.985, s) * smoothstep(0.02,0.1,y) * (0.6+0.4*sin(t*2.0+s*50.0));
        col += vec3(star);
        gl_FragColor = vec4(col,1.0); }` });
  skyMesh = new T3.Mesh(g, MAT.aurora); scene.add(skyMesh);
  anims.push({ update: (now) => { MAT.aurora.uniforms.t.value = now / 1000; } });
}
function makeTable() {
  const m = 2.2, H = 1.4;
  const top = box(N + m * 2, H, N + m * 2, MAT.wood, N / 2, -0.55 - H, N / 2); top.receiveShadow = true; world.add(top);
  // paredes de vidro em volta da mesa
  const wall = (w, d, x, z) => { const g = new T3.BoxGeometry(w, 1.6, d); const mm = new T3.Mesh(g, MAT.glass); mm.position.set(x, 0.25, z); mm.castShadow = false; world.add(mm); world.add(edges(g, MAT.edge, x, 0.25, z)); };
  wall(N + 0.3, 0.08, N / 2, -0.15); wall(N + 0.3, 0.08, N / 2, N + 0.15); wall(0.08, N + 0.3, -0.15, N / 2); wall(0.08, N + 0.3, N + 0.15, N / 2);
  // placa de latão na frente
  const pc = document.createElement('canvas'); pc.width = 1024; pc.height = 128; const pg = pc.getContext('2d');
  plaqueMat = new T3.MeshStandardMaterial({ map: new T3.CanvasTexture(pc), roughness: 0.35, metalness: 0.8 }); plaqueMat.map.colorSpace = T3.SRGBColorSpace;
  const pl = box(12, 0.02, 1.5, plaqueMat, N / 2, -0.54, N + 1.3); pl.castShadow = false; world.add(pl);
  plaqueMat._c = pc; updatePlaque();
}
function updatePlaque() {
  const pc = plaqueMat._c, g = pc.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, pc.height); gr.addColorStop(0, '#EBD08F'); gr.addColorStop(1, '#A9843F'); g.fillStyle = gr; g.fillRect(0, 0, pc.width, pc.height);
  g.strokeStyle = 'rgba(40,28,8,.5)'; g.lineWidth = 4; g.strokeRect(14, 14, pc.width - 28, pc.height - 28);
  g.fillStyle = '#2A1F0B'; g.font = '600 46px Marcellus, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('ARCOLOGIA DE HELD · MAQUETE VIVA · ' + fmt(D.pop) + ' HABITANTES', pc.width / 2, pc.height / 2 + 2);
  plaqueMat.map.needsUpdate = true;
}

/* ---------------- terreno e água ---------------- */
function waterDist(x, y) { // distância (em quadrados) até a água mais próxima, até 3
  let best = 4;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, yy = y + dy; if (inb(xx, yy) && WATER[yy * N + xx]) best = Math.min(best, Math.hypot(dx, dy)); }
  return best;
}
function buildGround() {
  if (groundMesh) { world.remove(groundMesh); groundMesh.geometry.dispose(); }
  const S2 = 2; const g = new T3.PlaneGeometry(N, N, N * S2, N * S2); g.rotateX(-Math.PI / 2); g.translate(N / 2, 0, N / 2);
  const pos = g.attributes.position; const col = new Float32Array(pos.count * 3); const c = new T3.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i); const tx = clamp(Math.floor(x), 0, N - 1), tz = clamp(Math.floor(z), 0, N - 1);
    const inW = WATER[tz * N + tx] === 1; const d = inW ? 0 : waterDist(tx, tz);
    let y = 0;
    if (inW) y = -0.42; else if (d < 1.2) y = -0.12 * (1.2 - d); else y = (vnoise(x, z, 6, 3) - 0.5) * 0.08;
    pos.setY(i, y);
    const n = vnoise(x * 1.7, z * 1.7, 5, 9);
    if (inW) c.setRGB(0.6, 0.66, 0.55); else if (d < 1.5) c.setRGB(0.92, 0.86, 0.68); else c.setRGB(0.82 + n * 0.22, 0.95 + n * 0.08, 0.7 + n * 0.2);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new T3.BufferAttribute(col, 3)); g.computeVertexNormals();
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * N / 2.5, uv.getY(i) * N / 2.5);
  groundMesh = new T3.Mesh(g, MAT.grass); groundMesh.receiveShadow = true; world.add(groundMesh);
  if (!waterMesh) {
    waterMesh = plane(N, N, MAT.water, N / 2, -0.14, N / 2, { rep: [N / 6, N / 6] }); waterMesh.receiveShadow = true; world.add(waterMesh);
    anims.push({ update: (now) => { TEX.water.offset.set(now / 90000, now / 70000); } });
  }
}
function buildLockOverlay() {
  if (lockGroup) { world.remove(lockGroup); }
  lockGroup = new T3.Group(); const r = landRect();
  const add = (x, z, w, d) => { if (w <= 0 || d <= 0) return; const p = plane(w, d, MAT.locked, x + w / 2, 0.06, z + d / 2); p.receiveShadow = false; lockGroup.add(p); };
  add(0, 0, N, r.y0); add(0, r.y1 + 1, N, N - r.y1 - 1); add(0, r.y0, r.x0, r.s); add(r.x1 + 1, r.y0, N - r.x1 - 1, r.s);
  if (r.s < N) {
    const pts = [V3(r.x0, 0.08, r.y0), V3(r.x1 + 1, 0.08, r.y0), V3(r.x1 + 1, 0.08, r.y1 + 1), V3(r.x0, 0.08, r.y1 + 1), V3(r.x0, 0.08, r.y0)];
    const lg = new T3.BufferGeometry().setFromPoints(pts); const ln = new T3.Line(lg, new T3.LineDashedMaterial({ color: 0xE8CB86, dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.85 })); ln.computeLineDistances(); lockGroup.add(ln);
  }
  world.add(lockGroup);
}

/* ---------------- ruas ---------------- */
function buildRoads() {
  if (roadGroup) { world.remove(roadGroup); roadGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  roadGroup = new T3.Group();
  const isR = (x, y) => inb(x, y) && ROAD[y * N + x] > 0;
  const parts = { asphalt: [], asphaltLight: [], curb: [], paintW: [], paintY: [], pier: [], lamp: [] };
  const bx = new T3.BoxGeometry(1, 1, 1);
  const push = (k, x, y, z, sx, sy, sz, ry = 0) => { const m = new T3.Matrix4(); m.compose(V3(x, y, z), new T3.Quaternion().setFromEuler(new T3.Euler(0, ry, 0)), V3(sx, sy, sz)); parts[k].push({ geo: bx, matrix: m }); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, lvl = ROAD[i]; if (!lvl) continue;
    const cx = x + 0.5, cz = y + 0.5; const w = lvl === 1 ? 0.62 : lvl === 2 ? 0.82 : 0.96; const onW = WATER[i] === 1; const yb = onW ? 0.02 : 0.0;
    const n = isR(x, y - 1), s = isR(x, y + 1), wst = isR(x - 1, y), e = isR(x + 1, y);
    const mat = lvl === 3 ? 'asphalt' : 'asphaltLight';
    // centro + braços
    push(mat, cx, yb + 0.03, cz, w, 0.06, w);
    if (wst) push(mat, x + 0.25, yb + 0.03, cz, 0.5, 0.06, w); if (e) push(mat, x + 0.75, yb + 0.03, cz, 0.5, 0.06, w);
    if (n) push(mat, cx, yb + 0.03, y + 0.25, w, 0.06, 0.5); if (s) push(mat, cx, yb + 0.03, y + 0.75, w, 0.06, 0.5);
    // calçadas (base clara um pouco maior)
    push('curb', cx, yb + 0.015, cz, Math.min(1, w + 0.2), 0.035, Math.min(1, w + 0.2));
    if (wst) push('curb', x + 0.25, yb + 0.015, cz, 0.5, 0.035, Math.min(1, w + 0.2)); if (e) push('curb', x + 0.75, yb + 0.015, cz, 0.5, 0.035, Math.min(1, w + 0.2));
    if (n) push('curb', cx, yb + 0.015, y + 0.25, Math.min(1, w + 0.2), 0.035, 0.5); if (s) push('curb', cx, yb + 0.015, y + 0.75, Math.min(1, w + 0.2), 0.035, 0.5);
    // faixas
    const deg = n + s + wst + e;
    if (deg <= 2) {
      const horiz = (wst || e) && !(n || s) ? true : (n || s) && !(wst || e) ? false : null;
      if (horiz !== null) {
        const pk = lvl === 2 ? 'paintY' : 'paintW';
        if (lvl === 3) { for (let k = 0; k < 4; k++) { const o = -0.375 + k * 0.25; if (horiz) push(pk, x + 0.125 + k * 0.25, yb + 0.065, cz - 0.1, 0.14, 0.01, 0.03), push(pk, x + 0.125 + k * 0.25, yb + 0.065, cz + 0.1, 0.14, 0.01, 0.03); else push(pk, cx - 0.1, yb + 0.065, y + 0.125 + k * 0.25, 0.03, 0.01, 0.14), push(pk, cx + 0.1, yb + 0.065, y + 0.125 + k * 0.25, 0.03, 0.01, 0.14); } }
        else { for (let k = 0; k < 3; k++) { if (horiz) push(pk, x + 0.17 + k * 0.33, yb + 0.065, cz, 0.16, 0.01, 0.035); else push(pk, cx, yb + 0.065, y + 0.17 + k * 0.33, 0.035, 0.01, 0.16); } }
      }
    }
    if (onW) { push('pier', x + 0.2, -0.4, y + 0.2, 0.12, 0.5, 0.12); push('pier', x + 0.8, -0.4, y + 0.8, 0.12, 0.5, 0.12); }
    if ((x + y * 3) % 4 === 0 && !HWY[i]) parts.lamp.push([x + 0.1, y + 0.1]);
  }
  const mats = { asphalt: MAT.asphalt, asphaltLight: MAT.asphaltLight, curb: MAT.curb, paintW: MAT.paintW, paintY: MAT.paintY, pier: MAT.dark };
  for (const k in mats) { if (!parts[k].length) continue; const m = new T3.Mesh(mergeGeos(parts[k]), mats[k]); m.receiveShadow = true; m.castShadow = k === 'pier'; roadGroup.add(m); }
  // postes de luz (instanciados)
  if (parts.lamp.length) {
    const pole = new T3.CylinderGeometry(0.02, 0.03, 0.55, 5); pole.translate(0, 0.275, 0);
    const lampM = new T3.InstancedMesh(pole, MAT.steel, parts.lamp.length); const glowM = new T3.InstancedMesh(new T3.SphereGeometry(0.05, 6, 5), MAT.lampGlow, parts.lamp.length);
    parts.lamp.forEach(([lx, lz], i) => { lampM.setMatrixAt(i, mat4(lx, 0.05, lz)); glowM.setMatrixAt(i, mat4(lx, 0.6, lz)); });
    lampM.castShadow = false; roadGroup.add(lampM, glowM);
    // luz quente no chão (planos emissivos discretos)
    const halo = new T3.InstancedMesh(new T3.CircleGeometry(0.45, 12).rotateX(-Math.PI / 2), new T3.MeshBasicMaterial({ color: 0xFFD9A0, transparent: true, opacity: 0.12, depthWrite: false }), parts.lamp.length);
    parts.lamp.forEach(([lx, lz], i) => halo.setMatrixAt(i, mat4(lx, 0.075, lz))); roadGroup.add(halo);
  }
  world.add(roadGroup);
}

/* ---------------- árvores ---------------- */
let treeGeo = null;
function makeTreeGeo() {
  const list = [];
  list.push({ geo: new T3.CylinderGeometry(0.03, 0.05, 0.3, 4), matrix: mat4(0, 0.15, 0), color: new T3.Color(0x5A3E28) });
  const tones = [0x2A6B36, 0x3A7D3F, 0x246030];
  const blobs = [[0, 0.46, 0, 0.24], [0.12, 0.56, 0.06, 0.18], [-0.09, 0.62, -0.07, 0.16]];
  blobs.forEach(([x, y, z, r], i) => list.push({ geo: new T3.IcosahedronGeometry(r, 0), matrix: mat4(x, y, z, i * 0.7, 1, 0.85), color: new T3.Color(tones[i % 3]) }));
  treeGeo = mergeGeos(list);
}
function buildTrees() {
  if (!treeGeo) makeTreeGeo();
  if (treeMesh) { world.remove(treeMesh); }
  const spots = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x; if (!TREE[i] || ROAD[i] || OCC[i] || WATER[i]) continue;
    const n = hash(x, y, 2) < 0.4 ? 2 : 1;
    for (let j = 0; j < n; j++) spots.push([x + 0.2 + 0.6 * hash(x, y, 3 + j), y + 0.2 + 0.6 * hash(x, y, 5 + j), 0.7 + 0.6 * hash(x, y, 8 + j), hash(x, y, 9 + j) * TAU, hash(x, y, 12 + j)]);
  }
  treeMesh = new T3.InstancedMesh(treeGeo, MAT.leaf, Math.max(1, spots.length));
  const c = new T3.Color();
  spots.forEach(([x, z, s, ry, t], i) => { treeMesh.setMatrixAt(i, mat4(x, 0, z, ry, s, s * (0.9 + t * 0.3))); c.setRGB(0.8 + t * 0.35, 0.85 + t * 0.3, 0.75 + t * 0.3); treeMesh.setColorAt(i, c); });
  treeMesh.count = spots.length; treeMesh.castShadow = true; treeMesh.receiveShadow = true; treeMesh.instanceMatrix.needsUpdate = true; if (treeMesh.instanceColor) treeMesh.instanceColor.needsUpdate = true;
  world.add(treeMesh);
}

/* ---------------- carros ---------------- */
let cars = []; const CAR_COLORS = [0xE8E2D4, 0xC9D3E6, 0xF0B44C, 0x5BC0EB, 0xFF6A5C, 0x9AA3B5, 0x46E3B5];
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
function roadNb(i, d) { const x = i % N + DIRS[d][0], y = ((i / N) | 0) + DIRS[d][1]; return inb(x, y) && ROAD[y * N + x] ? y * N + x : -1; }
const MAX_CARS = 56;
function makeCars() {
  const body = mergeGeos([
    { geo: new T3.BoxGeometry(0.34, 0.1, 0.18), matrix: mat4(0, 0.09, 0), color: new T3.Color(0xffffff) },
    { geo: new T3.BoxGeometry(0.2, 0.08, 0.16), matrix: mat4(-0.02, 0.17, 0), color: new T3.Color(0x1B2436) },
    { geo: new T3.BoxGeometry(0.03, 0.03, 0.04), matrix: mat4(0.17, 0.09, 0.05), color: new T3.Color(0xFFF3CF) },
    { geo: new T3.BoxGeometry(0.03, 0.03, 0.04), matrix: mat4(0.17, 0.09, -0.05), color: new T3.Color(0xFFF3CF) },
  ]);
  carMesh = new T3.InstancedMesh(body, new T3.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3, emissive: 0x222222, emissiveIntensity: 0.3 }), MAX_CARS);
  carMesh.castShadow = true; carMesh.count = 0; world.add(carMesh);
}
function updateCars(dt) {
  const want = Math.min(MAX_CARS, 6 + S.bld.length * 1.3 + S.stats.roads / 12);
  if (cars.length < want && Math.random() < 0.3) {
    const tiles = []; for (let i = 0; i < N * N; i++) if (CONN[i] && !HWY[i]) tiles.push(i);
    if (tiles.length) { const i = pick(tiles); const outs = [0, 1, 2, 3].filter(d => roadNb(i, d) >= 0); if (outs.length) cars.push({ i, from: (pick(outs) + 2) % 4, to: pick(outs), t: 0.5, sp: 0.5 + Math.random() * 0.5, c: new T3.Color(pick(CAR_COLORS)) }); }
  }
  for (const c of cars) {
    c.t += c.sp * dt * (ROAD[c.i] === 3 ? 1.5 : 1) * (STRETCH[c.i] >= 0 && stretches[STRETCH[c.i]].jam ? 0.35 : 1);
    if (c.t >= 1) {
      const next = roadNb(c.i, c.to); if (next < 0) { c.dead = true; continue; }
      c.i = next; c.from = (c.to + 2) % 4; c.t = 0;
      const outs = [0, 1, 2, 3].filter(d => d !== c.from && roadNb(next, d) >= 0);
      if (!outs.length) c.to = c.from; else c.to = Math.random() < 0.7 && outs.includes((c.from + 2) % 4) ? (c.from + 2) % 4 : pick(outs);
    }
  }
  cars = cars.filter(c => !c.dead && ROAD[c.i]);
  if (!carMesh) return;
  const m = new T3.Matrix4(), q = new T3.Quaternion(), e = new T3.Euler();
  cars.forEach((c, k) => {
    const [x, z, d] = carPos(c); e.set(0, -DIRS[d][0] * 0 + (d === 0 ? 0 : d === 1 ? -Math.PI / 2 : d === 2 ? Math.PI : Math.PI / 2), 0); q.setFromEuler(e);
    m.compose(V3(x, WATER[c.i] ? 0.08 : 0.06, z), q, V3(1, 1, 1)); carMesh.setMatrixAt(k, m); carMesh.setColorAt(k, c.c);
  });
  carMesh.count = cars.length; carMesh.instanceMatrix.needsUpdate = true; if (carMesh.instanceColor) carMesh.instanceColor.needsUpdate = true;
}
function carPos(c) {
  const x0 = c.i % N, z0 = (c.i / N) | 0; const cx = x0 + 0.5, cz = z0 + 0.5;
  const ex = [x0 + 1, cx, x0, cx], ez = [cz, z0 + 1, cz, z0];
  const fx = ex[c.from], fz = ez[c.from], tx = ex[c.to], tz = ez[c.to];
  let px, pz;
  if (c.t < 0.5) { const u = c.t * 2; px = fx + (cx - fx) * u; pz = fz + (cz - fz) * u; } else { const u = (c.t - 0.5) * 2; px = cx + (tx - cx) * u; pz = cz + (tz - cz) * u; }
  const d = c.t < 0.5 ? (c.from + 2) % 4 : c.to; const dx = DIRS[d][0], dz = DIRS[d][1];
  return [px - dz * 0.14, pz + dx * 0.14, d];
}

/* ---------------- montagem / redimensionamento ---------------- */
let gfxLow = false;
try { gfxLow = localStorage.getItem('arcologia-held:gfx') === 'low'; } catch (_) {}
function applyQuality(low) {
  gfxLow = !!low; try { localStorage.setItem('arcologia-held:gfx', gfxLow ? 'low' : 'high'); } catch (_) {}
  if (!renderer) return;
  renderer.shadowMap.enabled = !gfxLow; sun.castShadow = !gfxLow; renderer.shadowMap.needsUpdate = true;
  scene.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) m.needsUpdate = true; } });
  resize();
}
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  vw = window.innerWidth; vh = window.innerHeight;
  cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr); cv.style.width = vw + 'px'; cv.style.height = vh + 'px';
  if (renderer) { renderer.setPixelRatio(gfxLow ? 1 : Math.min(dpr, 1.75)); renderer.setSize(vw, vh, true); camera.aspect = vw / vh; camera.updateProjectionMatrix(); }
}
let lockLand = -1, lastRebuild = 0;
function rebuildWorld(force) {
  const now = performance.now(); if (!force && now - lastRebuild < 160) return; lastRebuild = now;
  if (!groundMesh) buildGround();
  buildRoads(); buildTrees(); if (lockLand !== S.land) { buildLockOverlay(); lockLand = S.land; } updatePlaque();
  worldDirty = false;
}
function initScene() { initGL(); if (gfxLow) applyQuality(true); makeCars(); rebuildWorld(true); }
