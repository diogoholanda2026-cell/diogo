// Mapa de luz da rua (desenho do render 2.9): uma textura sobre a área jogável (2.048² a 4 m por texel; 1.024² no
// Leve) onde cada poste é uma gaussiana aditiva (raio de 12 a 18 m), numa passada de instâncias refeita só quando a
// rede de vias muda. Bairros antigos e a rodovia com vapor de sódio (âmbar), os novos com LED neutro, as avenidas com
// LED mais forte (a cor sai de um hash por quadra de 600 m, então o bairro todo tem a mesma luz). Os postes vêm da
// mesma conta do setor (malhaVia.postesDaAresta), para a rede inteira (não só perto da câmera).
// Publica ctx.luzRua = { textura, mapa: { ox, oz, lado }, intensidade, versao }; o chão da via lê direto
// (via.glsl.js), e o gancho `noite` da R1b lê pelos uniformes gLuzRua e gLuzRuaMapa quando existirem.
import * as THREE from 'three';
import { postesDaAresta, hashF } from '../geracao/malhaVia.js';
import { perfilVia } from '../geracao/perfilVia.js';

/** Cores das lâmpadas (linear, com a intensidade relativa). */
export const LAMPADAS = Object.freeze({
  sodio: [1.0, 0.52, 0.18, 1.0],
  led: [0.86, 0.86, 0.82, 0.95],
  ledForte: [0.95, 0.94, 0.9, 1.35],
});

/**
 * Luzes de todos os postes da rede: Float32Array (x, z, raio, int) e Float32Array (r, g, b) por luz. Um poste duplo
 * acende dos dois lados do canteiro. Pura (a rede é a de vias.js: arestas com p, tab, tipo, cIni, cFim, e).
 */
export function luzesDaRede(arestas) {
  const pos = [];
  const cor = [];
  for (const ar of arestas) {
    const P = perfilVia(ar.tipo);
    if (!P.regras.postes) continue;
    const quadra = hashF(Math.floor(ar.p[0] / 600) + 1000, Math.floor(ar.p[1] / 600) + 1000, 77);
    const lamp = P.id === 'avenida' || P.id === 'avenidaG' ? LAMPADAS.ledForte : P.id === 'rodovia' || P.id === 'terra' || quadra < 0.45 ? LAMPADAS.sodio : LAMPADAS.led;
    const raio = P.id === 'terra' ? 11 : P.id === 'rua' || P.id === 'ruaMao' ? 14 : 18;
    for (const q of postesDaAresta(ar.p, P, ar.cIni, ar.L - ar.cFim, ar.e, ar.tab)) {
      const lados = q.modelo === 'duplo' ? [1, -1] : [1];
      for (const s of lados) {
        pos.push(q.x + q.dx * q.braco * s, q.z + q.dz * q.braco * s, raio, lamp[3] * (P.id === 'terra' ? 0.6 : 1));
        cor.push(lamp[0], lamp[1], lamp[2]);
      }
    }
  }
  return { pos: Float32Array.from(pos), cor: Float32Array.from(cor), n: pos.length / 4 };
}

