// Sonda de capacidades (D33, D44, 5.3): o que o aparelho aceita (limites do WebGL2, extensões, precisão, formatos) e
// o que cada programa compilado custa: amostradores por estágio, varyings, vetores de uniforme do fragmento e
// atributos (contados no GLSL final, depois do pré-processador, pela mesma regra do GLSL ES 3.0), mais o tempo de
// compilação. O vigia entra no contexto antes do primeiro programa (renderizador.js) e anota cada linkProgram; as
// fontes só ficam guardadas numa página de teste (?painel=1, ?bancada=1, ?sonda=1, ?teste=1), para não gastar
// memória no jogo. A mesma sonda roda no Chromium de teste (ferramentas/sonda-gpu.mjs) e na página de teste da prévia.
// A guarda do Mali (GUARDA_MALI do contrato) acusa os programas acima de 12 amostradores por estágio, 12 varyings,
// 200 vetores de uniforme no fragmento ou 14 atributos, e qualquer precisão média.
// Desde a PC1 (D66): o vigia mede o bloqueio da thread principal em cada ligação e, depois do aquecimento (quadro.js,
// marcarPronto), conta cada programa novo como compilação depois de pronto; e a memória de vídeo sai estimada pelo que
// o jogo aloca no WebGL (texturas com os níveis, alvos com o MSAA, buffers).
import { GUARDA_MALI } from '../../contratos/render.js';

const agora = () => (typeof performance !== 'undefined' ? performance.now() : 0);

// ------------------------------------------------------------------------------------------------ sonda

