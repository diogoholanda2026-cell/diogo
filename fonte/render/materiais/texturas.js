// Registro de texturas (D45): cada parcela registra o gerador das suas no próprio arquivo (texturas-chao.js da R2a,
// texturas-via.js da R3a, texturas-predio.js da R4a) e quem usa pede pelo nome. A textura nasce na primeira vez que é
// pedida (na carga, na GPU quando o gerador quiser) e fica guardada até o render ser descartado ou a qualidade mudar.
//
//   registrarTextura('asfalto', ({ renderer, THREE, perfil }) => textura)
//   const t = textura('asfalto');
//
// O THREE do contexto (dos geradores, de ctx.THREE e da api dos registros) é THREE_TEXTURAS, um subconjunto: texturas,
// alvos de render, o passe de tela cheia e as constantes. O namespace inteiro passado como valor impedia o esbuild de
// podar o three (177 KB a mais no pacote, A1). Quem precisa de outra classe importa o three no próprio arquivo; o teste
// da casca confere que todo THREE.X lido do contexto está aqui.
import * as THREE from 'three';

export const THREE_TEXTURAS = Object.freeze({
  Texture: THREE.Texture, DataTexture: THREE.DataTexture, DataArrayTexture: THREE.DataArrayTexture, Data3DTexture: THREE.Data3DTexture,
  CanvasTexture: THREE.CanvasTexture, WebGLRenderTarget: THREE.WebGLRenderTarget, WebGLArrayRenderTarget: THREE.WebGLArrayRenderTarget,
  Scene: THREE.Scene, Mesh: THREE.Mesh, PlaneGeometry: THREE.PlaneGeometry, OrthographicCamera: THREE.OrthographicCamera,
  ShaderMaterial: THREE.ShaderMaterial,
  RedFormat: THREE.RedFormat, RGFormat: THREE.RGFormat, RGBAFormat: THREE.RGBAFormat,
  UnsignedByteType: THREE.UnsignedByteType, HalfFloatType: THREE.HalfFloatType, FloatType: THREE.FloatType,
  NearestFilter: THREE.NearestFilter, LinearFilter: THREE.LinearFilter, NearestMipmapNearestFilter: THREE.NearestMipmapNearestFilter,
  LinearMipmapNearestFilter: THREE.LinearMipmapNearestFilter, LinearMipmapLinearFilter: THREE.LinearMipmapLinearFilter,
  ClampToEdgeWrapping: THREE.ClampToEdgeWrapping, RepeatWrapping: THREE.RepeatWrapping, MirroredRepeatWrapping: THREE.MirroredRepeatWrapping,
  NoColorSpace: THREE.NoColorSpace, SRGBColorSpace: THREE.SRGBColorSpace, LinearSRGBColorSpace: THREE.LinearSRGBColorSpace,
});

const geradores = new Map();
const cache = new Map();
let contexto = null;

/**
 * Registra o gerador de uma textura. Registrar de novo o mesmo nome troca o gerador (e esquece a guardada).
 * @param {string} nome
 * @param {(ctx: { renderer: object, THREE: object, perfil: object }) => object} gerador  devolve uma THREE.Texture
 */
export function registrarTextura(nome, gerador) {
  if (typeof gerador !== 'function') throw new Error(`registrarTextura(${nome}): gerador não é função`);
  geradores.set(nome, gerador);
  const velha = cache.get(nome);
  if (velha) {
    velha.dispose?.();
    cache.delete(nome);
  }
}

/** O render liga o contexto dos geradores (renderer, THREE e o perfil) ao nascer e ao trocar de qualidade. */
export function ligarTexturas(ctx) {
  contexto = ctx;
  descartarTexturas();
}

/** A textura pelo nome (null se ninguém registrou). */
export function textura(nome) {
  if (cache.has(nome)) return cache.get(nome);
  const g = geradores.get(nome);
  if (!g || !contexto) return null;
  const t = g(contexto);
  cache.set(nome, t);
  return t;
}

/** Nomes registrados. */
export const texturasRegistradas = () => [...geradores.keys()];

/** Solta da GPU todas as texturas guardadas (os geradores ficam). */
export function descartarTexturas() {
  for (const t of cache.values()) t?.dispose?.();
  cache.clear();
}

/** Memória aproximada das texturas guardadas, em MB (largura x altura x 4, com mipmaps). */
export function memoriaTexturasMB() {
  let b = 0;
  for (const t of cache.values()) {
    const img = t?.image;
    const w = img?.width || 0;
    const h = img?.height || 0;
    b += w * h * 4 * (t?.generateMipmaps ? 1.34 : 1);
  }
  return b / 1048576;
}
