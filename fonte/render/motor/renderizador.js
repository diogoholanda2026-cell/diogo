// Renderizador (D14): WebGLRenderer do three 0.186, capacidades do aparelho, contagem de todos os passes do quadro e
// perda do contexto. Primeira versão da F0; a R1a completa (alvo HDR com MSAA, profundidade invertida com
// EXT_clip_control e as duas faixas de profundidade sem ela, D44 e a sonda).
import * as THREE from 'three';

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

/** Nome do processador gráfico (UNMASKED_RENDERER_WEBGL quando o navegador expõe). */
function lerGpu(gl) {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch (e) {
    return '';
  }
}

/**
 * Cria o renderizador sobre o canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {{ msaa?: number, pr?: number }} op  msaa > 0 liga o antisserrilhado do próprio canvas (a R1a troca pelo alvo HDR)
 * @returns {{ renderer: THREE.WebGLRenderer, gl: WebGL2RenderingContext, capac: object, gpu: string, movel: boolean }}
 */
export function criarRenderizador(canvas, { msaa = 2, pr = 1 } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: msaa > 0,
    alpha: false,
    stencil: false,
    depth: true,
    powerPreference: 'high-performance',
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
  const tem = (n) => renderer.extensions.has(n);
  const capac = {
    clipControl: tem('EXT_clip_control'),
    multiDraw: tem('WEBGL_multi_draw'),
    timer: tem('EXT_disjoint_timer_query_webgl2'),
    floatRT: tem('EXT_color_buffer_float'),
    limites: lerLimites(gl),
  };
  const gpu = lerGpu(gl);
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