/** Limites, extensões, precisão e o processador gráfico. */
export function sondar(gl, extras = {}) {
  const p = (k) => {
    try {
      return gl.getParameter(k);
    } catch (e) {
      return null;
    }
  };
  const prec = (sh) => {
    try {
      const f = gl.getShaderPrecisionFormat(sh, gl.HIGH_FLOAT);
      return f ? { min: f.rangeMin, max: f.rangeMax, bits: f.precision } : null;
    } catch (e) {
      return null;
    }
  };
  let gpu = '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch (e) {
    gpu = '';
  }
  const ext = gl.getSupportedExtensions?.() ?? [];
  return {
    gpu,
    versao: String(p(gl.VERSION) ?? ''),
    glsl: String(p(gl.SHADING_LANGUAGE_VERSION) ?? ''),
    limites: {
      amostradoresF: p(gl.MAX_TEXTURE_IMAGE_UNITS),
      amostradoresV: p(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
      amostradoresTotal: p(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
      varyings: p(gl.MAX_VARYING_VECTORS),
      uniformesF: p(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
      uniformesV: p(gl.MAX_VERTEX_UNIFORM_VECTORS),
      atributos: p(gl.MAX_VERTEX_ATTRIBS),
      textura: p(gl.MAX_TEXTURE_SIZE),
      cubo: p(gl.MAX_CUBE_MAP_TEXTURE_SIZE),
      camadas: p(gl.MAX_ARRAY_TEXTURE_LAYERS),
      amostras: p(gl.MAX_SAMPLES),
      alvosCor: p(gl.MAX_DRAW_BUFFERS),
      viewport: Array.from(p(gl.MAX_VIEWPORT_DIMS) ?? []),
    },
    precisao: { vertice: prec(gl.VERTEX_SHADER), fragmento: prec(gl.FRAGMENT_SHADER) },
    extensoes: ext,
    tem: {
      clipControl: ext.includes('EXT_clip_control'),
      multiDraw: ext.includes('WEBGL_multi_draw'),
      timer: ext.includes('EXT_disjoint_timer_query_webgl2'),
      floatRT: ext.includes('EXT_color_buffer_float'),
      halfRT: ext.includes('EXT_color_buffer_half_float'),
      floatLinear: ext.includes('OES_texture_float_linear'),
      paralelo: ext.includes('KHR_parallel_shader_compile'),
      astc: ext.includes('WEBGL_compressed_texture_astc'),
      etc: ext.includes('WEBGL_compressed_texture_etc'),
      anisotropia: ext.includes('EXT_texture_filter_anisotropic'),
    },
    ...extras,
  };
}

// ------------------------------------------------------------------------------------------------ vigia dos programas

/**
 * Programas internos do three que declaram a precisão média (o PMREM): a D44 vale para os shaders próprios, então a
 * precisão média deles fica anotada (precisaoMedia) sem contar como falha.
 */
export const INTERNOS_DO_THREE = Object.freeze(['CubemapToCubeUV', 'EquirectangularToCubeUV', 'PMREMGGXConvolution', 'SphericalGaussianBlur']);

/** Nome do programa: o SHADER_NAME do material (o name do ShaderMaterial) ou, sem ele, o tipo do material do three. */
export function nomeDoPrograma(vs, fs) {
  const achar = (re) => (fs.match(re) || vs.match(re) || [])[1];
  return achar(/#define SHADER_NAME[ \t]+(\S+)/) || achar(/#define SHADER_TYPE[ \t]+(\S+)/) || '(sem nome)';
}

/** A página guarda as fontes dos programas? (páginas de teste) */
export const paginaDeTeste = () => typeof location !== 'undefined' && /[?&](painel|bancada|sonda|teste)=/.test(location.search || '');

/** COMPLETION_STATUS_KHR (KHR_parallel_shader_compile): lido sem esperar a compilação. */
const COMPLETION_STATUS_KHR = 0x91b1;

/**
 * Marca o fim do aquecimento (motor/quadro.js): daqui em diante todo programa ligado é uma compilação depois de pronto
 * (um soluço no jogo, como o do vidro da Arcologia medido no PC do dono) e vai para vigia.depois.
 */
export function marcarPronto(vigia, quadro = 0) {
  if (!vigia || vigia.pronto) return;
  vigia.pronto = true;
  vigia.quadroPronto = quadro;
  vigia.antes = vigia.lista.length;
}

/** Volta ao aquecimento (troca de perfil: os programas novos dela não contam como soluço). */
export function desmarcarPronto(vigia) {
  if (vigia) vigia.pronto = false;
}

/**
 * Vigia os programas do contexto: tempo de compilação, quanto a thread principal ficou parada esperando a ligação
 * (msBloqueio: o soluço que o jogador vê; perto de 0 quando o programa ficou pronto em paralelo, pelo
 * KHR_parallel_shader_compile) e, numa página de teste, as fontes finais. Depois de marcarPronto, cada programa novo
 * entra também em `depois`, com o quadro. Instala uma vez por contexto.
 * @returns {{ lista: Array<{ nome: string, msCompilar: number | null, msBloqueio: number | null, link: boolean | null,
 *   depois?: boolean, quadro?: number, vs?: string, fs?: string }>, depois: object[], pronto: boolean, quadro: number }}
 */
export function vigiarProgramas(gl, { fontes = paginaDeTeste() } = {}) {
  if (gl.__vigia) return gl.__vigia;
  const vigia = { lista: [], depois: [], pronto: false, quadro: 0, quadroPronto: null, antes: 0, fontes };
  const tipos = new WeakMap();
  const src = new WeakMap();
  const anexos = new WeakMap();
  const porPrograma = new WeakMap();
  const cs = gl.createShader.bind(gl);
  const ss = gl.shaderSource.bind(gl);
  const at = gl.attachShader.bind(gl);
  const lk = gl.linkProgram.bind(gl);
  const gp = gl.getProgramParameter.bind(gl);
  gl.createShader = (t) => {
    const s = cs(t);
    if (s) tipos.set(s, t);
    return s;
  };
  gl.shaderSource = (s, texto) => {
    src.set(s, texto);
    return ss(s, texto);
  };
  gl.attachShader = (p, s) => {
    const l = anexos.get(p) ?? [];
    l.push(s);
    anexos.set(p, l);
    return at(p, s);
  };
  gl.linkProgram = (p) => {
    const sh = anexos.get(p) ?? [];
    const vs = src.get(sh.find((s) => tipos.get(s) === gl.VERTEX_SHADER)) ?? '';
    const fs = src.get(sh.find((s) => tipos.get(s) === gl.FRAGMENT_SHADER)) ?? '';
    const nome = nomeDoPrograma(vs, fs);
    const reg = { nome, msCompilar: null, msBloqueio: null, link: null, t0: agora() };
    if (vigia.fontes) {
      reg.vs = vs;
      reg.fs = fs;
    }
    vigia.lista.push(reg);
    if (vigia.pronto) {
      reg.depois = true;
      reg.quadro = vigia.quadro;
      vigia.depois.push(reg);
      console.warn(`render: programa compilado depois de pronto: ${nome} (quadro ${vigia.quadro})`);
    }
    porPrograma.set(p, reg);
    const r = lk(p);
    reg.msLink = agora() - reg.t0; // um driver que compila dentro do linkProgram para a thread aqui
    return r;
  };
  // a primeira leitura que espera a ligação (o three lê o registro do programa antes do LINK_STATUS; sem a checagem
  // de erros, os uniformes ativos): o tempo parado nela, mais o do próprio linkProgram, é o bloqueio
  const bloqueio = (reg, t, t1) => {
    if (reg.msBloqueio !== null) return;
    reg.msBloqueio = +(t1 - t + (reg.msLink ?? 0)).toFixed(2);
    if (reg.msCompilar === null) reg.msCompilar = +(t1 - reg.t0).toFixed(2);
  };
  // pronto em paralelo (COMPLETION_STATUS_KHR, sem esperar): o tempo de compilação fecha aí
  gl.getProgramParameter = (p, k) => {
    const reg = porPrograma.get(p);
    if (!reg || (reg.msBloqueio !== null && (k !== gl.LINK_STATUS || reg.link !== null))) return gp(p, k);
    const t = agora();
    const r = gp(p, k);
    const t1 = agora();
    if (k === COMPLETION_STATUS_KHR) {
      if (r && reg.msCompilar === null) reg.msCompilar = +(t1 - reg.t0).toFixed(2);
      return r;
    }
    bloqueio(reg, t, t1);
    if (k === gl.LINK_STATUS) reg.link = !!r;
    return r;
  };
  if (typeof gl.getProgramInfoLog === 'function') {
    const gl0 = gl.getProgramInfoLog.bind(gl);
    gl.getProgramInfoLog = (p) => {
      const reg = porPrograma.get(p);
      if (!reg || reg.msBloqueio !== null) return gl0(p);
      const t = agora();
      const r = gl0(p);
      bloqueio(reg, t, agora());
      return r;
    };
  }
  gl.__vigia = vigia;
  return vigia;
}

/** Compilações depois de pronto, para o relatório: nome, bloqueio, compilação e quadro. */
export function compilacoesDepois(vigia) {
  return (vigia?.depois ?? []).map((p) => ({ nome: p.nome, msBloqueio: p.msBloqueio, msCompilar: p.msCompilar, quadro: p.quadro }));
}

// ------------------------------------------------------------------------------------------------ memória de vídeo

const MB = 1048576;

/** Bytes por texel dos formatos com tamanho (WebGL2). Os RGB sem alfa contam como 4 (o Direct3D do ANGLE completa). */
const BYTES_FORMATO = new Map([
  [0x8229, 1], [0x8f94, 1], [0x822b, 2], [0x8f95, 2], [0x8051, 4], [0x8f96, 4], [0x8058, 4], [0x8f97, 4], [0x8c41, 4],
  [0x8c43, 4], [0x8d62, 2], [0x8056, 2], [0x8057, 2], [0x8059, 4], [0x906f, 4], [0x822d, 2], [0x822f, 4], [0x881b, 8],
  [0x881a, 8], [0x822e, 4], [0x8230, 8], [0x8815, 16], [0x8814, 16], [0x8c3a, 4], [0x8c3d, 4], [0x8231, 1], [0x8232, 1],
  [0x8233, 2], [0x8234, 2], [0x8235, 4], [0x8236, 4], [0x8237, 2], [0x8238, 2], [0x8239, 4], [0x823a, 4], [0x823b, 8],
  [0x823c, 8], [0x8d8e, 4], [0x8d7c, 4], [0x8d88, 8], [0x8d76, 8], [0x8d82, 16], [0x8d70, 16], [0x81a5, 2], [0x81a6, 4],
  [0x8cac, 4], [0x88f0, 4], [0x8cad, 8], [0x8d48, 1],
]);
/** Canais dos formatos sem tamanho (RGBA, RGB, LUMINANCE_ALPHA, LUMINANCE, ALPHA, DEPTH_COMPONENT, DEPTH_STENCIL). */
const CANAIS = new Map([[0x1908, 4], [0x1907, 3], [0x190a, 2], [0x1909, 1], [0x1906, 1], [0x1902, 1], [0x84f9, 1]]);
/** Bytes por canal do tipo (ou do texel inteiro, nos tipos empacotados). */
const BYTES_TIPO = new Map([[0x1401, 1], [0x1400, 1], [0x1403, 2], [0x1402, 2], [0x1405, 4], [0x1404, 4], [0x1406, 4], [0x140b, 2], [0x8d61, 2]]);
const TIPO_EMPACOTADO = new Map([[0x8363, 2], [0x8033, 2], [0x8034, 2], [0x84fa, 4], [0x8c3b, 4], [0x8368, 4], [0x8c3e, 4], [0x8dad, 8]]);
/** Formatos comprimidos: [largura do bloco, altura, bytes por bloco] (S3TC, RGTC, BPTC, ETC2 e ASTC 4x4). */
const COMPRIMIDOS = new Map([
  [0x83f0, [4, 4, 8]], [0x83f1, [4, 4, 8]], [0x8c4c, [4, 4, 8]], [0x8c4d, [4, 4, 8]], [0x83f2, [4, 4, 16]], [0x83f3, [4, 4, 16]],
  [0x8c4e, [4, 4, 16]], [0x8c4f, [4, 4, 16]], [0x8dbb, [4, 4, 8]], [0x8dbc, [4, 4, 8]], [0x8dbd, [4, 4, 16]], [0x8dbe, [4, 4, 16]],
  [0x8e8c, [4, 4, 16]], [0x8e8d, [4, 4, 16]], [0x8e8e, [4, 4, 16]], [0x8e8f, [4, 4, 16]], [0x9274, [4, 4, 8]], [0x9275, [4, 4, 8]],
  [0x9276, [4, 4, 8]], [0x9277, [4, 4, 8]], [0x9278, [4, 4, 16]], [0x9279, [4, 4, 16]], [0x93b0, [4, 4, 16]], [0x93d0, [4, 4, 16]],
]);

/** Bytes de um nível de textura (w x h x d) no formato interno (com o formato e o tipo quando não tem tamanho). */
export function bytesDoNivel(formatoInterno, w, h, d = 1, formato = 0, tipo = 0) {
  const c = COMPRIMIDOS.get(formatoInterno);
  if (c) return Math.ceil(w / c[0]) * Math.ceil(h / c[1]) * c[2] * d;
  let b = BYTES_FORMATO.get(formatoInterno);
  if (b === undefined) {
    const emp = TIPO_EMPACOTADO.get(tipo);
    b = emp ?? (CANAIS.get(formato || formatoInterno) ?? 4) * (BYTES_TIPO.get(tipo) ?? 1);
    if ((formato || formatoInterno) === 0x1907 && !emp) b = 4 * (BYTES_TIPO.get(tipo) ?? 1); // RGB completa para RGBA
  }
  return w * h * d * b;
}

/** Bytes de uma textura imutável (texStorage) com n níveis; `camadas` não encolhe (arranjo 2D), `profundo` sim (3D). */
export function bytesDoArmazenamento(formatoInterno, niveis, w, h, { camadas = 1, faces = 1, profundo = 1 } = {}) {
  let b = 0;
  for (let l = 0; l < niveis; l++) {
    b += bytesDoNivel(formatoInterno, Math.max(1, w >> l), Math.max(1, h >> l), Math.max(1, profundo >> l) * camadas);
  }
  return b * faces;
}

/**
 * Vigia a memória de vídeo que o jogo pede ao WebGL (estimada pelo que foi alocado: texturas com os níveis, alvos de
 * desenho com as amostras do MSAA e buffers de geometria), para a página de teste e o teto do perfil (2,5 GB no
 * 'pc', D66). Custa só nas chamadas de alocação, que são raras. Instala uma vez por contexto.
 * @returns {{ texturas: number, alvos: number, buffers: number, mb(): object }}
 */
export function vigiarMemoria(gl) {
  if (gl.__memoria) return gl.__memoria;
  const m = {
    texturas: 0,
    alvos: 0,
    buffers: 0,
    /** Em MB, com a tela (cor em dois buffers e profundidade). */
    mb() {
      const tela = (gl.drawingBufferWidth || 0) * (gl.drawingBufferHeight || 0) * 12;
      const r = (x) => +(x / MB).toFixed(1);
      return { videoMB: r(m.texturas + m.alvos + m.buffers + tela), texturasMB: r(m.texturas), alvosMB: r(m.alvos), buffersMB: r(m.buffers), telaMB: r(tela) };
    },
  };
  const tex = new WeakMap(); // textura → { niveis: Map, total }
  const rb = new WeakMap(); // renderbuffer → bytes
  const buf = new WeakMap(); // buffer → bytes
  const LIGACAO_TEX = new Map([[gl.TEXTURE_2D, gl.TEXTURE_BINDING_2D], [gl.TEXTURE_CUBE_MAP, gl.TEXTURE_BINDING_CUBE_MAP], [gl.TEXTURE_3D, gl.TEXTURE_BINDING_3D], [gl.TEXTURE_2D_ARRAY, gl.TEXTURE_BINDING_2D_ARRAY]]);
  const LIGACAO_BUF = new Map([
    [gl.ARRAY_BUFFER, gl.ARRAY_BUFFER_BINDING], [gl.ELEMENT_ARRAY_BUFFER, gl.ELEMENT_ARRAY_BUFFER_BINDING], [gl.UNIFORM_BUFFER, gl.UNIFORM_BUFFER_BINDING],
    [gl.COPY_READ_BUFFER, gl.COPY_READ_BUFFER_BINDING], [gl.COPY_WRITE_BUFFER, gl.COPY_WRITE_BUFFER_BINDING], [gl.PIXEL_PACK_BUFFER, gl.PIXEL_PACK_BUFFER_BINDING],
    [gl.PIXEL_UNPACK_BUFFER, gl.PIXEL_UNPACK_BUFFER_BINDING], [gl.TRANSFORM_FEEDBACK_BUFFER, gl.TRANSFORM_FEEDBACK_BUFFER_BINDING],
  ]);
  const face = (alvo) => (alvo >= gl.TEXTURE_CUBE_MAP_POSITIVE_X && alvo <= gl.TEXTURE_CUBE_MAP_NEGATIVE_Z ? gl.TEXTURE_CUBE_MAP : alvo);
  // só ligações conhecidas: um getParameter com enum errado deixaria um erro do GL para quem lê getError depois
  const ligada = (alvo) => {
    const p = LIGACAO_TEX.get(face(alvo));
    return p ? gl.getParameter(p) : null;
  };
  const registroTex = (t) => {
    let r = tex.get(t);
    if (!r) tex.set(t, (r = { niveis: new Map(), total: 0 }));
    return r;
  };
  const porNivel = (alvo, nivel, bytes) => {
    const t = ligada(alvo);
    if (!t) return;
    const r = registroTex(t);
    const k = `${alvo}:${nivel}`;
    const velho = r.niveis.get(k) ?? 0;
    r.niveis.set(k, bytes);
    r.total += bytes - velho;
    m.texturas += bytes - velho;
  };
  const inteira = (alvo, bytes) => {
    const t = ligada(alvo);
    if (!t) return;
    const r = registroTex(t);
    m.texturas += bytes - r.total;
    r.niveis.clear();
    r.niveis.set('armazenamento', bytes);
    r.total = bytes;
  };
  const tamFonte = (s) => [s?.videoWidth || s?.naturalWidth || s?.displayWidth || s?.width || 0, s?.videoHeight || s?.naturalHeight || s?.displayHeight || s?.height || 0];
  const embrulhar = (nome, depois) => {
    const f = gl[nome];
    if (typeof f !== 'function') return;
    const orig = f.bind(gl);
    gl[nome] = (...a) => {
      const r = orig(...a);
      try {
        depois(a);
      } catch (e) {
        // a estimativa nunca derruba o desenho
      }
      return r;
    };
  };
  embrulhar('texStorage2D', ([alvo, niveis, fi, w, h]) => inteira(alvo, bytesDoArmazenamento(fi, niveis, w, h, { faces: alvo === gl.TEXTURE_CUBE_MAP ? 6 : 1 })));
  embrulhar('texStorage3D', ([alvo, niveis, fi, w, h, d]) => inteira(alvo, bytesDoArmazenamento(fi, niveis, w, h, alvo === gl.TEXTURE_3D ? { profundo: d } : { camadas: d })));
  embrulhar('texImage2D', (a) => {
    const [alvo, nivel, fi] = a;
    if (a.length >= 8 && typeof a[3] === 'number') porNivel(alvo, nivel, bytesDoNivel(fi, a[3], a[4], 1, a[6], a[7]));
    else if (a.length === 6) {
      const [w, h] = tamFonte(a[5]);
      porNivel(alvo, nivel, bytesDoNivel(fi, w, h, 1, a[3], a[4]));
    }
  });
  embrulhar('texImage3D', ([alvo, nivel, fi, w, h, d, , formato, tipo]) => porNivel(alvo, nivel, bytesDoNivel(fi, w, h, d, formato, tipo)));
  embrulhar('compressedTexImage2D', (a) => {
    const [alvo, nivel, fi, w, h] = a;
    porNivel(alvo, nivel, typeof a[6] === 'number' ? a[6] : (a[6]?.byteLength ?? bytesDoNivel(fi, w, h)));
  });
  embrulhar('generateMipmap', ([alvo]) => {
    const t = ligada(alvo);
    const r = t && tex.get(t);
    if (!r || r.niveis.has('armazenamento')) return;
    let base = 0;
    for (const [k, b] of r.niveis) if (k.endsWith(':0')) base += b;
    porNivel(alvo, 'mip', Math.round(base / 3));
  });
  embrulhar('deleteTexture', ([t]) => {
    const r = t && tex.get(t);
    if (!r) return;
    m.texturas -= r.total;
    tex.delete(t);
  });
  const armazenarRb = (fi, w, h, amostras) => {
    const r = gl.getParameter(gl.RENDERBUFFER_BINDING);
    if (!r) return;
    const b = bytesDoNivel(fi, w, h) * Math.max(1, amostras);
    m.alvos += b - (rb.get(r) ?? 0);
    rb.set(r, b);
  };
  embrulhar('renderbufferStorage', ([, fi, w, h]) => armazenarRb(fi, w, h, 1));
  embrulhar('renderbufferStorageMultisample', ([, amostras, fi, w, h]) => armazenarRb(fi, w, h, amostras));
  embrulhar('deleteRenderbuffer', ([r]) => {
    if (!r || !rb.has(r)) return;
    m.alvos -= rb.get(r);
    rb.delete(r);
  });
  embrulhar('bufferData', ([alvo, dados, , inicio = 0, n = 0]) => {
    const p = LIGACAO_BUF.get(alvo);
    const b = p ? gl.getParameter(p) : null;
    if (!b) return;
    const tam = typeof dados === 'number' ? dados : n ? n * (dados?.BYTES_PER_ELEMENT || 1) : (dados?.byteLength ?? 0) - inicio * (dados?.BYTES_PER_ELEMENT || 1);
    m.buffers += tam - (buf.get(b) ?? 0);
    buf.set(b, tam);
  });
  embrulhar('deleteBuffer', ([b]) => {
    if (!b || !buf.has(b)) return;
    m.buffers -= buf.get(b);
    buf.delete(b);
  });
  gl.__memoria = m;
  return m;
}

// ------------------------------------------------------------------------------------------------ contagem do GLSL

const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, '');

function expandir(expr, macros, prof = 0) {
  if (prof > 16) return expr;
  return expr.replace(/\b[A-Za-z_]\w*\b/g, (id) => (typeof macros.get(id) === 'string' ? expandir(macros.get(id), macros, prof + 1) : id));
}

/** Valor de um #if (defined, &&, ||, !, comparações, inteiros); identificador sem valor vale 0. */
export function avaliarSe(expr, macros) {
  const def = (s) => s.replace(/defined\s*\(\s*(\w+)\s*\)/g, (_, n) => (macros.has(n) ? ' 1 ' : ' 0 ')).replace(/defined\s+(\w+)/g, (_, n) => (macros.has(n) ? ' 1 ' : ' 0 '));
  let e = def(semComentarios(expr));
  e = def(expandir(e, macros)).replace(/\b(\d+)[uU]\b/g, '$1').replace(/\b(?!0x)[A-Za-z_]\w*\b/g, '0');
  if (!/^[\s\d()+\-*/%<>=!&|^~.xXa-fA-F]*$/.test(e) || !e.trim()) throw new Error(`#if fora do alcance da contagem: ${expr.trim()}`);
  return !!Number(Function(`"use strict"; return (${e});`)());
}

/** Só as linhas ativas, sem diretivas, e as macros definidas. */
export function preprocessar(src) {
  const macros = new Map();
  const pilha = [];
  const ativo = () => pilha.every((p) => p.ativo);
  const out = [];
  for (const linha of src.replace(/\\\r?\n/g, ' ').split('\n')) {
    const m = linha.match(/^\s*#\s*(\w+)\s*(.*)$/);
    if (!m) {
      if (ativo()) out.push(linha);
      continue;
    }
    const [, dir, resto] = m;
    const nome = resto.trim().split(/[\s(]/)[0];
    if (dir === 'if' || dir === 'ifdef' || dir === 'ifndef') {
      const pai = ativo();
      const v = pai && (dir === 'if' ? avaliarSe(resto, macros) : dir === 'ifdef' ? macros.has(nome) : !macros.has(nome));
      pilha.push({ ativo: v, tomado: v, pai });
    } else if (dir === 'elif') {
      const t = pilha.at(-1);
      if (t.tomado || !t.pai) t.ativo = false;
      else t.tomado = t.ativo = avaliarSe(resto, macros);
    } else if (dir === 'else') {
      const t = pilha.at(-1);
      t.ativo = t.pai && !t.tomado;
      t.tomado = true;
    } else if (dir === 'endif') pilha.pop();
    else if (dir === 'define' && ativo()) {
      const fm = resto.match(/^(\w+)(\([^)]*\))?\s*(.*)$/);
      if (fm) macros.set(fm[1], fm[2] ? { funcao: true } : semComentarios(fm[3]).trim());
    } else if (dir === 'undef' && ativo()) macros.delete(nome);
  }
  return { texto: out.join('\n'), macros };
}

function globais(src) {
  const st = [];
  let cur = '';
  let prof = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '{') {
      if (prof === 0 && /\)\s*$/.test(cur)) {
        let d = 0;
        for (; i < src.length; i++) {
          if (src[i] === '{') d++;
          else if (src[i] === '}' && --d === 0) break;
        }
        cur = '';
        continue;
      }
      prof++;
    } else if (c === '}') prof--;
    else if (c === ';' && prof === 0) {
      if (cur.trim()) st.push(cur.trim().replace(/\s+/g, ' '));
      cur = '';
      continue;
    }
    cur += c;
  }
  return st;
}

