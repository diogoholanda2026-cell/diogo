// Sonda de capacidades (D33, D44, 5.3): o que o aparelho aceita (limites do WebGL2, extensões, precisão, formatos) e
// o que cada programa compilado custa: amostradores por estágio, varyings, vetores de uniforme do fragmento e
// atributos (contados no GLSL final, depois do pré-processador, pela mesma regra do GLSL ES 3.0), mais o tempo de
// compilação. O vigia entra no contexto antes do primeiro programa (renderizador.js) e anota cada linkProgram; as
// fontes só ficam guardadas numa página de teste (?painel=1, ?bancada=1, ?sonda=1, ?teste=1), para não gastar
// memória no jogo. A mesma sonda roda no Chromium de teste (ferramentas/sonda-gpu.mjs) e na página de teste da prévia.
// A guarda do Mali (GUARDA_MALI do contrato) acusa os programas acima de 12 amostradores por estágio, 12 varyings,
// 200 vetores de uniforme no fragmento ou 14 atributos, e qualquer precisão média.
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

/**
 * Vigia os programas do contexto: tempo de compilação (do linkProgram até o estado da ligação ser lido) e, numa
 * página de teste, as fontes finais. Instala uma vez por contexto.
 * @returns {{ lista: Array<{ nome: string, msCompilar: number | null, link: boolean | null, vs?: string, fs?: string }> }}
 */
export function vigiarProgramas(gl, { fontes = paginaDeTeste() } = {}) {
  if (gl.__vigia) return gl.__vigia;
  const vigia = { lista: [], fontes };
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
    const reg = { nome, msCompilar: null, link: null, t0: agora() };
    if (vigia.fontes) {
      reg.vs = vs;
      reg.fs = fs;
    }
    vigia.lista.push(reg);
    porPrograma.set(p, reg);
    return lk(p);
  };
  // a primeira leitura do estado da ligação espera a compilação terminar: é aí que o tempo fecha
  gl.getProgramParameter = (p, k) => {
    const r = gp(p, k);
    const reg = porPrograma.get(p);
    if (reg && reg.msCompilar === null && k === gl.LINK_STATUS) {
      reg.msCompilar = +(agora() - reg.t0).toFixed(2);
      reg.link = !!r;
    }
    return r;
  };
  gl.__vigia = vigia;
  return vigia;
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
    const base = { nome: p.nome, msCompilar: p.msCompilar, link: p.link };
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
