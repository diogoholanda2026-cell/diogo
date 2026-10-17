// Iates na marina e fundeados na baía (R6, D61): só visual, sem simulação. Uma chamada instanciada (até 12 iates de 42 m
// de proa para a margem, mais 4 fundeados com o rumo do vento), com o LOD trocado pela distância da câmera ao conjunto e
// escondidos a mais de 5 km. Malha e plano em geracao/vidaLuxo.js; material: o padrão da biblioteca com cor por vértice
// e os ganchos do render (sombra, neblina, noite), sem sombreador novo. Mostra a água aberta da costa mais perto do centro
// do mapa; sem mar no mapa, não desenha nada.
import * as THREE from 'three';
import { malhaIate, planoMarina, escreverMatriz, IATE } from '../geracao/vidaLuxo.js';

/** Alcance (m) do conjunto, a distância do LOD0 e as capacidades por perfil (instâncias). */
export const ALCANCE_IATES = Object.freeze({ ver: 5000, lod0: 650 });

/** BufferGeometry de uma malha de cor por vértice (vidaLuxo). */
export function geometriaDeCor(m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.posicao, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3));
  g.setAttribute('color', new THREE.BufferAttribute(m.cor, 3));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
  return g;
}

/** Material da vida de luxo: pintura de verniz, cor por vértice, os ganchos do render (como os dos carros e dos props). */
export function materialDeLuxo(ctx, nome, { rugo = 0.34, metal = 0.12 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: rugo, metalness: metal });
  m.name = nome;
  return ctx.ganchos.aplicar(m, ctx.ganchos.nomes().filter((n) => n !== 'camada'));
}

/** Malha instanciada fixa em 'vida' (sem corte pelo three: o domínio esconde por distância). */
export function malhaInstanciada(ctx, geo, mat, cap, nome) {
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.visible = false;
  mesh.name = nome;
  ctx.medidas.familia(mesh, 'vida');
  ctx.cena.add(mesh);
  return mesh;
}

const BRANCOS = [[1, 1, 1], [0.97, 0.95, 0.9], [0.93, 0.95, 0.98], [0.9, 0.9, 0.9]];

function criarIates(ctx) {
  const geo0 = geometriaDeCor(malhaIate(0));
  const geo1 = geometriaDeCor(malhaIate(1));
  const mat = materialDeLuxo(ctx, 'iate');
  const CAP = 16;
  const mesh = malhaInstanciada(ctx, geo0, mat, CAP, 'iates');
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
  let T = null;
  let semente = '';
  let plano = null;
  let lista = [];
  let lodAtual = 0;

  function refazer(esp) {
    T = esp.terreno;
    semente = String(esp.mapa?.semente ?? '');
    plano = T ? planoMarina(T, (semente.length * 31 + 7) % 997) : null;
    lista = plano ? [...plano.atracados.map((b) => ({ ...b, ancora: false })), ...plano.fundeados.map((b) => ({ ...b, ancora: true }))].slice(0, CAP) : [];
    lista.forEach((b, k) => {
      const c = BRANCOS[Math.floor(b.tom * BRANCOS.length) % BRANCOS.length];
      mesh.instanceColor.setXYZ(k, c[0], c[1], c[2]);
    });
    mesh.instanceColor.needsUpdate = true;
  }

  return {
    nome: 'iates',
    /** Os iates do plano (cenas e testes). */
    get lista() {
      return lista;
    },
    quadro(tMs) {
      const esp = ctx.sim?.espelho;
      if (!esp?.terreno) {
        mesh.visible = false;
        return;
      }
      if (esp.terreno !== T || String(esp.mapa?.semente ?? '') !== semente) refazer(esp);
      if (!plano || !lista.length) {
        mesh.visible = false;
        return;
      }
      const cp = ctx.camera.position;
      const d = Math.hypot(cp.x - plano.x, cp.z - plano.z);
      mesh.visible = d < ALCANCE_IATES.ver;
      if (!mesh.visible) return;
      const lod = d < ALCANCE_IATES.lod0 ? 0 : 1;
      if (lod !== lodAtual) {
        mesh.geometry = lod ? geo1 : geo0;
        lodAtual = lod;
      }
      const nivel = esp.mapa?.nivelMar ?? 0;
      const t = tMs / 1000;
      const arr = mesh.instanceMatrix.array;
      lista.forEach((b, k) => {
        // o balanço da água: atracado quase parado, fundeado mais solto, com a proa girando devagar ao vento
        const f = b.ancora ? 1 : 0.35;
        const fase = k * 1.7;
        const arfa = Math.sin(t * 0.7 + fase) * 0.012 * f;
        const rola = Math.sin(t * 0.55 + fase * 1.3) * 0.02 * f;
        const rumo = b.rot + (b.ancora ? Math.sin(t * 0.05 + fase) * 0.25 : 0);
        escreverMatriz(arr, k * 16, b.x, nivel + 0.03 + Math.sin(t * 0.9 + fase) * 0.03 * f, b.z, rumo, arfa, rola, b.escala);
      });
      mesh.count = lista.length;
      mesh.instanceMatrix.needsUpdate = true;
    },
    descartar() {
      ctx.cena.remove(mesh);
      geo0.dispose();
      geo1.dispose();
      mesh.dispose();
      mat.dispose();
    },
  };
}

export { IATE };

export function registrar(api) {
  api.registrarDominio('iates', criarIates);
}