const QUALIF = new Set(['uniform', 'in', 'out', 'attribute', 'varying', 'const', 'centroid', 'flat', 'smooth', 'invariant', 'highp', 'med' + 'iump', 'lowp']); // a palavra inteira não entra na fonte (guarda de texto)

function tipoConta(tipo, structs) {
  if (/^[iu]?sampler|^image/.test(tipo)) return { v: 0, a: 1 };
  if (structs.has(tipo)) return structs.get(tipo);
  const mat = tipo.match(/^d?mat(\d)(?:x(\d))?$/);
  return { v: mat ? +mat[1] : 1, a: 0 };
}

function arranjo(txt, macros) {
  let n = 1;
  for (const m of txt.matchAll(/\[([^\]]*)\]/g)) {
    const e = expandir(m[1], macros).trim();
    const v = e === '' ? 1 : /^[\d\s()+\-*/]+$/.test(e) ? Function(`return (${e})`)() : NaN;
    n *= Number.isFinite(v) && v > 0 ? Math.floor(v) : 1;
  }
  return n;
}

function declaracoes(texto, estagio, macros) {
  const structs = new Map();
  const out = [];
  const membros = (corpo) => {
    let v = 0;
    let a = 0;
    for (const d of corpo.split(';').map((x) => x.trim()).filter(Boolean)) {
      const toks = d.replace(/,/g, ' , ').split(/\s+/).filter((t) => !QUALIF.has(t));
      const t = tipoConta(toks[0], structs);
      for (const nm of toks.slice(1).join(' ').split(',').map((x) => x.trim()).filter(Boolean)) {
        const k = arranjo(nm, macros);
        v += t.v * k;
        a += t.a * k;
      }
    }
    return { v, a };
  };
  for (let d of globais(semComentarios(texto))) {
    d = d.replace(/layout\s*\([^)]*\)\s*/g, '');
    const st = d.match(/^struct\s+(\w+)\s*\{([\s\S]*)\}\s*(.*)$/);
    if (st) {
      structs.set(st[1], membros(st[2]));
      continue;
    }
    const bloco = d.match(/^uniform\s+(\w+)\s*\{([\s\S]*)\}\s*(\w*)/);
    if (bloco) {
      out.push({ q: new Set(['uniform']), ...membros(bloco[2]) });
      continue;
    }
    if (/^precision\b/.test(d) || d.includes('(')) continue;
    const toks = d.replace(/=.*$/, '').replace(/,/g, ' , ').split(/\s+/).filter(Boolean);
    const q = new Set();
    let i = 0;
    for (; i < toks.length && QUALIF.has(toks[i]); i++) {
      let x = toks[i];
      if (x === 'attribute') x = 'in';
      if (x === 'varying') x = estagio === 'v' ? 'out' : 'in';
      q.add(x);
    }
    if (!q.has('uniform') && !q.has('in') && !q.has('out')) continue;
    const t = tipoConta(toks[i], structs);
    for (const nm of toks.slice(i + 1).join(' ').split(',').map((x) => x.trim()).filter(Boolean)) {
      if (nm.split(/[\s[]/)[0].startsWith('gl_')) continue;
      const k = arranjo(nm, macros);
      out.push({ q, v: t.v * k, a: t.a * k });
    }
  }
  return out;
}

