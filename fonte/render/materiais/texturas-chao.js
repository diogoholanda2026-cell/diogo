// Texturas do chão e da água (D45, D46), pelo registro de texturas:
//   'chao.ruido'    RGBA8 periódica feita na GPU na carga: manchas, copas da mata e grão
//   'chao.ondas'    normais das ondas da água, periódica
//   'chao.camadas'  detalhe procedural das 8 camadas (DataArrayTexture feita na GPU na carga); userData.ganhos
//                   corrige a média de cada fatia para 1, então o detalhe nunca muda a cor média da paleta
//   'chao.cc0'      o lado B do A/B (D46): começa neutro; carregarCC0() troca pela textura fotográfica CC0 em KTX2
//                   (arte/materiais/chao-camadas.ktx2, feita por ferramentas/codificar-texturas.mjs) quando existe
// ?materiais=proc|cc0 escolhe o que o chão usa (padrão proc; o HTML único é sempre procedural).
import { texturaOndas } from '../geracao/ruido.js';
import { GLSL_GERAR_CAMADAS, GLSL_GERAR_RUIDO, GLSL_MEDIA_FATIA, N_CAMADAS } from './shaders/terreno.glsl.js';
import { porPerfil } from '../motor/perfis.js';

/** Lado do detalhe por perfil (desenho do render 9.3: 512 no Leve, 1024 no Média e 2048 no PC; aqui 512 no Média). */
export const LADO_DETALHE = Object.freeze({ ultra: 1024, alta: 1024, media: 512, leve: 0 });
export const LADO_RUIDO = 256;
export const LADO_ONDAS = 256;
export const SEMENTE_CHAO = 7101;

/** Materiais pedidos na página (?materiais=proc|cc0); fora do navegador, procedural. */
export function modoMateriais() {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? '');
    const m = q.get('materiais');
    return m === 'cc0' || m === 'ab' ? m : 'proc';
  } catch (e) {
    return 'proc';
  }
}

