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

function woodBox(w, h, d, mat, x, y, z, L = 7) {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const X = p.getX(i) + x, Y = p.getY(i) + y, Z = p.getZ(i) + z; const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    if (ax > 0.5) uv.setXY(i, Z / L, Y / (L * 0.25)); else if (ay > 0.5) uv.setXY(i, (w >= d ? X : Z) / L, (w >= d ? Z : X) / (L * 0.25)); else uv.setXY(i, X / L, Y / (L * 0.25));
  }
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}

export class ExhibitTable {
  constructor(engine) {
    this.e = engine; const g = (this.group = new THREE.Group()); g.name = 'mesa'; engine.scene.add(g);
    const wood = tex.nogueira();
    // nogueira escura envernizada: pouco rugosa, reflete a sala quente
    this.walnut = semHAO(new THREE.MeshStandardMaterial({ color: 0xffffff, map: wood, roughness: 0.36, metalness: 0.0, envMapIntensity: 1.0 }));
    this.walnutDark = semHAO(new THREE.MeshStandardMaterial({ color: 0x6e5a4c, map: wood, roughness: 0.6, envMapIntensity: 0.4 }));
    this.pedestalMat = semHAO(new THREE.MeshStandardMaterial({ color: 0xd8d8d8, map: wood, roughness: 0.6, envMapIntensity: 0.5 }));
    const { t, topo, frente, base } = BORDA; const { x0, x1, z0, z1 } = MESA; const W = x1 - x0, D = z1 - z0;
    // paredes da bandeja
    const nome = (o, n) => { o.name = n; return o; };
    g.add(nome(woodBox(W + 2 * t, topo - base, t, this.walnut, (x0 + x1) / 2, (topo + base) / 2, z0 - t / 2), 'fundo'));
    g.add(nome(woodBox(t, topo - base, D, this.walnut, x0 - t / 2, (topo + base) / 2, (z0 + z1) / 2), 'esquerda'));
    g.add(nome(woodBox(t, topo - base, D, this.walnut, x1 + t / 2, (topo + base) / 2, (z0 + z1) / 2), 'direita'));
    g.add(nome(woodBox(W + 2 * t, frente - base, t, this.walnut, (x0 + x1) / 2, (frente + base) / 2, z1 + t / 2), 'frente')); // mais baixa
    // friso arredondado no topo das quatro paredes (pega a linha de brilho do verniz): uma só malha
    const r = 0.08, fr = [];
    const friso = (L, x, y, z, eixoX) => { const c = new THREE.CylinderGeometry(r, r, L, 12, 1, false, 0, Math.PI); c.rotateZ(Math.PI / 2); if (!eixoX) c.rotateY(Math.PI / 2); c.translate(x, y, z); fr.push(c); }; // meia-cana deitada, curva para cima
    friso(W + 2 * t, (x0 + x1) / 2, topo, z0 - t + r, true); friso(W + 2 * t, (x0 + x1) / 2, frente, z1 + t - r, true);
    friso(D + t, x0 - t + r, topo, (z0 + z1 - t) / 2, false); friso(D + t, x1 + t - r, topo, (z0 + z1 - t) / 2, false);
    const fg = mergeGeometries(fr); const fm = new THREE.Mesh(fg, this.walnut); fm.name = 'friso'; fm.receiveShadow = true; g.add(fm);
    // fundo da bandeja sob o terreno (esconde frestas)
    const under = new THREE.Mesh(new THREE.PlaneGeometry(W, D), this.walnutDark); under.rotation.x = -Math.PI / 2; under.position.set((x0 + x1) / 2, -2.6, (z0 + z1) / 2); g.add(under);
    // pedestal recuado em nogueira escura, com rodapé preto rente ao piso
    const ped = nome(woodBox(W - 4, 9, D - 4, this.pedestalMat, (x0 + x1) / 2, base - 4.5, (z0 + z1) / 2, 9), 'pedestal'); ped.receiveShadow = false; g.add(ped); // a luz da sala o alcança por baixo da bandeja (como na foto)
    const rod = new THREE.Mesh(new THREE.BoxGeometry(W - 3.6, 0.45, D - 3.6), semHAO(new THREE.MeshStandardMaterial({ color: 0x120c09, roughness: 0.5 }))); rod.position.set((x0 + x1) / 2, base - 9 + 0.225, (z0 + z1) / 2); rod.name = 'rodape'; g.add(rod);
    // piso da sala: disco escuro e fosco (não reflete o painel azul); fora do mapa de alturas
    const floor = new THREE.Mesh(new THREE.CircleGeometry(70, 48), semHAO(new THREE.MeshStandardMaterial({ color: 0x07090d, roughness: 0.95, metalness: 0 })));
    floor.rotation.x = -Math.PI / 2; floor.position.y = base - 9; floor.receiveShadow = true; floor.name = 'piso'; floor.userData.semHAO = true; g.add(floor); this.piso = floor;
    // guarda-corpo de vidro (frente e lateral direita), montantes e corrimão metálico
    const railH = 1.05, zf = z1 + t * 0.55, xr = x1 + t * 0.55;
    const glassF = new THREE.Mesh(new THREE.BoxGeometry(W + t, railH, 0.05), M.glassRail); glassF.position.set((x0 + x1) / 2 + t / 2, frente + railH / 2, zf); glassF.renderOrder = 2; g.add(glassF);
    const glassR = new THREE.Mesh(new THREE.BoxGeometry(0.05, railH, D + t), M.glassRail); glassR.position.set(xr, topo + railH / 2, (z0 + z1) / 2 + t / 2); glassR.renderOrder = 2; g.add(glassR);
    const posts = []; for (let x = x0; x <= x1 + 0.01; x += 4) posts.push([x, frente, zf]); for (let z = z0; z <= z1 + 0.01; z += 4) posts.push([xr, topo, z]);
    const pg = new THREE.CylinderGeometry(0.045, 0.045, railH, 8); pg.translate(0, railH / 2, 0);
    const pim = new THREE.InstancedMesh(pg, M.steel, posts.length); const m4 = new THREE.Matrix4();
    posts.forEach(([x, y, z], i) => pim.setMatrixAt(i, m4.makeTranslation(x, y, z))); pim.castShadow = true; g.add(pim);
    const topF = new THREE.Mesh(new THREE.BoxGeometry(W + t, 0.05, 0.1), M.steel); topF.position.set((x0 + x1) / 2 + t / 2, frente + railH, zf); g.add(topF);
    const topR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, D + t), M.steel); topR.position.set(xr, topo + railH, (z0 + z1) / 2 + t / 2); g.add(topR);
    // placa de latão inclinada na face frontal
    // latão escovado (metal 0,9 e rugosidade 0,28) com o texto gravado fosco e escuro (mapa de metal/rugosidade)
    const mr = tex.brassMR();
    this.brass = semHAO(new THREE.MeshStandardMaterial({ color: 0xb4ac8c, map: tex.brass(), metalness: 0.6, roughness: 1.4, metalnessMap: mr, roughnessMap: mr, envMapIntensity: 2.0 })); // metal 0,54 e rugosidade 0,39 no latão; gravado fosco
    const plate = new THREE.Mesh(new THREE.BoxGeometry(15, 3.0, 0.12), [M.steelDark, M.steelDark, M.steelDark, M.steelDark, this.brass, M.steelDark]);
    plate.position.set(4.2, -2.0, z1 + t + 0.3); plate.rotation.x = -0.32; plate.castShadow = true; plate.name = 'placa'; g.add(plate);
    this.plate = plate;
    // visitante em escala (figura de maquete) na borda da frente
    this.visitor = this._figure(); this.visitor.position.set(16.4, frente, z1 + t * 0.2); this.visitor.rotation.y = Math.PI + 0.1; this.visitor.scale.setScalar(1.7); g.add(this.visitor);
  }
  _figure() {
    const f = new THREE.Group(); const jacket = new THREE.MeshStandardMaterial({ color: 0x5a3a26, roughness: 0.8 }); const pants = new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.85 });
    const skin = M.skin; const H = 2.0;
    const leg = new THREE.CapsuleGeometry(0.075, H * 0.38, 3, 8);
    const l1 = new THREE.Mesh(leg, pants); l1.position.set(-0.09, H * 0.23, 0); const l2 = l1.clone(); l2.position.x = 0.09;
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, H * 0.26, 4, 10), jacket); torso.position.y = H * 0.62; torso.scale.set(1, 1, 0.7);
    const arm = new THREE.CapsuleGeometry(0.055, H * 0.3, 3, 8);
    const a1 = new THREE.Mesh(arm, jacket); a1.position.set(-0.24, H * 0.6, 0.02); a1.rotation.z = 0.08; const a2 = a1.clone(); a2.position.x = 0.24; a2.rotation.z = -0.08;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skin); head.position.y = H * 0.86; head.scale.set(0.9, 1.1, 0.95);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.9 })); hair.position.y = H * 0.875; hair.scale.set(0.92, 1.1, 0.98);
    for (const o of [l1, l2, torso, a1, a2, head, hair]) { o.castShadow = true; f.add(o); }
    return f;
  }
}
