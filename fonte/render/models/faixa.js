// Edifício-fita em terraços dividido em módulos (como as zonas residenciais do BuildIt):
// cada módulo sobe um andar por nível. Os módulos estáveis são fundidos por material.
// Linguagem da foto (Bosco Verticale / BIG / Zaha): cada laje é um beiral grosso de concreto claro com
// floreira contínua e vegetação pendente (instanciada por fita: 1 chamada), ripas de madeira na fachada
// externa (1 chamada por fita) e pontas arredondadas nas fitas abertas; um anel pode ter vãos
// (def.aberturas = índices dos cortes que viram abertura, com as pontas afinadas dos dois lados).
import * as THREE from 'three';
import { sweep, terraceFloor, terraceOutline, passeioTeto, skeletonFloor, subPathDenso, pathLength, normals, merge, beamGeo, beamMatrix, medidas, pontaFator, FH } from '../geom.js';
import { M } from '../materials.js';
import { leafMaterial } from '../forest.js';
import { hash } from '../../core/util.js';

// materiais novos do pacote de superfícies podem ainda não existir: cai num parecido
const RESERVA = { roofMetal: 'grey', caminhoTeto: 'concreto', bandaCinza: 'concreto', vidroDossel: 'glass', fasciaBeiral: 'fascia', fac_fita: 'fac_quente', fac_ambar: 'fac_fita', fac_colmeia: 'fac_fita', fac_celular: 'fac_fita', ripa: 'dark' };
export const matDe = (k) => M[k] || M[RESERVA[k]] || M.white;
let _viga = null; // pilar do esqueleto (compartilhado por todas as fitas)
const vigaGeo = () => { if (!_viga) { _viga = beamGeo(0.035, 5); _viga.userData.compartilhada = true; } return _viga; };
const marca = (map) => { for (const g of map.values()) g.userData.compartilhada = true; return map; };
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
// verdes do jardim (albedo linear, os mesmos da mata de paisagismo)
const JARDIM = [[0.12, 0.24, 0.045], [0.085, 0.2, 0.04], [0.15, 0.26, 0.055], [0.19, 0.25, 0.045]];
let _tufo = null, _ripa = null;
// arbusto de 12 triângulos: dois lóbulos em pirâmide hexagonal achatada, mais claros no topo (a folhagem
// e o vento vêm do material das copas); lido de longe como a touceira da floreira
function tufoGeo() {
  if (_tufo) return _tufo;
  const P = [], N = [], C = [], I = [];
  const lobo = (cx, cy, cz, r, h, seed) => {
    const base = P.length / 3; const ax = cx + (hash(seed, 1, 5) - 0.5) * 0.3 * r, az = cz + (hash(seed, 2, 5) - 0.5) * 0.3 * r;
    P.push(ax, cy + h, az); N.push(0, 1, 0); C.push(0.98, 1.04, 0.94);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2, rr = r * (0.85 + hash(k, seed, 3) * 0.3); const nx = Math.cos(a) * 0.75, nz = Math.sin(a) * 0.75, l = Math.hypot(nx, 0.66, nz); P.push(cx + Math.cos(a) * rr, cy + (hash(k, seed, 4) - 0.5) * 0.1 * r, cz + Math.sin(a) * rr); N.push(nx / l, 0.66 / l, nz / l); const v = 0.5 + hash(k, seed, 6) * 0.12; C.push(v * 0.94, v, v * 0.9); }
    for (let k = 0; k < 6; k++) { // orientação: a normal geométrica para cima e para fora
      const a = base, b = base + 1 + k, c = base + 1 + ((k + 1) % 6);
      const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
      const ny = uz * vx - ux * vz; if (ny >= 0) I.push(a, b, c); else I.push(a, c, b);
    }
  };
  lobo(0, 0, 0, 1, 0.75, 1); lobo(0.55, -0.06, 0.35, 0.7, 0.55, 2);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I);
  g.computeBoundingSphere(); g.userData.compartilhada = true; return (_tufo = g);
}
// ripa (brise): um retângulo fino em pé, com a face para fora (escala x = espessura, y = altura)
function ripaGeo() { if (_ripa) return _ripa; const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0); g.userData.compartilhada = true; return (_ripa = g); }