function dataTexture(THREE, dados, n, { repetir = true, mip = true, aniso = 1 } = {}) {
  const t = new THREE.DataTexture(dados, n, n, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = repetir ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.generateMipmaps = mip;
  t.anisotropy = aniso;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * O registro solta a textura (dispose) na troca de qualidade. Numa textura de alvo de render isso não libera nada no
 * three (quem apaga a textura e o framebuffer da GPU é o dispose do alvo): sem este elo, cada troca deixava o ruído e
 * as 8 fatias do detalhe (11 MB no Média, 45 MB no Ultra) presos na GPU.
 */
export function soltarComAlvo(tex, alvo) {
  tex.userData.alvo = alvo;
  tex.addEventListener('dispose', () => alvo.dispose());
}

const anisoDe = (perfil) => porPerfil({ ultra: 8, alta: 8, media: 4, leve: 1 }, perfil) ?? 4;

// Os passes de geração ficam guardados (um por tipo): a troca de qualidade refaz as texturas com o mesmo programa, e a
// bancada confere o programa ligado até o fim (um programa apagado lê como "não ligou").
const passes = new Map();

/** Quadrado de tela cheia (−1 a 1) com uv e o material do passe, criado uma vez por nome. */
function passeTela(THREE, nome, criarMaterial) {
  let p = passes.get(nome);
  if (!p) {
    const material = criarMaterial();
    const cena = new THREE.Scene();
    const malha = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    malha.frustumCulled = false;
    cena.add(malha);
    p = { cena, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), malha, material };
    passes.set(nome, p);
  }
  return p;
}

/**
 * Média de cada fatia de uma textura de camadas (lida da mip de 16 x 16) e o ganho que leva a média a 0,5 por canal.
 * @returns {Float32Array} 3 por fatia
 */
export function medirGanhos(renderer, THREE, tex, lado, fatias = N_CAMADAS) {
  const nivel = Math.max(0, Math.log2(lado / 16));
  const p = passeTela(THREE, 'media', () => new THREE.ShaderMaterial({
    uniforms: { uFonte: { value: null }, uFatia: { value: 0 }, uNivel: { value: 0 } },
    vertexShader: GLSL_MEDIA_FATIA.vertice,
    fragmentShader: GLSL_MEDIA_FATIA.fragmento,
    depthTest: false,
    depthWrite: false,
  }));
  const mat = p.material;
  mat.uniforms.uFonte.value = tex;
  mat.uniforms.uNivel.value = nivel;
  const alvo = new THREE.WebGLRenderTarget(16, 16, { depthBuffer: false, generateMipmaps: false });
  const buf = new Uint8Array(16 * 16 * 4);
  const ganhos = new Float32Array(fatias * 3).fill(1);
  const antes = renderer.getRenderTarget();
  for (let f = 0; f < fatias; f++) {
    mat.uniforms.uFatia.value = f;
    renderer.setRenderTarget(alvo);
    renderer.render(p.cena, p.cam);
    renderer.readRenderTargetPixels(alvo, 0, 0, 16, 16, buf);
    for (let c = 0; c < 3; c++) {
      let s = 0;
      for (let i = 0; i < 256; i++) s += buf[4 * i + c];
      const media = s / 256 / 255;
      ganhos[3 * f + c] = media > 0.02 ? Math.min(2, Math.max(0.5, 0.5 / media)) : 1;
    }
  }
  renderer.setRenderTarget(antes);
  alvo.dispose();
  mat.uniforms.uFonte.value = null;
  return ganhos;
}

/** Detalhe procedural das camadas, gerado na GPU (um passe por fatia) com mipmaps; devolve a textura. */
function gerarCamadas({ renderer, THREE, perfil }) {
  const lado = porPerfil(LADO_DETALHE, perfil) ?? 512;
  if (!lado) return null;
  const alvo = new THREE.WebGLArrayRenderTarget(lado, lado, N_CAMADAS, { depthBuffer: false });
  const tex = alvo.texture;
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = anisoDe(perfil);
  tex.colorSpace = THREE.NoColorSpace;
  const p = passeTela(THREE, 'camadas', () => new THREE.ShaderMaterial({
    uniforms: { uCamada: { value: 0 }, uSemente: { value: SEMENTE_CHAO } },
    vertexShader: GLSL_GERAR_CAMADAS.vertice,
    fragmentShader: GLSL_GERAR_CAMADAS.fragmento,
    depthTest: false,
    depthWrite: false,
  }));
  const mat = p.material;
  const antes = renderer.getRenderTarget();
  for (let k = 0; k < N_CAMADAS; k++) {
    mat.uniforms.uCamada.value = k;
    renderer.setRenderTarget(alvo, k);
    renderer.render(p.cena, p.cam);
  }
  renderer.setRenderTarget(antes);
  tex.userData.ganhos = medirGanhos(renderer, THREE, tex, lado);
  tex.userData.lado = lado;
  tex.userData.fonte = 'proc';
  soltarComAlvo(tex, alvo);
  return tex;
}

/** Ruído do chão, gerado na GPU num passe (periódico, com mipmaps). */
function gerarRuido({ renderer, THREE, perfil }) {
  const alvo = new THREE.WebGLRenderTarget(LADO_RUIDO, LADO_RUIDO, {
    depthBuffer: false,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    anisotropy: anisoDe(perfil),
  });
  alvo.texture.colorSpace = THREE.NoColorSpace;
  const p = passeTela(THREE, 'ruido', () => new THREE.ShaderMaterial({
    uniforms: { uSemente: { value: SEMENTE_CHAO } },
    vertexShader: GLSL_GERAR_RUIDO.vertice,
    fragmentShader: GLSL_GERAR_RUIDO.fragmento,
    depthTest: false,
    depthWrite: false,
  }));
  const antes = renderer.getRenderTarget();
  renderer.setRenderTarget(alvo);
  renderer.render(p.cena, p.cam);
  renderer.setRenderTarget(antes);
  soltarComAlvo(alvo.texture, alvo);
  return alvo.texture;
}

/** Textura neutra (1 x 1 por fatia, multiplicador 1): o lado B antes de a CC0 chegar, ou quando ela não existe. */
function neutra(THREE) {
  const d = new Uint8Array(4 * N_CAMADAS).fill(128);
  for (let i = 0; i < N_CAMADAS; i++) d[4 * i + 3] = 128;
  const t = new THREE.DataArrayTexture(d, 1, 1, N_CAMADAS);
  t.needsUpdate = true;
  t.userData.ganhos = new Float32Array(3 * N_CAMADAS).fill(1);
  t.userData.fonte = 'neutra';
  return t;
}

let promessaCC0 = null;

/** Pasta do transcodificador Basis (basis_transcoder.js e .wasm do three) quando a montagem não diz outra. */
export const PASTA_BASIS = 'basis/';

/**
 * Carrega o detalhe fotográfico CC0 (KTX2 com 8 fatias, na ordem de PALETA_CHAO) listado pela montagem em
 * window.__HELD_MONTAGEM__.texturas['chao-camadas']. O transcodificador Basis vem de montagem.basis ou, sem ela, da
 * pasta PASTA_BASIS ao lado do index. Sem arquivo ou sem transcodificador, resolve null e o chão fica procedural.
 * @returns {Promise<object | null>} a textura (userData.ganhos e userData.fonte = 'cc0') ou null
 */
export function carregarCC0({ renderer, THREE, montagem = null }) {
  if (promessaCC0) return promessaCC0;
  const m = montagem ?? globalThis.__HELD_MONTAGEM__ ?? null;
  const arquivo = m?.texturas?.['chao-camadas'];
  if (!arquivo) return (promessaCC0 = Promise.resolve(null));
  const basis = m.basis ?? PASTA_BASIS;
  promessaCC0 = (async () => {
    try {
      const { KTX2Loader } = await import('three/addons/loaders/KTX2Loader.js');
      const l = new KTX2Loader().setTranscoderPath(basis.endsWith('/') ? basis : `${basis}/`).detectSupport(renderer);
      const tex = await l.loadAsync(arquivo);
      l.dispose();
      if (!tex.isCompressedArrayTexture && !tex.isDataArrayTexture) throw new Error('chao-camadas.ktx2 sem fatias');
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 4;
      tex.colorSpace = THREE.NoColorSpace;
      const lado = tex.image?.width ?? 1024;
      tex.userData.ganhos = medirGanhos(renderer, THREE, tex, lado);
      tex.userData.lado = lado;
      tex.userData.fonte = 'cc0';
      return tex;
    } catch (e) {
      console.warn('chão: materiais CC0 não carregaram; fica o procedural', e);
      return null;
    }
  })();
  return promessaCC0;
}

export function registrar(api) {
  api.registrarTextura('chao.ruido', gerarRuido);
  api.registrarTextura('chao.ondas', ({ THREE }) => dataTexture(THREE, texturaOndas(LADO_ONDAS, SEMENTE_CHAO + 1), LADO_ONDAS, { aniso: 4 }));
  api.registrarTextura('chao.camadas', gerarCamadas);
  api.registrarTextura('chao.cc0', ({ THREE }) => neutra(THREE));
}
