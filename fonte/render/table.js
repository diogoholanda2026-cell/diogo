// A mesa de exposição: bandeja de madeira, guarda-corpo de vidro na frente e na lateral direita,
// placa de latão com o título gravado, pedestal com rodapé e o visitante em escala (como na foto).
import * as THREE from 'three';
import { MESA } from '../data/planta.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { tex } from './textures.js';
import { M } from './materials.js';

export const BORDA = { t: 1.3, topo: 1.15, frente: 0.55, base: -6.5 };

// a mesa fica fora da oclusão por campo de alturas (o mapa só cobre o terreno; abaixo de y=0 ele
// escureceria à toa a frente, a placa e o pedestal): marca semHAO e já declara o uniforme, e o
// gancho de oclusão encadeado depois não se aplica
function semHAO(m) { m.userData.semHAO = true; m.onBeforeCompile = (sh) => { sh.uniforms.tHAO = sh.uniforms.tHAO || { value: null }; }; m.customProgramCacheKey = () => 'semHAO'; return m; }

// caixa de madeira já posicionada, com o veio em coordenadas de mundo (as peças se fundem sem emenda)
function woodGeo(w, h, d, x, y, z, L = 7) {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const X = p.getX(i) + x, Y = p.getY(i) + y, Z = p.getZ(i) + z; const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    if (ax > 0.5) uv.setXY(i, Z / L, Y / (L * 0.25)); else if (ay > 0.5) uv.setXY(i, (w >= d ? X : Z) / L, (w >= d ? Z : X) / (L * 0.25)); else uv.setXY(i, X / L, Y / (L * 0.25));
  }
  g.translate(x, y, z); return g;
}