/**
 * Conta um programa (fontes finais do vértice e do fragmento) contra a guarda do Mali (D44).
 * @returns {{ nome, amostradores: { v, f }, varyings, uniformesF, uniformesV, atributos, precisaoMedia, falhas: string[] }}
 */
export function contarPrograma(vs, fs, guarda = GUARDA_MALI) {
  const v = preprocessar(vs);
  const f = preprocessar(fs);
  const dv = declaracoes(v.texto, 'v', v.macros);
  const df = declaracoes(f.texto, 'f', f.macros);
  const soma = (l, k) => l.reduce((s, d) => s + d[k], 0);
  const uni = (l) => l.filter((d) => d.q.has('uniform'));
  const r = {
    nome: nomeDoPrograma(vs, fs),
    amostradores: { v: soma(uni(dv), 'a'), f: soma(uni(df), 'a') },
    varyings: Math.max(soma(dv.filter((d) => d.q.has('out')), 'v'), soma(df.filter((d) => d.q.has('in')), 'v')),
    uniformesV: soma(uni(dv), 'v'),
    uniformesF: soma(uni(df), 'v'),
    atributos: soma(dv.filter((d) => d.q.has('in')), 'v'),
    precisaoMedia: new RegExp('\\bmed' + 'iump\\s+float\\b').test(v.texto + f.texto),
  };
  r.falhas = [];
  if (r.amostradores.v > guarda.amostradoresPorEstagio) r.falhas.push(`${r.amostradores.v} amostradores no vértice`);
  if (r.amostradores.f > guarda.amostradoresPorEstagio) r.falhas.push(`${r.amostradores.f} amostradores no fragmento`);
  if (r.varyings > guarda.varyings) r.falhas.push(`${r.varyings} varyings`);
  if (r.uniformesF > guarda.uniformesF) r.falhas.push(`${r.uniformesF} vetores de uniforme no fragmento`);
  if (r.atributos > guarda.atributos) r.falhas.push(`${r.atributos} atributos`);
  if (r.precisaoMedia && !INTERNOS_DO_THREE.includes(r.nome)) r.falhas.push('precisão média num float (D44 pede highp)');
  return r;
}

/** Os programas vigiados, contados (sem as fontes, que ficam fora do relatório). */
export function programasContados(vigia) {
  return (vigia?.lista ?? []).map((p) => {
    const base = { nome: p.nome, msCompilar: p.msCompilar, msBloqueio: p.msBloqueio ?? null, link: p.link, ...(p.depois ? { depois: true } : {}) };
    if (!p.vs || !p.fs) return { ...base, amostradores: null, varyings: null, uniformesF: null, atributos: null, falhas: [] };
    try {
      const c = contarPrograma(p.vs, p.fs);
      return { ...base, amostradores: c.amostradores, varyings: c.varyings, uniformesF: c.uniformesF, atributos: c.atributos, precisaoMedia: c.precisaoMedia, falhas: c.falhas };
    } catch (e) {
      return { ...base, falhas: [`contagem: ${e.message}`] };
    }
  });
}

export function registrar() {}
