// Renderizador (D14): WebGLRenderer do three 0.186, capacidades do aparelho, contagem de todos os passes do quadro e
// perda do contexto. O antisserrilhado sai do alvo HDR com MSAA (motor/pos.js), não do canvas. Profundidade
// invertida (reversedDepthBuffer) quando o aparelho tem EXT_clip_control: plano próximo de 10 cm e distante de 100 km
// num alvo de 32 bits em ponto flutuante; sem ela (ou com ?semClip=1, que o quadro desliga) valem as duas faixas de
// profundidade (motor/faixas.js). O vigia dos programas entra antes do primeiro programa (tempo de compilação e, na
// página de teste, as fontes para a guarda do Mali, D44).
import * as THREE from 'three';
import { sondar, vigiarProgramas } from './capacidades.js';

/** Limites lidos do WebGL2 (a guarda do Mali compara com os mínimos, D44). */
function lerLimites(gl) {
  const p = (k) => {
    try {
      return gl.getParameter(k);
    } catch (e) {
      return 0;
    }
  };
  return {
    amostradoresF: p(gl.MAX_TEXTURE_IMAGE_UNITS),
    amostradoresV: p(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
    varyings: p(gl.MAX_VARYING_VECTORS),
    uniformesF: p(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
    uniformesV: p(gl.MAX_VERTEX_UNIFORM_VECTORS),
    atributos: p(gl.MAX_VERTEX_ATTRIBS),
    textura: p(gl.MAX_TEXTURE_SIZE),
    amostras: p(gl.MAX_SAMPLES),
  };
}

/**
 * Cria o renderizador sobre o canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {{ msaa?: number, pr?: number }} op  msaa: o do perfil (vai para o alvo HDR, não para o canvas)
 * @returns {{ renderer: THREE.WebGLRenderer, gl: WebGL2RenderingContext, capac: object, gpu: string, movel: boolean }}
 */
export function criarRenderizador(canvas, { msaa = 2, pr = 1 } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    stencil: false,
    depth: true,
    powerPreference: 'high-performance',
    reversedDepthBuffer: true, // o three só liga com EXT_clip_control
  });
  // R.stats soma todos os passes do quadro: o contador só zera no começo do quadro (medidas.js)
  renderer.info.autoReset = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1;
  // a sombra do three filtra pela câmera da vista (conferido): a sombra é a própria (D43)
  renderer.shadowMap.enabled = false;
  renderer.setPixelRatio(pr);
  const gl = renderer.getContext();
  const vigia = vigiarProgramas(gl);
  const tem = (n) => renderer.extensions.has(n);
  const sonda = sondar(gl);
  const capac = {
    clipControl: tem('EXT_clip_control'),
    invertida: !!renderer.state.buffers.depth.getReversed(),
    multiDraw: tem('WEBGL_multi_draw'),
    timer: tem('EXT_disjoint_timer_query_webgl2'),
    floatRT: tem('EXT_color_buffer_float'),
    paralelo: tem('KHR_parallel_shader_compile'),
    msaaPedido: msaa,
    limites: lerLimites(gl),
    sonda,
    programas: vigia,
  };
  const gpu = sonda.gpu;
  const movel = typeof navigator !== 'undefined' && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || '');
  return { renderer, gl, capac, gpu, movel };
}

/**
 * Liga a perda e a volta do contexto: o render para de desenhar e avisa (o app recarrega a página se a volta falhar).
 * @returns {{ perdido: () => boolean }}
 */
export function vigiarContexto(canvas, { aoPerder = null, aoVoltar = null } = {}) {
  let perdido = false;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    perdido = true;
    aoPerder?.();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    perdido = false;
    aoVoltar?.();
  });
  return { perdido: () => perdido };
}

export function registrar() {}