export class ExhibitTable {
  constructor(engine) {
    this.e = engine; const g = (this.group = new THREE.Group()); g.name = 'mesa'; engine.scene.add(g);
    const wood = tex.nogueira();
    // nogueira escura envernizada: pouco rugosa, reflete a sala quente
    this.walnut = semHAO(new THREE.MeshStandardMaterial({ color: 0xffffff, map: wood, roughness: 0.36, metalness: 0.0, envMapIntensity: 1.0 }));
    this.pedestalMat = semHAO(new THREE.MeshStandardMaterial({ color: 0xd8d8d8, map: wood, roughness: 0.6, envMapIntensity: 0.5 }));
    const { t, topo, frente, base } = BORDA; const { x0, x1, z0, z1 } = MESA; const W = x1 - x0, D = z1 - z0;
    // bandeja: as quatro paredes e o friso arredondado no topo (pega a linha de brilho do verniz) numa
    // só malha (1 chamada)
    const r = 0.08, pecas = [
      woodGeo(W + 2 * t, topo - base, t, (x0 + x1) / 2, (topo + base) / 2, z0 - t / 2), // fundo
      woodGeo(t, topo - base, D, x0 - t / 2, (topo + base) / 2, (z0 + z1) / 2), // esquerda
      woodGeo(t, topo - base, D, x1 + t / 2, (topo + base) / 2, (z0 + z1) / 2), // direita
      woodGeo(W + 2 * t, frente - base, t, (x0 + x1) / 2, (frente + base) / 2, z1 + t / 2), // frente (mais baixa)
    ];
    const friso = (L, x, y, z, eixoX) => { const c = new THREE.CylinderGeometry(r, r, L, 12, 1, false, 0, Math.PI); c.rotateZ(Math.PI / 2); if (!eixoX) c.rotateY(Math.PI / 2); c.translate(x, y, z); pecas.push(c); }; // meia-cana deitada, curva para cima
    friso(W + 2 * t, (x0 + x1) / 2, topo, z0 - t + r, true); friso(W + 2 * t, (x0 + x1) / 2, frente, z1 + t - r, true);
    friso(D + t, x0 - t + r, topo, (z0 + z1 - t) / 2, false); friso(D + t, x1 + t - r, topo, (z0 + z1 - t) / 2, false);
    const band = new THREE.Mesh(mergeGeometries(pecas), this.walnut); band.name = 'bandeja'; band.castShadow = true; band.receiveShadow = true; g.add(band);
    // pedestal recuado, iluminado pela sala por baixo da bandeja (como na foto)
    const ped = new THREE.Mesh(woodGeo(W - 4, 9, D - 4, (x0 + x1) / 2, base - 4.5, (z0 + z1) / 2, 9), this.pedestalMat); ped.name = 'pedestal'; ped.castShadow = true; g.add(ped);
    // rodapé preto rente ao piso e fundo da bandeja sob o terreno (esconde frestas): mesma cor, 1 chamada
    const rg = new THREE.BoxGeometry(W - 3.6, 0.45, D - 3.6); rg.translate((x0 + x1) / 2, base - 9 + 0.225, (z0 + z1) / 2);
    const ug = new THREE.PlaneGeometry(W, D); ug.rotateX(-Math.PI / 2); ug.translate((x0 + x1) / 2, -2.6, (z0 + z1) / 2);
    const rod = new THREE.Mesh(mergeGeometries([rg, ug]), semHAO(new THREE.MeshStandardMaterial({ color: 0x120c09, roughness: 0.5 }))); rod.name = 'rodape'; g.add(rod);
    // piso da sala: disco escuro e fosco (não reflete o painel azul); fora do mapa de alturas
    const floor = new THREE.Mesh(new THREE.CircleGeometry(70, 48), semHAO(new THREE.MeshStandardMaterial({ color: 0x07090d, roughness: 0.95, metalness: 0 })));
    floor.rotation.x = -Math.PI / 2; floor.position.y = base - 9; floor.receiveShadow = true; floor.name = 'piso'; floor.userData.semHAO = true; g.add(floor); this.piso = floor;
    // guarda-corpo de vidro (frente e lateral direita), montantes e corrimão metálico
    const railH = 1.05, zf = z1 + t * 0.55, xr = x1 + t * 0.55;
    // vidro da frente e da lateral numa malha, corrimão da frente e da lateral noutra
    const gf = new THREE.BoxGeometry(W + t, railH, 0.05); gf.translate((x0 + x1) / 2 + t / 2, frente + railH / 2, zf);
    const gr = new THREE.BoxGeometry(0.05, railH, D + t); gr.translate(xr, topo + railH / 2, (z0 + z1) / 2 + t / 2);
    const glass = new THREE.Mesh(mergeGeometries([gf, gr]), M.glassRail); glass.renderOrder = 2; glass.name = 'vidro'; g.add(glass);
    const posts = []; for (let x = x0; x <= x1 + 0.01; x += 4) posts.push([x, frente, zf]); for (let z = z0; z <= z1 + 0.01; z += 4) posts.push([xr, topo, z]);
    const pg = new THREE.CylinderGeometry(0.045, 0.045, railH, 8); pg.translate(0, railH / 2, 0);
    const pim = new THREE.InstancedMesh(pg, M.steel, posts.length); const m4 = new THREE.Matrix4();
    posts.forEach(([x, y, z], i) => pim.setMatrixAt(i, m4.makeTranslation(x, y, z))); pim.castShadow = true; g.add(pim);
    const tf = new THREE.BoxGeometry(W + t, 0.05, 0.1); tf.translate((x0 + x1) / 2 + t / 2, frente + railH, zf);
    const tr = new THREE.BoxGeometry(0.1, 0.05, D + t); tr.translate(xr, topo + railH, (z0 + z1) / 2 + t / 2);
    const top = new THREE.Mesh(mergeGeometries([tf, tr]), M.steel); top.name = 'corrimao'; g.add(top);
    // placa de latão inclinada na face frontal (4:1, como na foto): latão escovado com o texto gravado
    // fosco e escuro (mapa de metal/rugosidade). A face da frente fica por último no índice: 2 chamadas
    // (borda de aço e latão) em vez de 6
    const mr = tex.brassMR();
    this.brass = semHAO(new THREE.MeshStandardMaterial({ color: 0xc0b494, map: tex.brass(), metalness: 0.6, roughness: 1.4, metalnessMap: mr, roughnessMap: mr, envMapIntensity: 2.0 })); // metal 0,54 e rugosidade 0,39 no latão; gravado fosco
    const pgeo = new THREE.BoxGeometry(15, 3.75, 0.12); const ix = Array.from(pgeo.index.array); // faces +x -x +y -y +z -z, 6 índices cada
    pgeo.setIndex([...ix.slice(0, 24), ...ix.slice(30, 36), ...ix.slice(24, 30)]); pgeo.clearGroups(); pgeo.addGroup(0, 30, 0); pgeo.addGroup(30, 6, 1);
    const plate = new THREE.Mesh(pgeo, [M.steelDark, this.brass]);
    plate.position.set(4.2, -2.3, z1 + t + 0.32); plate.rotation.x = -0.32; plate.castShadow = true; plate.name = 'placa'; g.add(plate);
    this.plate = plate;
    // visitante em escala (figura de maquete) na borda da frente, na pose da foto; some quando a câmera
    // chega perto (closes do acelerador e da praça), sem custo: THREE.LOD com um nível vazio
    this.visitor = new THREE.LOD(); this.visitor.addLevel(new THREE.Object3D(), 0); this.visitor.addLevel(this._figure(), 22, 0.1);
    this.visitor.position.set(16.4, frente, z1 + t * 0.2); this.visitor.rotation.y = Math.PI + 0.1; this.visitor.scale.setScalar(1.7); g.add(this.visitor);
  }
  // figura com 4 malhas (calça, paletó, pele, cabelo): as peças de cada material vêm fundidas
  _figure() {
    const f = new THREE.Group(); const jacket = new THREE.MeshStandardMaterial({ color: 0x5a3a26, roughness: 0.8 }); const pants = new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.85 });
    const H = 2.0, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const peca = (geo, [x, y, z], rz = 0, [sx, sy, sz] = [1, 1, 1]) => geo.clone().applyMatrix4(m4.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(0, 0, rz)), new THREE.Vector3(sx, sy, sz)));
    const leg = new THREE.CapsuleGeometry(0.075, H * 0.38, 3, 8), arm = new THREE.CapsuleGeometry(0.055, H * 0.3, 3, 8);
    const partes = [
      [pants, [peca(leg, [-0.09, H * 0.23, 0]), peca(leg, [0.09, H * 0.23, 0])]],
      [jacket, [peca(new THREE.CapsuleGeometry(0.18, H * 0.26, 4, 10), [0, H * 0.62, 0], 0, [1, 1, 0.7]), peca(arm, [-0.24, H * 0.6, 0.02], 0.08), peca(arm, [0.24, H * 0.6, 0.02], -0.08)]],
      [M.skin, [peca(new THREE.SphereGeometry(0.12, 12, 10), [0, H * 0.86, 0], 0, [0.9, 1.1, 0.95])]],
      [new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.9 }), [peca(new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), [0, H * 0.875, 0], 0, [0.92, 1.1, 0.98])]],
    ];
    for (const [mat, geos] of partes) { const o = new THREE.Mesh(geos.length > 1 ? mergeGeometries(geos) : geos[0], mat); o.castShadow = true; f.add(o); }
    return f;
  }
}