const VERTICE = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec4 aLuz;     // x, z, raio, intensidade
attribute vec3 aCor;
uniform vec4 uMapa;      // ox, oz, 1 / lado, livre
varying vec2 vQ;
varying vec3 vCor;
void main() {
  vQ = position.xy;
  vCor = aCor * aLuz.w;
  vec2 w = aLuz.xy + position.xy * aLuz.z;
  vec2 uv = ( w - uMapa.xy ) * uMapa.z;
  gl_Position = vec4( uv * 2.0 - 1.0, 0.0, 1.0 );
}
`;

const FRAGMENTO = /* glsl */ `
precision highp float;
varying vec2 vQ;
varying vec3 vCor;
void main() {
  float d2 = dot( vQ, vQ );
  if ( d2 > 1.0 ) discard;
  // gaussiana (sigma = raio / 2,5), guardada dividida por 4 (o chão multiplica de volta)
  float g = exp( -d2 * 3.125 ) * ( 1.0 - d2 );
  gl_FragColor = vec4( vCor * g * 0.25, 1.0 );
}
`;

function criarLuzRua(ctx) {
  const esp0 = ctx.sim.espelho;
  const mapa = { ox: esp0.mapa?.origem?.[0] ?? -4096, oz: esp0.mapa?.origem?.[1] ?? -4096, lado: esp0.mapa?.tam ?? 8192 };
  const lado = ctx.perfil.id === 'leve' ? 1024 : 2048;
  const alvo = new THREE.WebGLRenderTarget(lado, lado, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false });
  alvo.texture.minFilter = THREE.LinearFilter;
  alvo.texture.magFilter = THREE.LinearFilter;
  alvo.texture.generateMipmaps = false;
  alvo.texture.colorSpace = THREE.NoColorSpace;
  alvo.texture.name = 'luzRua';
  const quad = new THREE.BufferGeometry();
  quad.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  quad.setIndex([0, 1, 2, 0, 2, 3]);
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', quad.getAttribute('position'));
  geo.setIndex(quad.getIndex());
  const mat = new THREE.RawShaderMaterial({
    vertexShader: VERTICE,
    fragmentShader: FRAGMENTO,
    uniforms: { uMapa: { value: new THREE.Vector4(mapa.ox, mapa.oz, 1 / mapa.lado, 0) } },
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const malha = new THREE.Mesh(geo, mat);
  malha.frustumCulled = false;
  const cena = new THREE.Scene();
  cena.add(malha);
  const cam = new THREE.Camera();
  const pub = { textura: alvo.texture, mapa, intensidade: 1, versao: 0, luzes: 0 };
  ctx.luzRua = pub;
  const u = ctx.ganchos.uniformes;
  let versaoRede = -1;
  let tUltimo = -1e9;

  function refazer(vias) {
    const { pos, cor, n } = luzesDaRede(vias.rede.arestas.values());
    geo.setAttribute('aLuz', new THREE.InstancedBufferAttribute(pos, 4));
    geo.setAttribute('aCor', new THREE.InstancedBufferAttribute(cor, 3));
    geo.instanceCount = n;
    const r = ctx.renderer;
    const antes = r.getRenderTarget();
    const cor0 = r.getClearColor(new THREE.Color());
    const a0 = r.getClearAlpha();
    r.setRenderTarget(alvo);
    r.setClearColor(0x000000, 0);
    r.clear(true, false, false);
    if (n) r.render(cena, cam);
    r.setRenderTarget(antes);
    r.setClearColor(cor0, a0);
    pub.versao++;
    pub.luzes = n;
  }

  return {
    nome: 'luzRua',
    quadro(tMs, c) {
      const vias = c.dominio('vias');
      if (!vias?.rede) return;
      // a rede mudou: refaz (no máximo a cada 0,5 s, arrastando a ferramenta de via)
      if (vias.rede.versao !== versaoRede && tMs - tUltimo > 500) {
        versaoRede = vias.rede.versao;
        tUltimo = tMs;
        refazer(vias);
      }
      const dia = c.sol?.dia ?? 1;
      const noite = Math.min(1, Math.max(0, 1 - dia * 1.4));
      // para o gancho `noite` da R1b, se ele declarou os uniformes
      if (u.gLuzRua) u.gLuzRua.value = alvo.texture;
      if (u.gLuzRuaMapa) u.gLuzRuaMapa.value.set?.(mapa.ox, mapa.oz, 1 / mapa.lado, noite);
    },
    descartar() {
      alvo.dispose();
      geo.dispose();
      mat.dispose();
      if (ctx.luzRua === pub) ctx.luzRua = null;
    },
  };
}

export function registrar(api) {
  api.registrarDominio('luzRua', criarLuzRua);
}
