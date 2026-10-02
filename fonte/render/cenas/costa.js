// Cena 'costa' (A10: praia e mar a 300 m): o costão de granito dos morros do oeste descendo no mar, a praia e o
// começo da cidade, vistos de cima do mar, sobre a cidade sintética. Hora padrão 10h (a captura do fim de tarde usa ?hora=17.5).
// ?vista= troca a câmera (R2b): rio (o rio Held de perto, com a mata ciliar), mata (dentro da mata, a 60 m) e serra (a
// rasante do mar para o norte, com o mundo de fora atrás dos morros).
// Confere na GPU a paridade da altura do terreno (GLSL) com alturaEm de comum/altura.js em 64 pontos sorteados:
// window.__resultado = { ok, falhas, paridade: { pontos, erroMax }, terreno: { nos, tris }, ... }.
import * as THREE from 'three';
import { alturaEm } from '../../comum/altura.js';
import { hashF } from '../geracao/ruido.js';
import { GLSL_TER_COMUM, GLSL_TER_ALTURA } from '../materiais/shaders/terreno.glsl.js';

export const CAMERA_COSTA = Object.freeze({ x: -2150, z: 1790, dist: 520, guinada: 292, inclinacao: 16 });
/** Vistas da R2b (?vista=). */
export const VISTAS_COSTA = Object.freeze({
  rio: { x: -1060, z: 560, dist: 190, guinada: 200, inclinacao: 18 },
  mata: { x: -1185, z: 470, dist: 70, guinada: 250, inclinacao: 12 },
  serra: { x: -400, z: 1500, dist: 2600, guinada: 340, inclinacao: 4 },
});
const N_PONTOS = 64;

/** Pontos sorteados (determinísticos) dentro do mapa, com a altura esperada pela leitura da simulação. */
export function pontosDeParidade(T, n = N_PONTOS, semente = 11) {
  const L = T.passo * (T.n - 1);
  const out = [];
  for (let k = 0; k < n; k++) {
    const x = T.origem[0] + 1 + hashF(k, 1, semente) * (L - 2);
    const z = T.origem[1] + 1 + hashF(k, 2, semente) * (L - 2);
    out.push({ x, z, h: alturaEm(T, x, z) });
  }
  return out;
}

let matParidade = null;

/** Lê na GPU a altura que o vértice do terreno usa, nos pontos dados (alvo RGBA32F de 8 x 8, um ponto por texel). */
function alturasNaGPU(ctx, pontos) {
  const { renderer } = ctx;
  if (!ctx.capac?.floatRT) return null;
  const lado = 8;
  const pos = new Float32Array(pontos.length * 3);
  const w = new Float32Array(pontos.length * 2);
  pontos.forEach((p, k) => {
    pos[3 * k] = (((k % lado) + 0.5) / lado) * 2 - 1;
    pos[3 * k + 1] = ((Math.floor(k / lado) + 0.5) / lado) * 2 - 1;
    w[2 * k] = p.x;
    w[2 * k + 1] = p.z;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aPonto', new THREE.BufferAttribute(w, 2));
  // o material fica guardado (a bancada confere o programa ligado até o fim do teste)
  matParidade ??= new THREE.ShaderMaterial({
    uniforms: ctx.chao.uniformes,
    vertexShader: /* glsl */ `
${GLSL_TER_COMUM}
${GLSL_TER_ALTURA}
in vec2 aPonto;
out float vH;
void main() {
  vH = terAlturaBase( aPonto );
  gl_Position = vec4( position.xy, 0.0, 1.0 );
  gl_PointSize = 1.0;
}`,
    fragmentShader: /* glsl */ `
in float vH;
void main() { gl_FragColor = vec4( vH, 0.0, 0.0, 1.0 ); }`,
    depthTest: false,
    depthWrite: false,
  });
  matParidade.uniforms = ctx.chao.uniformes;
  const cena = new THREE.Scene();
  const pts = new THREE.Points(g, matParidade);
  pts.frustumCulled = false;
  cena.add(pts);
  const alvo = new THREE.WebGLRenderTarget(lado, lado, { type: THREE.FloatType, depthBuffer: false });
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const antes = renderer.getRenderTarget();
  const corAntes = renderer.getClearColor(new THREE.Color());
  const alfaAntes = renderer.getClearAlpha();
  renderer.setRenderTarget(alvo);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(cena, cam);
  const buf = new Float32Array(lado * lado * 4);
  renderer.readRenderTargetPixels(alvo, 0, 0, lado, lado, buf);
  renderer.setRenderTarget(antes);
  renderer.setClearColor(corAntes, alfaAntes);
  alvo.dispose();
  g.dispose();
  return pontos.map((_, k) => buf[4 * k]);
}

export function registrar(registrarCena) {
  registrarCena('costa', {
    sim: 'sintetica',
    hora: 10,
    camera: CAMERA_COSTA,
    async montar(ctx) {
      let quadros = 0;
      const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
      const vista = VISTAS_COSTA[qs.get('vista')];
      if (vista) ctx.cameraApi.definir(vista);
      return {
        quadro(tMs, c) {
          quadros++;
          // as árvores de perto prontas antes da captura (no jogo a vegetação gera os ladrilhos aos poucos)
          if (quadros === 3) c.dominio('vegetacao')?.preparar?.();
          // o mar vai até o horizonte: enquanto a câmera básica da F0 corta a 12 vezes a distância, a cena abre o far
          // (a câmera da R1a cuida das duas faixas de profundidade e deixa isto sem efeito)
          if (c.camera.far < 20000) {
            c.camera.far = 60000;
            c.camera.updateProjectionMatrix();
          }
        },
        resultado() {
          const falhas = [];
          const T = ctx.sim.espelho.terreno;
          const chao = ctx.chao;
          if (!T || !chao) return { ok: false, falhas: ['sem terreno'] };
          const pontos = pontosDeParidade(T);
          const gpu = alturasNaGPU(ctx, pontos);
          let erroMax = 0;
          if (gpu) {
            pontos.forEach((p, k) => {
              const e = Math.abs(gpu[k] - p.h);
              if (!(e <= erroMax)) erroMax = Number.isFinite(e) ? Math.max(erroMax, e) : Infinity;
            });
            if (!(erroMax < 0.01)) falhas.push(`altura do GLSL longe de alturaEm: ${erroMax.toFixed(4)} m`);
          }
          const s = ctx.stats;
          if (!(chao.nos > 0)) falhas.push('nenhum nó do terreno');
          if (s.familias.terreno > 120000) falhas.push(`terreno com ${s.familias.terreno} triângulos (teto 120 mil)`);
          return {
            ok: falhas.length === 0,
            falhas,
            paridade: { pontos: gpu ? pontos.length : 0, erroMax: +erroMax.toFixed(5), gpu: !!gpu },
            terreno: { nos: chao.nos, tris: s.familias.terreno, assados: chao.assados },
            calls: s.calls,
            tris: s.tris,
            quadros,
            materiais: chao.materiais(),
          };
        },
      };
    },
  });
}