export class Faixa {
  // def: { id, path, closed, prof:{o0,o1,setIn,setOut,fac,facIn,roof,y0,fh,beiral,curb,curbW,slab}, modulos|cortes,
  //        aberturas:[índices de cortes], abertura (largura do vão), ponta (comprimento do afinamento; 0 = reto),
  //        arbustos, arbustoPasso, arbustoMax, ripas, decor(faixa) => objetos extras quando tudo está no nível máximo }
  constructor(def) {
    this.def = def; this.id = def.id; this.group = new THREE.Group(); this.group.name = def.id;
    this.L = pathLength(def.path, def.closed);
    const n = def.modulos || 1; const cuts = def.cortes || Array.from({ length: n + 1 }, (_, i) => i / n); const nc = cuts.length - 1;
    this.prof = { fac: 'fac_fita', roof: 'roof', ...def.prof };
    const p = this.prof; this.oc = (p.o0 + p.o1) / 2; // eixo do perfil (as pontas afinam em torno dele)
    const Lt = def.ponta ?? Math.max(0.35, 0.6 * (p.o1 - p.o0)); const meio = (def.abertura ?? 1.2) / 2, gap = def.gap ?? 0;
    const ab = new Set(def.aberturas || []); const aberto = (c) => (def.closed ? ab.has(c % nc) : c === 0 || c === nc || ab.has(c));
    this.mods = [];
    for (let i = 0; i < nc; i++) {
      const s0 = cuts[i], s1 = cuts[i + 1]; const a0 = aberto(i), a1 = aberto(i + 1);
      const g0 = a0 ? (!def.closed && i === 0 ? 0 : meio) : gap, g1 = a1 ? (!def.closed && i === nc - 1 ? 0 : meio) : gap;
      const { pts, s, L } = subPathDenso(def.path, def.closed, s0 + g0 / this.L, s1 - g1 / this.L, def.passo ?? 0.26, a0 && Lt > 0 ? Lt : 0, a1 && Lt > 0 ? Lt : 0);
      const afina = Lt > 0 && (a0 || a1); const W = s.map((d) => Math.min(a0 ? pontaFator(d, Lt) : 1, a1 ? pontaFator(L - d, Lt) : 1));
      this.mods.push({ i, s0, s1, path: pts, W, afina, caps: a0 && a1 ? true : a0 ? 'ini' : a1 ? 'fim' : false, ab0: a0, ab1: a1, u0: s0 * this.L, nivel: 0, emObra: false });
    }
    this.cache = new Map(); this.cacheAndar = new Map();
    this.merged = new THREE.Group(); this.merged.name = def.id + '-fundido'; this.group.add(this.merged);
    this.soltos = new THREE.Group(); this.group.add(this.soltos);
    this.lotes = new THREE.Group(); this.lotes.name = def.id + '-lotes'; this.group.add(this.lotes);
    this.extras = new THREE.Group(); this.group.add(this.extras);
  }
  get max() { return this.def.niveis || 5; }
  // opções da varredura de um módulo (afinamento das pontas em torno do eixo do perfil)
  _opts(m, extra = {}) { return { u0: m.u0, caps: m.caps, width: m.afina ? (t, k) => m.W[k] : null, widthCenter: this.oc, ...extra }; }
  // geometria de um módulo com F andares (em cache: reaproveitada pela fusão e pela planta)
  _geo(i, F) {
    const k = i + ':' + F; if (this.cache.has(k)) return this.cache.get(k);
    const m = this.mods[i]; const E = []; for (let f = 0; f < F; f++) E.push(...terraceFloor(f, F, this.prof));
    const map = marca(sweep(m.path, false, E, this._opts(m, { capPoly: terraceOutline(F, this.prof) }))); this.cache.set(k, map); return map;
  }
  // reconstrói a malha fundida com todos os módulos que não estão em obra; o fundido anterior
  // (fora do cache) é descartado
  refresh() {
    for (const c of this.merged.children.slice()) { this.merged.remove(c); c.geometry.dispose(); }
    const by = new Map();
    for (const m of this.mods) { if (m.nivel <= 0) continue; for (const [k, g] of this._geo(m.i, m.nivel)) { if (!by.has(k)) by.set(k, []); by.get(k).push([g, new THREE.Matrix4()]); } }
    for (const [k, list] of by) { const mesh = new THREE.Mesh(merge(list), matDe(k)); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.matKey = k; this.merged.add(mesh); }
    this._extras(); this._lotes();
  }
  setNivel(i, n) { this.mods[i].nivel = n; this.refresh(); }
  setTodos(n) { for (const m of this.mods) m.nivel = n; this.refresh(); }
  // peças para a obra do andar f (0..) de um módulo que terá F andares. As geometrias ficam em cache
  // (marcadas como compartilhadas): abrir a prancha várias vezes não cria geometria nova na GPU.
  andar(i, f, F) {
    const key = i + ':' + f + ':' + F; let c = this.cacheAndar.get(key);
    if (!c) {
      const m = this.mods[i]; const p = this.prof; const fh = p.fh || FH; const y0 = (p.y0 || 0) + f * fh;
      const acab = marca(sweep(m.path, false, terraceFloor(f, F, p), this._opts(m, { capPoly: terraceOutline(F, p, f, f + 1) }))); const esq = marca(sweep(m.path, false, skeletonFloor(f, p), this._opts(m, { caps: false })));
      const outer = p.o1 - (p.setOut || 0) * f - 0.06, inner = p.o0 + (p.setIn || 0) * f + 0.06;
      const nor = normals(m.path, false); const mats = [];
      for (let k = 0; k < m.path.length; k += 3) { const [x, z] = m.path[k], [nx, nz] = nor[k]; const w = m.W[k]; for (const o of [outer, inner]) { const oo = this.oc + (o - this.oc) * w; mats.push(beamMatrix([x + nx * oo, y0, z + nz * oo], [x + nx * oo, y0 + fh, z + nz * oo])); } }
      c = { acab, esq, mats }; this.cacheAndar.set(key, c);
    }
    const acabado = new THREE.Group(); const esqueleto = new THREE.Group();
    for (const [k, g] of c.acab) { const mesh = new THREE.Mesh(g, matDe(k)); mesh.castShadow = true; mesh.receiveShadow = true; acabado.add(mesh); }
    for (const g of c.esq.values()) { const mesh = new THREE.Mesh(g, M.concreto); mesh.castShadow = true; esqueleto.add(mesh); }
    const im = new THREE.InstancedMesh(vigaGeo(), M.concreto, c.mats.length); c.mats.forEach((mt, k) => im.setMatrixAt(k, mt)); im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); esqueleto.add(im);
    esqueleto.visible = false;
    return { acabado, esqueleto, caminho: { path: this.mods[i].path, closed: false, o: this.prof.o1 + 0.2 } };
  }
  // contorno do lote vazio (planta no chão)
  _lotes() {
    for (const c of this.lotes.children.slice()) { this.lotes.remove(c); c.geometry?.dispose(); }
    const p = this.prof; const y = (p.y0 || 0) + 0.035;
    for (const m of this.mods) {
      if (m.nivel > 0 || m.emObra || !m.lote) continue;
      const E = [{ a: [p.o0, y], b: [p.o1, y], mat: 'fill', uv: 'plan' }];
      const E2 = [{ a: [p.o1 - 0.16, y + 0.003], b: [p.o1, y + 0.003], mat: 'line', uv: 'plan' }, { a: [p.o0, y + 0.003], b: [p.o0 + 0.16, y + 0.003], mat: 'line', uv: 'plan' }];
      for (const [k, g] of sweep(m.path, false, [...E, ...E2], this._opts(m, { caps: false }))) { const mesh = new THREE.Mesh(g, k === 'line' ? M.loteLinha : M.loteFill); mesh.renderOrder = 3; this.lotes.add(mesh); }
    }
  }
  // Vegetação das floreiras (arbustos a cada ~0.55 na borda de cada beiral, 60% pendendo para fora, mais uma
  // fileira nas bordas da cobertura), ripas de madeira na fachada externa (uma por vão) e a decoração do
  // nível máximo (def.decor). Tudo instanciado por fita: 1 chamada para os arbustos, 1 para as ripas.
  _extras() {
    for (const c of this.extras.children.slice()) { this.extras.remove(c); if (!c.userData.keep) c.traverse((o) => o.isInstancedMesh && o.dispose()); }
    const p = this.prof; const md = medidas(p); const arb = [], rip = []; const passo = this.def.arbustoPasso ?? 0.62; const oc = this.oc;
    for (const m of this.mods) {
      if (m.nivel <= 0) continue; const F = m.nivel; const nor = normals(m.path, false); const N = m.path.length;
      const cum = [0]; for (let k = 1; k < N; k++) cum.push(cum[k - 1] + Math.hypot(m.path[k][0] - m.path[k - 1][0], m.path[k][1] - m.path[k - 1][1]));
      const fila = (o, y, lado, sd, esp, dy0 = 0) => { // uma fileira de arbustos no deslocamento o, altura y
        let prox = hash(sd, m.i, 71) * esp;
        for (let k = 0; k < N; k++) {
          if (cum[k] < prox) continue; prox = cum[k] + esp * (0.75 + hash(k, sd, 72) * 0.5);
          const w = m.W[k]; if (w < 0.5) continue; // nas pontas afinadas a floreira some
          const h = hash(k, sd * 7 + m.i * 13, 73); const pende = lado && h < 0.6; const oo = oc + (o - oc) * w + (pende ? 0.05 * lado : 0);
          const [x, z] = m.path[k], [nx, nz] = nor[k];
          arb.push([x + nx * oo, y + dy0 + (pende ? -0.05 : 0), z + nz * oo, 0.1 + hash(k, sd, 74) * 0.06, h]);
        }
      };
      if (this.def.arbustos !== false) {
        for (let lv = 1; lv <= F; lv++) { const y = md.y(lv) + md.slab + md.curb; fila(md.eO(lv) - md.curbW / 2, y, 1, lv * 2, passo); fila(md.eI(lv) + md.curbW / 2, y, -1, lv * 2 + 1, passo); }
        // cobertura: segunda fileira por dentro das floreiras, fora do passeio (teto largo)
        const a = md.eO(F) - md.curbW, b = md.eI(F) + md.curbW; if (a - b > 0.8) { const y = md.y(F) + md.slab; fila(a - 0.16, y, 0, 90, passo * 1.6); fila(b + 0.16, y, 0, 91, passo * 1.6); }
      }
      if (this.def.ripas !== false) for (let f = 0; f < F; f++) {
        const g = md.gO(f) + 0.012, y0 = md.y(f) + md.slab, h = md.fh - md.slab; let prox = 0.17;
        for (let k = 0; k < N; k++) { if (cum[k] < prox) continue; prox = cum[k] + 0.34; const w = m.W[k]; if (w < 0.6) continue; const oo = oc + (g - oc) * w; const [x, z] = m.path[k], [nx, nz] = nor[k]; rip.push([x + nx * oo, y0, z + nz * oo, h, Math.atan2(nx, nz)]); }
      }
    }
    const max = this.def.arbustoMax ?? 1300; const lista = arb.length > max ? arb.filter((_, i) => i % Math.ceil(arb.length / max) === 0) : arb;
    if (lista.length) {
      const im = new THREE.InstancedMesh(tufoGeo(), leafMaterial(), lista.length);
      lista.forEach(([x, y, z, s, h], i) => {
        _e.set((hash(i, 1, 76) - 0.5) * 0.3, h * 6.28, (hash(i, 2, 76) - 0.5) * 0.3); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(s * (0.9 + hash(i, 3, 76) * 0.3), s * 0.85, s * (0.9 + hash(i, 4, 76) * 0.3));
        im.setMatrixAt(i, _m4.compose(_p, _q, _s)); const c = JARDIM[(h * JARDIM.length) | 0], v = 0.85 + hash(i, 5, 77) * 0.3; im.setColorAt(i, _c.setRGB(c[0] * v, c[1] * v, c[2] * v));
      });
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.castShadow = false; im.receiveShadow = true; im.computeBoundingSphere(); im.name = this.id + '-arbustos'; this.extras.add(im);
    }
    if (rip.length) {
      const im = new THREE.InstancedMesh(ripaGeo(), matDe('ripa'), rip.length);
      rip.forEach(([x, y, z, h, ry], i) => { _e.set(0, ry, 0); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(0.022, h, 1); im.setMatrixAt(i, _m4.compose(_p, _q, _s)); });
      im.instanceMatrix.needsUpdate = true; im.castShadow = false; im.receiveShadow = true; im.computeBoundingSphere(); im.name = this.id + '-ripas'; this.extras.add(im);
    }
    if (this.def.decor && this.mods.every((m) => m.nivel >= this.max)) { if (!this._decor) { this._decor = new THREE.Group(); this._decor.name = this.id + '-decor'; this._decor.userData.keep = true; for (const o of this.def.decor(this)) this._decor.add(o); } this.extras.add(this._decor); }
  }
  // Passeio claro do teto (para as pessoas): polilinhas [x, y, z] pelo meio da cobertura dos módulos
  // prontos; módulos vizinhos no mesmo nível viram uma linha só (não através dos vãos). Vazio se a fita não
  // tem passeio.
  caminhoTeto() {
    const p = this.prof; if (p.roof !== 'roof' || p.passeio === false) return [];
    const fh = p.fh || FH; const out = []; let cur = null, nivCur = -1;
    for (const m of this.mods) {
      const F = m.nivel; const pt = F > 0 ? passeioTeto(F, p) : null; if (!pt) { cur = null; nivCur = -1; continue; }
      const o = (pt[0] + pt[1]) / 2, y = (p.y0 || 0) + F * fh + 0.09; const nor = normals(m.path, false); const N = m.path.length;
      const ks = []; for (let k = 0; k < N - 1; k += 2) ks.push(k); ks.push(N - 1); // um ponto a cada 2, e sempre o último
      const pts = ks.map((k) => { const oo = this.oc + (o - this.oc) * m.W[k]; return [+(m.path[k][0] + nor[k][0] * oo).toFixed(3), y, +(m.path[k][1] + nor[k][1] * oo).toFixed(3)]; });
      if (cur && nivCur === F && !m.ab0) cur.push(...pts.slice(1)); else { cur = pts; out.push(cur); } nivCur = F;
    }
    if (this.def.closed && out.length > 1 && !this.mods[0].ab0 && this.mods[0].nivel === this.mods[this.mods.length - 1].nivel && this.mods[0].nivel > 0) { const ult = out.pop(); out[0] = [...ult, ...out[0].slice(1)]; }
    return out.filter((l) => l.length > 1);
  }
  // centro aproximado de um módulo (para balões e câmera)
  centro(i) { const m = this.mods[i]; const q = m.path[(m.path.length / 2) | 0]; const nor = normals(m.path, false)[(m.path.length / 2) | 0]; const o = (this.prof.o0 + this.prof.o1) / 2; return [q[0] + nor[0] * o, q[1] + nor[1] * o]; }
  alturaTopo(n) { const p = this.prof; return (p.y0 || 0) + n * (p.fh || FH) + 0.1; }
}
