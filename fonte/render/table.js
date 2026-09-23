// A mesa de exposição: bandeja de madeira, guarda-corpo de vidro na frente e na lateral direita,
// placa de latão com o título da composição, pedestal e o visitante em escala (como na foto).
import * as THREE from 'three';
import { MESA } from '../data/planta.js';
import { tex } from './textures.js';
import { M } from './materials.js';

export const BORDA = { t: 1.3, topo: 1.15, frente: 0.55, base: -6.5 };

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
    const wood = tex.wood();
    this.walnut = new THREE.MeshStandardMaterial({ color: 0xe6cfae, map: wood, roughness: 0.45, metalness: 0.0, envMapIntensity: 0.6 });
    this.walnutDark = new THREE.MeshStandardMaterial({ color: 0x9a7c60, map: wood, roughness: 0.6, envMapIntensity: 0.4 });
    const { t, topo, frente, base } = BORDA; const { x0, x1, z0, z1 } = MESA; const W = x1 - x0, D = z1 - z0;
    // paredes da bandeja
    g.add(woodBox(W + 2 * t, topo - base, t, this.walnut, (x0 + x1) / 2, (topo + base) / 2, z0 - t / 2));           // fundo
    g.add(woodBox(t, topo - base, D, this.walnut, x0 - t / 2, (topo + base) / 2, (z0 + z1) / 2));                   // esquerda
    g.add(woodBox(t, topo - base, D, this.walnut, x1 + t / 2, (topo + base) / 2, (z0 + z1) / 2));                   // direita
    g.add(woodBox(W + 2 * t, frente - base, t, this.walnut, (x0 + x1) / 2, (frente + base) / 2, z1 + t / 2));       // frente (mais baixa)
    // fundo da bandeja sob o terreno (esconde frestas)
    const under = new THREE.Mesh(new THREE.PlaneGeometry(W, D), this.walnutDark); under.rotation.x = -Math.PI / 2; under.position.set((x0 + x1) / 2, -2.6, (z0 + z1) / 2); g.add(under);
    // pedestal recuado
    g.add(woodBox(W - 4, 9, D - 4, this.walnutDark, (x0 + x1) / 2, base - 4.5, (z0 + z1) / 2, 9));
    // piso da sala (quase invisível, recebe luz)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x0c0f16, roughness: 0.35, metalness: 0.2 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = base - 9; floor.receiveShadow = true; g.add(floor);
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
    const brass = new THREE.MeshStandardMaterial({ map: tex.brass(), roughness: 0.32, metalness: 0.85, envMapIntensity: 1.4, color: 0xffffff });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(15, 3.75, 0.12), [M.steelDark, M.steelDark, M.steelDark, M.steelDark, brass, M.steelDark]);
    plate.position.set(-1.5, -2.35, z1 + t + 0.32); plate.rotation.x = -0.32; plate.castShadow = true; g.add(plate);
    this.plate = plate;
    // visitante em escala (figura de maquete) na borda da frente
    this.visitor = this._figure(); this.visitor.position.set(9.6, frente, z1 + t * 0.2); this.visitor.rotation.y = Math.PI + 0.25; g.add(this.visitor);
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
