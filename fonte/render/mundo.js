// Mundo: monta todas as estruturas da composição, liga cada etapa à sua peça 3D, mostra/esconde
// conforme o progresso, funde o que está pronto em poucas malhas (por quadrante nos materiais grandes),
// responde ao toque por caixas de seleção e anima o que tem vida (gente, fauna, aves, água).
import * as THREE from 'three';
import { faixas } from './models/aneis.js';
import { biblioteca, crd } from './models/biblioteca.js';
import { bioma, anfiteatro, gorilas, acelerador, savana, santuarioInterior, CasasVila } from './models/leste.js';
import { ciencias, alaOnda, lago, sedePatio } from './models/centro.js';
import { escola, campo, engenharia, instituto, gramadoUni } from './models/campus.js';
import { praca, passarela, ponteCoberta } from './models/praca.js';
import { LOTES, predioCanteiro, ambienteCanteiro } from './models/canteiro.js';
import { PASSARELAS, A } from '../data/planta.js';
import { Crowd } from './figuras.js';
import { inPoly, rng } from '../core/util.js';
import { bake, normals, FH } from './geom.js';
import { Bando, sombrasContato, tempoAnimais } from './animais.js';

const _mi = new THREE.Matrix4(), _mw = new THREE.Matrix4(), _m3 = new THREE.Matrix3(), _cor = new THREE.Color(), _v = new THREE.Vector3();
// Junta geometrias numa só. blocos: [[fonte, itens]], itens {g, m} (matriz de mundo) ou {g, o, i}
// (instância i de uma InstancedMesh, com a cor da instância). Devolve a geometria e as faixas de
// índice de cada fonte (para recortá-la depois sem refundir).
function fundirLista(blocos) {
  let nv = 0, ni = 0, temCor = false;
  for (const [, it] of blocos) for (const x of it) { const a = x.g.attributes; nv += a.position.count; ni += x.g.index ? x.g.index.count : a.position.count; if ((a.color && a.color.itemSize === 3) || (x.o && x.o.instanceColor)) temCor = true; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2), C = temCor ? new Float32Array(nv * 3) : null; const I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const faixas = []; let vo = 0, io = 0;
  for (const [tag, it] of blocos) {
    const i0 = io;
    for (const x of it) {
      const g = x.g, pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv, ca = g.attributes.color && g.attributes.color.itemSize === 3 ? g.attributes.color : null; const n = pa.count;
      let M = x.m; if (x.o) { x.o.getMatrixAt(x.i, _mi); M = _mw.multiplyMatrices(x.o.matrixWorld, _mi); }
      const e = M.elements; const ne = _m3.getNormalMatrix(M).elements;
      let cr = 1, cg = 1, cb = 1; if (x.o && x.o.instanceColor) { x.o.getColorAt(x.i, _cor); cr = _cor.r; cg = _cor.g; cb = _cor.b; }
      const rap = !pa.isInterleavedBufferAttribute && pa.itemSize === 3, pp = pa.array; const nn = na && !na.isInterleavedBufferAttribute ? na.array : null;
      for (let k = 0; k < n; k++) {
        const px = rap ? pp[k * 3] : pa.getX(k), py = rap ? pp[k * 3 + 1] : pa.getY(k), pz = rap ? pp[k * 3 + 2] : pa.getZ(k); const o3 = (vo + k) * 3;
        P[o3] = e[0] * px + e[4] * py + e[8] * pz + e[12]; P[o3 + 1] = e[1] * px + e[5] * py + e[9] * pz + e[13]; P[o3 + 2] = e[2] * px + e[6] * py + e[10] * pz + e[14];
        if (na) {
          const qx = nn ? nn[k * 3] : na.getX(k), qy = nn ? nn[k * 3 + 1] : na.getY(k), qz = nn ? nn[k * 3 + 2] : na.getZ(k);
          const rx = ne[0] * qx + ne[3] * qy + ne[6] * qz, ry = ne[1] * qx + ne[4] * qy + ne[7] * qz, rz = ne[2] * qx + ne[5] * qy + ne[8] * qz; const l = Math.hypot(rx, ry, rz) || 1;
          N[o3] = rx / l; N[o3 + 1] = ry / l; N[o3 + 2] = rz / l;
        }
        if (ua) { U[(vo + k) * 2] = ua.getX(k); U[(vo + k) * 2 + 1] = ua.getY(k); }
        if (C) { let r = cr, gg = cg, b = cb; if (ca) { r *= ca.getX(k); gg *= ca.getY(k); b *= ca.getZ(k); } C[o3] = r; C[o3 + 1] = gg; C[o3 + 2] = b; }
      }
      if (g.index) { const idx = g.index.array; for (let k = 0; k < idx.length; k++) I[io + k] = idx[k] + vo; io += idx.length; } else { for (let k = 0; k < n; k++) I[io + k] = vo + k; io += n; }
      vo += n;
    }
    faixas.push([tag, i0, io]);
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('uv', new THREE.BufferAttribute(U, 2)); if (C) out.setAttribute('color', new THREE.BufferAttribute(C, 3));
  out.setIndex(new THREE.BufferAttribute(I, 1)); out.computeBoundingSphere(); out.computeBoundingBox(); return { geo: out, faixas };
}
// Grade 2D (XZ) de triângulos em mundo para o toque em peças grandes: o raio só testa os triângulos
// das células que atravessa (malhas estáticas; a grade é feita na 1ª vez que a peça é tocada).
const _ga = new THREE.Vector3(), _gb = new THREE.Vector3(), _gc = new THREE.Vector3(), _gh = new THREE.Vector3();
function gradeDe(mesh) {
  const g = mesh.geometry, pa = g.attributes.position, idx = g.index, nb = pa.count, tb = idx ? idx.count / 3 : nb / 3, ni = mesh.isInstancedMesh ? mesh.count : 1, nt = tb * ni;
  const W = new Float32Array(nb * ni * 3); const M = new THREE.Matrix4();
  for (let n = 0; n < ni; n++) {
    if (mesh.isInstancedMesh) { mesh.getMatrixAt(n, M); M.premultiply(mesh.matrixWorld); } else M.copy(mesh.matrixWorld); const e = M.elements;
    for (let k = 0; k < nb; k++) { const x = pa.getX(k), y = pa.getY(k), z = pa.getZ(k), o = (n * nb + k) * 3; W[o] = e[0] * x + e[4] * y + e[8] * z + e[12]; W[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; W[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; }
  }
  const V = (t, j) => { const b = t % tb; return (idx ? idx.getX(b * 3 + j) : b * 3 + j) + ((t - b) / tb) * nb; };
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9, y0 = 1e9, y1 = -1e9; for (let k = 0; k < W.length; k += 3) { const x = W[k], y = W[k + 1], z = W[k + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const s = Math.max(0.25, Math.max(x1 - x0, z1 - z0) / 32), nx = Math.max(1, Math.ceil((x1 - x0) / s + 1e-6)), nz = Math.max(1, Math.ceil((z1 - z0) / s + 1e-6));
  const cont = new Int32Array(nx * nz + 1), faixa = (t, f) => { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (let j = 0; j < 3; j++) { const v = V(t, j); a = Math.min(a, W[v * 3]); b = Math.max(b, W[v * 3]); c = Math.min(c, W[v * 3 + 2]); d = Math.max(d, W[v * 3 + 2]); } const i0 = Math.min(nx - 1, Math.floor((a - x0) / s)), i1 = Math.min(nx - 1, Math.floor((b - x0) / s)), j0 = Math.min(nz - 1, Math.floor((c - z0) / s)), j1 = Math.min(nz - 1, Math.floor((d - z0) / s)); for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) f(j * nx + i); };
  for (let t = 0; t < nt; t++) faixa(t, (c) => cont[c + 1]++);
  for (let c = 0; c < nx * nz; c++) cont[c + 1] += cont[c];
  const lista = new Int32Array(cont[nx * nz]), pos = cont.slice(0, nx * nz); for (let t = 0; t < nt; t++) faixa(t, (c) => { lista[pos[c]++] = t; });
  return { W, V, x0, z0, y0, y1, s, nx, nz, cont, lista, marca: new Uint32Array(nt), q: 0, g, n: ni };
}
const trisDe = (o) => (o.geometry?.attributes?.position ? (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1) : 0);
function raioGrade(G, ray) {
  const o = ray.origin, d = ray.direction; G.q++;
  // trecho do raio dentro da faixa de alturas da peça
  let ta = 0, tb = 1e4; if (Math.abs(d.y) > 1e-6) { const a = (G.y0 - 0.01 - o.y) / d.y, b = (G.y1 + 0.01 - o.y) / d.y; ta = Math.max(0, Math.min(a, b)); tb = Math.max(a, b); }
  const hxz = Math.hypot(d.x, d.z), passo = hxz > 1e-6 ? (G.s * 0.5) / hxz : tb - ta + 1; let best = Infinity, bestT = -1;
  for (let t = ta; t <= tb + passo; t += passo) {
    if (t - passo > best + G.s) break;
    const x = o.x + d.x * t, z = o.z + d.z * t, i = Math.floor((x - G.x0) / G.s), j = Math.floor((z - G.z0) / G.s); if (i < 0 || j < 0 || i >= G.nx || j >= G.nz) continue;
    const c = j * G.nx + i;
    for (let k = G.cont[c]; k < G.cont[c + 1]; k++) {
      const tri = G.lista[k]; if (G.marca[tri] === G.q) continue; G.marca[tri] = G.q;
      const a = G.V(tri, 0), b = G.V(tri, 1), cc = G.V(tri, 2), W = G.W;
      if (ray.intersectTriangle(_ga.set(W[a * 3], W[a * 3 + 1], W[a * 3 + 2]), _gb.set(W[b * 3], W[b * 3 + 1], W[b * 3 + 2]), _gc.set(W[cc * 3], W[cc * 3 + 1], W[cc * 3 + 2]), false, _gh)) { const dd = _gh.distanceTo(o); if (dd < best) { best = dd; bestT = tri; } }
    }
  }
  return bestT >= 0 ? best : null;
}
const filhos = (g) => g.children.map((c) => c.uuid).join();
// gente por perfil de qualidade
const GENTE = { ultra: 280, alta: 200, media: 130, leve: 70 };

export class Mundo {
  constructor(engine, ground, forest) {
    this.e = engine; this.ground = ground; this.forest = forest; const scene = engine.scene;
    this.root = new THREE.Group(); this.root.name = 'mundo'; scene.add(this.root);
    // edifícios-fita (módulos por nível)
    this.faixas = faixas(); this.faixas.onda = alaOnda(); this.casas = new CasasVila();
    const FP = { sede: 'sede', humanidades: 'humanidades', onda: 'onda', uniElo: 'uniElo' };
    for (const [k, f] of Object.entries(this.faixas)) { this.root.add(f.group); f.refresh(); f.group.userData.pick = FP[k] ? { tipo: 'proj', id: FP[k] } : { tipo: 'modulos', id: k }; }
    this.root.add(this.casas.group); this.casas.group.userData.pick = { tipo: 'modulos', id: 'casas' };
    // marcos com etapas
    const list = [biblioteca(), crd(), bioma(), anfiteatro(), gorilas(), acelerador(), savana(), santuarioInterior(), ciencias(), lago(ground), sedePatio(), escola(), campo(), engenharia(), instituto(), gramadoUni(), praca(), ponteCoberta()];
    for (const id of Object.keys(PASSARELAS)) list.push(passarela(id));
    const PROJ_DE = { sedePatio: 'sede' };
    this.modelos = {}; for (const m of list) { this.modelos[m.id] = m; this.root.add(m.root); m.root.userData.pick = { tipo: 'proj', id: PROJ_DE[m.id] || m.id }; for (const p of Object.values(m.partes)) { bake(p); p.visible = false; p.userData.feito = false; } for (const s of Object.values(m.esqueletos || {})) { bake(s); s.visible = false; } }
    // canteiro de obras
    this.canteiro = new THREE.Group(); this.canteiro.name = 'canteiro'; this.root.add(this.canteiro); this.canteiro.add(ambienteCanteiro()); this.predios = {};
    for (const [id, l] of Object.entries(LOTES)) { const g = predioCanteiro(id.startsWith('usina') ? 'usina' : id); g.position.set(l.x, 0, l.z); g.rotation.y = l.r; g.visible = false; g.userData.pick = { tipo: 'predio', id }; this.canteiro.add(g); this.predios[id] = g; }
    // gente (praça, passarelas, terraços), aves e sombras de contato dos bichos
    this.povo = new Crowd('pessoa', 280); this.povo.mesh.visible = false; this.povo.mesh.userData.semHAO = true; this.root.add(this.povo.mesh); this.povoAreas = [];
    this.bando = new Bando(14); this.root.add(this.bando.mesh);
    this.blobs = sombrasContato(); this.root.add(this.blobs.mesh);
    this.animados = [];
    // fusão: fontes fundidas (com assinatura), soltas à espera da refusão e cache das contribuições
    this.fundido = null; this._malhas = new Map(); this._naFusao = new Map(); this._soltas = new Set(); this._cache = new Map(); this._grandes = new Set(); this._caixas = new WeakMap();
    this.refusaoPendente = false; this.stats = { refundirMs: 0, refusaoMs: 0, rayMs: 0 };
    // toque: caixas de seleção (o fundido e os originais escondidos não entram no raycast da cena)
    this.picks = []; this.picksFuturos = []; this._picksSujo = true; this._proxies = new Map(); this._hits = []; this._nor = new WeakMap(); this._grades = new WeakMap();
    this.root.raycast = (rc, out) => { const h = this.pick(rc); if (h) out.push({ distance: h.distancia, point: h.point, object: this._proxy(h.pick) }); return false; };
    // oclusão: terreno, mata e o mundo entram no mapa de alturas
    engine.haoRaizes?.add(ground.group); engine.haoRaizes?.add(forest.group); engine.haoRaizes?.add(this.root);
    engine.aoQualidade?.push(() => { if (this.povo.walkers.length) this.povoar(); });
  }
  parte(modelo, etapa) { return this.modelos[modelo]?.partes[etapa]; }
  setEtapa(modelo, etapa, feito) {
    const p = this.parte(modelo, etapa); if (!p) return; p.visible = feito; p.userData.feito = feito;
    if (feito && p.userData.chao) { this.ground.flags[p.userData.chao] = true; this.ground.paint(); }
    if (feito && p.userData.nivel && modelo === 'lago') this.ground.lake.position.y = -0.1;
    if (!feito && p.userData.nivel && modelo === 'lago') this.ground.lake.position.y = -0.3;
    this._animados(); this.e.shadowDirty = true; this.e.marcarHAO?.(); this._sujarPicks();
  }
  _animados() {
    this.animados = [];
    for (const m of Object.values(this.modelos)) for (const p of Object.values(m.partes)) {
      if (!p.userData.manadas && !p.userData.update) continue;
      if (p.visible) this.animados.push(p); else for (const md of p.userData.manadas || []) md.esconder?.();
    }
  }
  // tudo concluído (a composição da foto)
  tudoPronto() {
    for (const f of Object.values(this.faixas)) f.setTodos(f.max); this.casas.setTodos(this.casas.max);
    for (const [id, m] of Object.entries(this.modelos)) for (const k of Object.keys(m.partes)) this.setEtapa(id, k, true);
    this.refundirAgora();
    this.ground.flags.praca = true; this.ground.flags.verde = Object.fromEntries(['anel', 'uni', 'ciencias', 'sede', 'biblio', 'savana', 'bioma', 'vila', 'gorilas', 'acelerador', 'santuario'].map((k) => [k, true])); this.ground.paint(); this.ground.lake.position.y = -0.1; this.ground.tampa.visible = false;
    this.povoar();
  }
  // ------------------------------------------------------------ gente
  // Áreas marcadas com userData.pessoas {area, y, n} (praça 110 por padrão), passarelas feitas (10 em
  // cada) e o passeio dos tetos das fitas (se o modelo o expuser: 40 no Anel, 12 nas outras de nível 3+).
  // O total é limitado pelo perfil de qualidade, proporcionalmente.
  povoar() {
    const C = this.povo; C.clear(); const R = rng(9137); const lagos = A.lagosPraca || [];
    const naAgua = (x, z) => lagos.some((l) => { const dx = x - l.c[0], dz = z - l.c[1], c = Math.cos(-(l.rot || 0)), s = Math.sin(-(l.rot || 0)); const u = dx * c - dz * s, v = dx * s + dz * c; return (u * u) / ((l.rx + 0.3) ** 2) + (v * v) / ((l.rz + 0.3) ** 2) < 1; });
    const pedidos = [];
    for (const m of Object.values(this.modelos)) for (const p of Object.values(m.partes)) {
      const P = p.userData.pessoas; if (!P || !p.userData.feito || !P.area?.length) continue;
      pedidos.push({ tipo: 'area', P, n: m.id === 'praca' ? Math.max(P.n || 0, 110) : P.n || 20 });
    }
    for (const m of Object.values(this.modelos)) if (m.caminho && m.partes.e1?.userData.feito) pedidos.push({ tipo: 'linha', pts: m.caminho, n: 10 });
    for (const [k, f] of Object.entries(this.faixas)) {
      const nv = Math.max(0, ...f.mods.map((md) => md.nivel)); if (typeof f.caminhoTeto !== 'function' || (k !== 'anel' && nv < 3) || nv < 1) continue;
      let c = null; try { c = f.caminhoTeto(); } catch (_) { c = null; }
      const linhas = !c?.length ? [] : typeof c[0][0] === 'number' ? [c] : c;
      const n = k === 'anel' ? 40 : 12; linhas.forEach((l) => l.length > 1 && pedidos.push({ tipo: 'linha', pts: l.map((q) => (q.length === 3 ? q : [q[0], f.alturaTopo(nv), q[1]])), n: Math.round(n / linhas.length) }));
    }
    const total = pedidos.reduce((s, x) => s + x.n, 0), lim = Math.min(C.max, GENTE[this.e.q?.id] || 200), k = total > lim ? lim / total : 1;
    for (const q of pedidos) {
      const n = Math.floor(q.n * k + R());
      if (q.tipo === 'linha') { for (let i = 0; i < n; i++) C.add(q.pts, { speed: 0.12 + R() * 0.06, phase: R(), idle: R() < 0.3 ? 1 : 0 }); continue; }
      const { area, y = 0.03 } = q.P; let bx0 = 1e9, bz0 = 1e9, bx1 = -1e9, bz1 = -1e9; for (const [x, z] of area) { bx0 = Math.min(bx0, x); bz0 = Math.min(bz0, z); bx1 = Math.max(bx1, x); bz1 = Math.max(bz1, z); }
      const livre = (a, c) => [0.25, 0.5, 0.75].every((t) => { const x = a[0] + (c[0] - a[0]) * t, z = a[1] + (c[1] - a[1]) * t; return inPoly(x, z, area) && !naAgua(x, z); }); // o trecho inteiro fora da água
      const ponto = () => { for (let t = 0; t < 40; t++) { const x = bx0 + R() * (bx1 - bx0), z = bz0 + R() * (bz1 - bz0); if (inPoly(x, z, area) && !naAgua(x, z)) return [x, z]; } return null; };
      for (let i = 0; i < n; i++) {
        const pts = []; let a = ponto(); if (!a) continue; pts.push([a[0], y, a[1]]);
        for (let s = 0; s < 3; s++) { let b = null; for (let t = 0; t < 12 && !b; t++) { const c = ponto(); if (c && livre(a, c)) b = c; } if (!b) break; pts.push([b[0], y, b[1]]); a = b; }
        if (pts.length > 1) C.add(pts, { speed: 0.1 + R() * 0.08, idle: 1, phase: R() });
      }
    }
    C.mesh.visible = C.walkers.length > 0;
  }
  // ------------------------------------------------------------ fusão
  // fontes que podem ser fundidas, com uma assinatura que muda quando o conteúdo muda
  _fontes() {
    const F = new Map();
    for (const m of Object.values(this.modelos)) for (const p of Object.values(m.partes)) if (p.userData.feito && !p.userData.manadas && !p.userData.update) F.set(p, 'p' + p.children.length);
    for (const f of Object.values(this.faixas)) { F.set(f.merged, filhos(f.merged)); F.set(f.extras, filhos(f.extras)); }
    F.set(this.casas.group, this.casas.mods.map((m) => (m.g ? m.g.uuid : '-')).join());
    if (this.canteiro.visible) for (const g of Object.values(this.predios)) if (g.userData.pronto && !g.userData.animando) F.set(g, 'q');
    return F;
  }
  _caixa(o, nova = false) { let b = nova ? null : this._caixas.get(o); if (!b) { b = new THREE.Box3().setFromObject(o); if (!nova) this._caixas.set(o, b); } return b; }
  // o que a fonte põe em cada material (cache pela assinatura); quadrante pelo centro da caixa
  _contrib(f, ass) {
    const c0 = this._cache.get(f); if (c0 && c0.ass === ass) return c0;
    const por = new Map(), tris = new Map();
    const add = (o, item, sem) => { const g = o.geometry, mat = o.material; if (!g?.attributes?.position || !mat || Array.isArray(mat)) return; const k = mat.uuid + (o.castShadow ? 'c' : 'n') + (sem ? 's' : ''); let l = por.get(k); if (!l) por.set(k, (l = { mat, cast: o.castShadow, sem, itens: [] })); l.itens.push(item); tris.set(k, (tris.get(k) || 0) + (g.index ? g.index.count : g.attributes.position.count) / 3); };
    const anda = (o, raiz, sem) => {
      if (!raiz && !o.visible) return; sem = sem || !!o.userData.semHAO;
      if (o.isInstancedMesh) { for (let i = 0; i < o.count; i++) add(o, { g: o.geometry, o, i }, sem); return; }
      if (o.isMesh) add(o, { g: o.geometry, m: o.matrixWorld }, sem);
      for (const ch of o.children) anda(ch, false, sem);
    };
    anda(f, true, false);
    const b = this._caixa(f, true); const cx = b.isEmpty() ? 0 : (b.min.x + b.max.x) / 2, cz = b.isEmpty() ? 0 : (b.min.z + b.max.z) / 2;
    const c = { ass, por, tris, quad: (cx < 0 ? 0 : 1) + (cz < 2 ? 0 : 2) }; this._cache.set(f, c); return c;
  }
  _chave(k, quad) { const kq = k + ':' + quad; return this._grandes.has(kq) ? kq : k; }
  _malha(fk, b, blocos) {
    const { geo, faixas } = fundirLista(blocos); const mesh = new THREE.Mesh(geo, b.mat); mesh.castShadow = b.cast; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.raycast = () => {};
    mesh.userData.chave = fk; mesh.userData.base = b.base; mesh.userData.faixas = faixas; mesh.userData.cullCaixa = geo.boundingBox; if (b.sem) mesh.userData.semHAO = true;
    this._malhas.set(fk, mesh); for (const [f] of faixas) { let n = this._naFusao.get(f); if (!n) this._naFusao.set(f, (n = { ass: null, chaves: new Set() })); n.chaves.add(fk); }
    return mesh;
  }
  // Fusão completa e síncrona (carga, composição completa, testes). Materiais com mais de 5 mil
  // triângulos são divididos em 4 quadrantes da mesa (descarte por visão nos closes).
  refundirAgora() {
    this._cancelar(); const t0 = performance.now();
    const fontes = this._fontes(); this.root.updateMatrixWorld(true);
    const tot = new Map(), totQ = new Map(), cs = new Map();
    for (const [f, ass] of fontes) { const c = this._contrib(f, ass); cs.set(f, c); for (const [k, n] of c.tris) { tot.set(k, (tot.get(k) || 0) + n); const kq = k + ':' + c.quad; totQ.set(kq, (totQ.get(kq) || 0) + n); } }
    // quadrante próprio só para material grande (> 5 mil triângulos) e pedaço que valha uma chamada (> 2 mil)
    this._grandes = new Set([...totQ].filter(([kq, n]) => n > 2000 && tot.get(kq.slice(0, kq.lastIndexOf(':'))) > 5000).map(([kq]) => kq));
    const porChave = new Map();
    for (const [f, c] of cs) for (const [k, l] of c.por) { const fk = this._chave(k, c.quad); let b = porChave.get(fk); if (!b) porChave.set(fk, (b = { ...l, base: k, blocos: [] })); b.blocos.push([f, l.itens]); }
    const velho = this.fundido; const novo = new THREE.Group(); novo.name = 'fundido';
    this._malhas = new Map(); this._naFusao = new Map();
    for (const [fk, b] of porChave) novo.add(this._malha(fk, b, b.blocos));
    this.root.add(novo); this.fundido = novo;
    if (velho) { this.root.remove(velho); for (const c of velho.children) c.geometry.dispose(); }
    for (const [f, ass] of fontes) { let n = this._naFusao.get(f); if (!n) this._naFusao.set(f, (n = { ass, chaves: new Set() })); n.ass = ass; f.visible = false; }
    this._soltas.clear(); this.refusaoPendente = false;
    this.e.shadowDirty = true; this.e.marcarHAO?.(); this._sujarPicks();
    this.stats.refusaoMs = performance.now() - t0;
    return this.fundido.children.length;
  }
  // Barato (chamado a cada aprovação, módulo ou prédio): tira do fundido, na hora, só as fontes que
  // mudaram e as mostra soltas; a refusão dos materiais afetados fica para depois (2,5 s, no máximo 6 s).
  refundir() {
    if (!this.fundido) return this.refundirAgora();
    const t0 = performance.now(); const fontes = this._fontes();
    const cortar = []; for (const [f, n] of this._naFusao) if (fontes.get(f) !== n.ass) cortar.push(f);
    if (cortar.length) this._recortar(cortar);
    let novas = 0;
    for (const [f] of fontes) if (!this._naFusao.has(f) && !this._soltas.has(f)) { f.visible = true; this._soltas.add(f); novas++; }
    for (const f of [...this._soltas]) if (!fontes.has(f)) this._soltas.delete(f);
    if (this._soltas.size) this._agendar();
    if (cortar.length || novas) { this.e.shadowDirty = true; this.e.marcarHAO?.(); this._sujarPicks(); }
    this.stats.refundirMs = performance.now() - t0;
    return this.fundido.children.length;
  }
  _recortar(lista) {
    const porMalha = new Map();
    for (const f of lista) { const n = this._naFusao.get(f); if (!n) continue; for (const fk of n.chaves) { const m = this._malhas.get(fk); if (!m) continue; let s = porMalha.get(m); if (!s) porMalha.set(m, (s = new Set())); s.add(f); } this._naFusao.delete(f); }
    for (const [mesh, fora] of porMalha) { // compacta o índice no lugar e envia só o trecho que mudou
      const g = mesh.geometry, idx = g.index, arr = idx.array; const nov = []; let w = 0, ini = -1;
      for (const [f, i0, i1] of mesh.userData.faixas) { if (fora.has(f)) { if (ini < 0) ini = w; continue; } if (w !== i0) arr.copyWithin(w, i0, i1); nov.push([f, w, w + i1 - i0]); w += i1 - i0; }
      mesh.userData.faixas = nov; g.setDrawRange(0, w); mesh.visible = w > 0;
      if (ini >= 0 && w > ini) { idx.clearUpdateRanges(); idx.addUpdateRange(ini, w - ini); idx.needsUpdate = true; }
    }
  }
  _agendar() {
    const agora = performance.now(); this.refusaoPendente = true; if (!this._pedido0) this._pedido0 = agora;
    clearTimeout(this._tRef); this._tRef = setTimeout(() => this._refundirSoltas(), Math.max(0, Math.min(2500, this._pedido0 + 6000 - agora)));
  }
  _cancelar() { clearTimeout(this._tRef); this._tRef = 0; this._pedido0 = 0; }
  // refunde só as malhas (material + quadrante) que recebem as fontes soltas; a antiga sai depois
  _refundirSoltas() {
    this._cancelar(); const t0 = performance.now();
    const fontes = this._fontes(); const soltas = [...this._soltas].filter((f) => fontes.has(f)); this._soltas.clear();
    if (!soltas.length || !this.fundido) { this.refusaoPendente = false; return; }
    this.root.updateMatrixWorld(true);
    const af = new Map(); for (const f of soltas) { const c = this._contrib(f, fontes.get(f)); for (const [k, l] of c.por) { const fk = this._chave(k, c.quad); if (!af.has(fk)) af.set(fk, { ...l, base: k }); } }
    const velhas = [];
    for (const [fk, b] of af) {
      const velha = this._malhas.get(fk); const blocos = [];
      if (velha) for (const [f] of velha.userData.faixas) { const it = this._cache.get(f)?.por.get(b.base)?.itens; if (it) blocos.push([f, it]); }
      for (const f of soltas) { const c = this._cache.get(f); const l = c.por.get(b.base); if (l && this._chave(b.base, c.quad) === fk) blocos.push([f, l.itens]); }
      this.fundido.add(this._malha(fk, b, blocos)); if (velha) velhas.push(velha);
    }
    for (const v of velhas) { this.fundido.remove(v); v.geometry.dispose(); }
    for (const f of soltas) { let n = this._naFusao.get(f); if (!n) this._naFusao.set(f, (n = { ass: null, chaves: new Set() })); n.ass = fontes.get(f); f.visible = false; }
    this.refusaoPendente = false; this.stats.refusaoMs = performance.now() - t0;
  }
  // ------------------------------------------------------------ toque
  _picks() {
    this._picksSujo = false; this.root.updateMatrixWorld(true); const P = [], F = [];
    for (const m of Object.values(this.modelos)) { const pk = m.root.userData.pick; for (const p of Object.values(m.partes)) { if (!p.children.length) continue; (p.userData.feito ? P : F).push({ box: this._caixa(p), pick: pk, fonte: p }); } }
    for (const f of Object.values(this.faixas)) { const pk = f.group.userData.pick; f.mods.forEach((md, i) => { if (md.nivel > 0 || md.lote) P.push({ box: this._caixaModulo(f, i), pick: pk, faixa: f, i }); }); }
    const cp = this.casas.group.userData.pick; for (const md of this.casas.mods) if (md.g) P.push({ box: this._caixa(md.g, true), pick: cp, fonte: md.g });
    if (this.canteiro.visible) for (const g of Object.values(this.predios)) if (g.userData.pronto || g.visible) P.push({ box: this._caixa(g, true), pick: g.userData.pick, fonte: g });
    this.picks = P; this.picksFuturos = F; this._prepararGrades();
  }
  _caixaModulo(f, i) {
    const md = f.mods[i], p = f.prof, nor = normals(md.path, false), b = new THREE.Box3();
    for (let k = 0; k < md.path.length; k++) for (const o of [p.o0, p.o1]) b.expandByPoint(_v.set(md.path[k][0] + nor[k][0] * o, 0, md.path[k][1] + nor[k][1] * o));
    b.min.y = (p.y0 || 0) - 0.05; b.max.y = f.alturaTopo(Math.max(0, md.nivel)); return b;
  }
  _proxy(pick) { let o = this._proxies.get(pick); if (!o) { o = new THREE.Object3D(); o.userData.pick = pick; this._proxies.set(pick, o); } return o; }
  // acerto exato: fitas por marcha analítica no perfil em terraços (sem testar milhares de triângulos);
  // o resto pela geometria da fonte (mesmo escondida, já que o fundido não entra no raycast)
  _exato(rc, c) {
    if (c.faixa) return this._faixaHit(rc.ray, c);
    const out = this._hits; out.length = 0; let best = null;
    const anda = (o) => { // malhas grandes (e instanciadas) pela grade; as pequenas pelo three
      if (o.isMesh && trisDe(o) > 400) {
        const G = this._grade(o); const d = raioGrade(G, rc.ray); if (d != null && (!best || d < best.distance)) best = { distance: d, point: rc.ray.at(d, new THREE.Vector3()) };
      } else if (o.isMesh) { out.length = 0; o.raycast(rc, out); for (const h of out) if (!best || h.distance < best.distance) best = h; }
      if (!o.isInstancedMesh) for (const ch of o.children) anda(ch);
    };
    anda(c.fonte); return best;
  }
  _sujarPicks() { this._picksSujo = true; clearTimeout(this._tPk); this._tPk = setTimeout(() => { if (this._picksSujo) this._picks(); }, 400); }
  _grade(o) { let G = this._grades.get(o); if (!G || G.g !== o.geometry || G.n !== (o.isInstancedMesh ? o.count : 1)) { G = gradeDe(o); this._grades.set(o, G); } return G; }
  // grades das peças prontas feitas aos poucos (3 ms por vez), para o 1º toque não pagar a montagem
  _prepararGrades() {
    clearTimeout(this._tGr); const fila = [];
    for (const p of this.picks) if (p.fonte) p.fonte.traverse((o) => { if (o.isMesh && trisDe(o) > 400 && !this._grades.has(o)) fila.push(o); });
    const passo = () => { const t0 = performance.now(); while (fila.length && performance.now() - t0 < 3) this._grade(fila.pop()); if (fila.length) this._tGr = setTimeout(passo, 40); };
    this._tGr = setTimeout(passo, 300);
  }
  _faixaHit(ray, c) {
    const f = c.faixa, md = f.mods[c.i], p = f.prof, fh = p.fh || FH, y0 = p.y0 || 0;
    if (md.nivel <= 0) return { distance: c.d, point: c.p }; // lote vazio: a placa no chão
    let nor = this._nor.get(md); if (!nor) this._nor.set(md, (nor = normals(md.path, false)));
    const L = c.box.getSize(_v).length(), passo = Math.min(0.06, L / 48), o = ray.origin, d = ray.direction, P = md.path, n = P.length;
    for (let t = c.d; t <= c.d + L; t += passo) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t; let fl = Math.floor((y - y0) / fh); if (fl >= md.nivel && y - y0 < md.nivel * fh + 0.15) fl = md.nivel - 1; if (fl < 0 || fl >= md.nivel) continue; // (laje e floreiras do topo)
      let kb = 0, db = 1e9; for (let k = 0; k < n; k++) { const dx = x - P[k][0], dz = z - P[k][1], q = dx * dx + dz * dz; if (q < db) { db = q; kb = k; } }
      const dx = x - P[kb][0], dz = z - P[kb][1]; const off = dx * nor[kb][0] + dz * nor[kb][1];
      if ((kb === 0 || kb === n - 1) && Math.abs(dx * nor[kb][1] - dz * nor[kb][0]) > 0.15) continue; // além da ponta do módulo
      if (off >= p.o0 + (p.setIn || 0) * fl - 0.1 && off <= p.o1 - (p.setOut || 0) * fl + 0.1) return { distance: t, point: new THREE.Vector3(x, y, z) };
    }
    return null;
  }
  // caixas atravessadas pelo raio, da mais próxima; refina até achar um acerto que nenhuma caixa
  // seguinte possa superar (no máximo 8)
  _raio(rc, lista) {
    const ray = rc.ray, cand = [];
    for (const p of lista) if (ray.intersectBox(p.box, _v)) cand.push({ ...p, d: _v.distanceTo(ray.origin), p: _v.clone() });
    if (!cand.length) return null; cand.sort((a, b) => a.d - b.d);
    let best = null;
    for (let k = 0; k < Math.min(8, cand.length); k++) { const c = cand[k]; if (best && c.d > best.distancia) break; const h = this._exato(rc, c); if (h && (!best || h.distance < best.distancia)) best = { pick: c.pick, point: h.point.clone(), distancia: h.distance }; }
    return best;
  }
  // Toque: caixas de seleção, refinadas só nas candidatas mais próximas. Peças ainda não construídas
  // só respondem se nada construído for acertado (tocar o lote de uma obra futura abre o projeto).
  pick(rc) {
    const t0 = performance.now(); if (this._picksSujo) this._picks();
    const h = this._raio(rc, this.picks) || this._raio(rc, this.picksFuturos);
    this.stats.rayMs = performance.now() - t0; return h;
  }
  // Planta holográfica da composição total (tudo pronto), numa única malha azul translúcida.
  fantasma() {
    if (this._fantasma) return this._fantasma;
    this.root.updateMatrixWorld(true); const list = []; const I = new THREE.Matrix4();
    const anda = (o) => { if (o.isInstancedMesh) { if (o.count > 400) return; for (let i = 0; i < o.count; i++) list.push({ g: o.geometry, o, i }); return; } if (o.isMesh && !o.material.transparent) list.push({ g: o.geometry, m: o.matrixWorld }); for (const c of o.children) anda(c); };
    for (const m of Object.values(this.modelos)) for (const p of Object.values(m.partes)) anda(p);
    for (const f of Object.values(this.faixas)) for (let i = 0; i < f.mods.length; i++) for (const g of f._geo(i, f.max).values()) list.push({ g, m: I });
    const casas = new THREE.Group(); casas.position.copy(this.casas.group.position); casas.rotation.copy(this.casas.group.rotation); for (const m of this.casas.mods) casas.add(this.casas._casa(m, this.casas.max)); casas.updateMatrixWorld(true); anda(casas);
    const { geo } = fundirLista([[null, list]]); geo.deleteAttribute('uv'); if (geo.attributes.color) geo.deleteAttribute('color');
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x4fc8ff), transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 6; mesh.frustumCulled = false; mesh.visible = false; this.root.add(mesh); this._fantasma = mesh; return mesh;
  }
  mostrarFantasma(on, ms = 900) {
    const f = this.fantasma(); const mat = f.material; const de = f.visible ? mat.opacity : 0, para = on ? 0.16 : 0; f.visible = true; const t0 = performance.now();
    this.e.acordar?.(ms + 100);
    const passo = (t) => { const k = Math.min(1, (t - t0) / ms); mat.opacity = de + (para - de) * k; if (k < 1) requestAnimationFrame(passo); else if (!on) f.visible = false; }; requestAnimationFrame(passo);
  }
  update(dt, t) {
    tempoAnimais.value = t / 1000;
    for (const p of this.animados) { if (p.userData.manadas) for (const m of p.userData.manadas) m.update(dt, t); if (p.userData.update) p.userData.update(t); }
    if (this.povo.mesh.visible) this.povo.update(dt, t);
    const noite = this.e.modoLuz === 'noite'; this.bando.mesh.visible = !noite; if (!noite) this.bando.update(dt, t);
    this.blobs.mesh.material.uniforms.opac.value = noite ? 0.2 : 0.35;
  }
}
