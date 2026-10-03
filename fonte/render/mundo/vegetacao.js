// Vegetação de perto (desenho do render 7, D43): domínio 'vegetacao'. De longe a mata é a copa pintada e levantada
// no terreno (R2a); perto da câmera as árvores de verdade tomam o lugar dela, cada uma na copa que o chão pintava
// (geracao/arvores.js: a mesma rede de copas da textura de ruído, bit a bit), e o chão baixa a copa (copaPerto) e
// apaga as árvores soltas, a mata ciliar, as moitas e o jundu pintados (vegetacaoPerto). Por espécie e LOD:
//   LOD0  a árvore inteira (cartas de folhas com recorte), até `lod0` m e dentro do teto de triângulos do perfil
//   LOD1  poucas cartas grandes viradas para fora, até `lod1` m
//   impostor  uma carta por árvore com a vista assada mais perto da direção da câmera (geracao/impostor.js), num
//         atlas só para todas as espécies: 1 chamada, até `perto` m, esmaecendo (pontilhado) na faixa da troca
// As árvores de LOD0 e LOD1 projetam na sombra própria (ctx.sombra, gêmeos com o recorte das folhas); o impostor não.
// Fontes das árvores: a mata e o campo (pela pintura do chão), a rua (os setores de vias, quando o domínio 'props'
// deixa de desenhar as copas dele) e as plantadas por outros domínios (ctx.vegetacao.plantar: lotes, praças, a
// Arcologia).
import * as THREE from 'three';
import {
  ESPECIES, N_ESPECIES, ESPECIE, gerarArvore, copasNoRetangulo, vegetacaoPintada, arvoreDaCopa, moitaDaCopa,
} from '../geracao/arvores.js';
import { QUADROS, dispor, cameraDoQuadro } from '../geracao/impostor.js';
import { soltarComAlvo } from '../materiais/texturas-chao.js';
import { porPerfil } from '../motor/perfis.js';
import { alturaEm } from '../../comum/altura.js';
import { hashF } from '../geracao/ruido.js';

// ------------------------------------------------------------------------------------------------ parâmetros

/**
 * Por perfil (desenho do render 2.10; o 'pc' herda do Alta): alcances dos LODs (m da câmera), o alcance das árvores
 * de perto e a faixa em que elas esmaecem e a copa pintada volta, o das moitas, o lado de cada vista do impostor (px)
 * e os tetos (triângulos do LOD0 e do LOD1, impostores). A mata é densa: os alcances do desenho (150 e 500 m no Alta)
 * valem para árvores soltas; na mata fechada o que pesa é a sobreposição das cartas recortadas (cada camada paga a luz
 * inteira). Medido no SwiftShader na vista da mata (cena costa, ?vista=mata): 187 árvores no LOD0 custavam 5 vezes as
 * 1.496 do LOD1 e 26 vezes os 780 impostores; daí o LOD0 só até 45 m e o impostor (uma carta por árvore) já aos 140 m
 * no Alta.
 */
export const PERFIL_VEGETACAO = Object.freeze({
  ultra: { lod0: 70, lod1: 200, perto: 900, faixa: 180, moitas: 240, faixaMoitas: 60, impostor: 192, tris0: 200000, tris1: 120000, impostores: 30000 },
  alta: { lod0: 45, lod1: 140, perto: 650, faixa: 150, moitas: 170, faixaMoitas: 45, impostor: 128, tris0: 100000, tris1: 60000, impostores: 14000 },
  media: { lod0: 28, lod1: 90, perto: 420, faixa: 110, moitas: 110, faixaMoitas: 35, impostor: 64, tris0: 40000, tris1: 30000, impostores: 6000 },
  leve: { lod0: 14, lod1: 50, perto: 240, faixa: 70, moitas: 60, faixaMoitas: 20, impostor: 48, tris0: 12000, tris1: 12000, impostores: 2500 },
});
/** Lado (m) dos ladrilhos da mata e do campo (gerados quando entram no alcance, guardados num cache). */
export const LADRILHO = 64;
const MAX_LADRILHOS = 2400;
/** Teto de candidatas por montagem (a chave da ordem guarda a distância e o número da candidata num float64). */
const CANDIDATAS_MAX = 2 ** 22;
/** Campos por árvore nas listas: x, y, z, espécie, altura, largura, giro, tom, semente. */
export const PASSO_ARVORE = 9;
/** Altura das copas pintadas (o terreno, COPA_ALTURA). */
const COPA_ALTURA = 18;

/**
 * Os trechos GLSL das árvores (materiais/shaders/folha.glsl.js, ~17 KB) vêm sob demanda (A1): o domínio pede na
 * criação e só gera o atlas, assa os impostores e compila os materiais depois que eles chegam.
 */
let F = null;
let pedidoF = null;
const carregarGlsl = () => pedidoF ?? (pedidoF = import('../materiais/shaders/folha.glsl.js').then((m) => (F = m)));

const ss = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------------------------------------------ puros (testados)

/**
 * LOD de cada árvore pela distância e pelos tetos: candidatas já em ordem da mais perto para a mais longe.
 * tris: triângulos por espécie no LOD0 e no LOD1. Devolve um Int8Array (0, 1, 2 impostor, -1 nada).
 */
export function escolherLods(dist, especies, n, pv, tris) {
  const lod = new Int8Array(n);
  let t0 = 0;
  let t1 = 0;
  let ni = 0;
  for (let k = 0; k < n; k++) {
    const d = dist[k];
    const e = especies[k];
    if (d < pv.lod0 && t0 + tris[0][e] <= pv.tris0) {
      lod[k] = 0;
      t0 += tris[0][e];
    } else if (d < pv.lod1 && t1 + tris[1][e] <= pv.tris1) {
      lod[k] = 1;
      t1 += tris[1][e];
    } else if (ni < pv.impostores) {
      lod[k] = 2;
      ni++;
    } else lod[k] = -1;
  }
  return lod;
}

/** Esmaecer (1 inteira, 0 sumiu) na faixa do fim do alcance. */
export const esmaecer = (d, alcance, faixa) => 1 - ss(alcance - faixa, alcance, d);

/** Matriz de instância (coluna maior) de uma árvore: base, giro e escalas horizontal e vertical. */
export function matrizArvore(out, o, x, y, z, giro, sx, sy) {
  const c = Math.cos(giro);
  const s = Math.sin(giro);
  out[o] = c * sx;
  out[o + 1] = 0;
  out[o + 2] = -s * sx;
  out[o + 3] = 0;
  out[o + 4] = 0;
  out[o + 5] = sy;
  out[o + 6] = 0;
  out[o + 7] = 0;
  out[o + 8] = s * sx;
  out[o + 9] = 0;
  out[o + 10] = c * sx;
  out[o + 11] = 0;
  out[o + 12] = x;
  out[o + 13] = y;
  out[o + 14] = z;
  out[o + 15] = 1;
}

// amostras do chão na CPU ---------------------------------------------------------------------------

/** Ruído RGBA8 (lado n, periódico) com bilinear entre os centros dos texels, como a textura com repetição. */
function lerRuido(buf, n, u, v, out) {
  const x = u * n - 0.5;
  const y = v * n - 0.5;
  const i0 = Math.floor(x);
  const j0 = Math.floor(y);
  const fx = x - i0;
  const fy = y - j0;
  const m = (a) => ((a % n) + n) % n;
  const a = 4 * (m(j0) * n + m(i0));
  const b = 4 * (m(j0) * n + m(i0 + 1));
  const c = 4 * (m(j0 + 1) * n + m(i0));
  const d = 4 * (m(j0 + 1) * n + m(i0 + 1));
  for (let q = 0; q < 4; q++) {
    const l0 = buf[a + q] + (buf[b + q] - buf[a + q]) * fx;
    const l1 = buf[c + q] + (buf[d + q] - buf[c + q]) * fx;
    out[q] = (l0 + (l1 - l0) * fy) / 255;
  }
  return out;
}

/**
 * O que o chão sabe num ponto (cota, normal y, floresta, água, mar, uso do solo) e os três ruídos, pelas amostras de
 * ctx.chao.amostras(). null fora do mapa.
 */
export function amostraDoChao(A, x, z, r1, r2, r3) {
  const T = A.T;
  const n = T.n;
  const i = Math.round((x - T.origem[0]) / T.passo);
  const j = Math.round((z - T.origem[1]) / T.passo);
  if (i < 0 || j < 0 || i >= n || j >= n) return null;
  const k = 4 * (j * n + i);
  const D = A.dados;
  const nx = (D[k] / 255) * 2 - 1;
  const nz = (D[k + 1] / 255) * 2 - 1;
  const ag = D[k + 3];
  const mar = ag >= 128 ? 1 : 0;
  let urb = 0;
  if (A.uso) {
    const L = A.ladoUso;
    const iu = Math.floor(((x - A.mapa.ox) / A.mapa.lado) * L);
    const ju = Math.floor(((z - A.mapa.oz) / A.mapa.lado) * L);
    if (iu >= 0 && ju >= 0 && iu < L && ju < L) {
      const ku = 4 * (ju * L + iu);
      urb = (A.uso[ku] + A.uso[ku + 1] + A.uso[ku + 2] + A.uso[ku + 3]) / 255;
    }
  }
  if (A.ruido) {
    const nr = A.ladoRuido;
    lerRuido(A.ruido, nr, x / 2300, z / 2300, r1);
    lerRuido(A.ruido, nr, x / 263 + 0.31, z / 263 + 0.17, r2);
    lerRuido(A.ruido, nr, x / 71 + 0.57, z / 71 + 0.83, r3);
  }
  return {
    h: alturaEm(T, x, z),
    ny: Math.sqrt(Math.max(0, 1 - nx * nx - nz * nz)),
    mata: D[k + 2] / 255,
    agua: (ag - 128 * mar) * 2,
    mar,
    urb,
  };
}

/**
 * Árvores e moitas de um ladrilho (x0, z0 do canto, lado LADRILHO): as copas da rede grande onde o chão pinta árvore
 * (mata, árvore solta, ciliar, encosta) e as da rede pequena onde pinta moita ou restinga. Listas de PASSO_ARVORE.
 * @returns {{ arvores: Float32Array, moitas: Float32Array }}
 */
export function gerarLadrilho(A, x0, z0, lado = LADRILHO) {
  const r1 = [0.5, 0.5, 0.5, 0.5];
  const r2 = [0.5, 0.5, 0.5, 0.5];
  const r3 = [0.5, 0.5, 0.5, 0.5];
  const arv = [];
  for (const c of copasNoRetangulo('grande', x0, z0, x0 + lado, z0 + lado)) {
    const e = amostraDoChao(A, c.x, c.z, r1, r2, r3);
    if (!e || e.h < 0.3) continue;
    const v = vegetacaoPintada(e, r1, r2, r3);
    const a = arvoreDaCopa(c, v, hashF(Math.floor(c.id * 1e6), 3, 17));
    if (!a) continue;
    arv.push(c.x, e.h - 0.25, c.z, a.especie, a.altura, a.largura, c.id * 6.2831853 * 7.0, hashF(Math.floor(c.id * 1e6), 5, 17), c.alt);
  }
  const moi = [];
  for (const c of copasNoRetangulo('pequena', x0, z0, x0 + lado, z0 + lado)) {
    const e = amostraDoChao(A, c.x, c.z, r1, r2, r3);
    if (!e || e.h < 0.3) continue;
    const v = vegetacaoPintada(e, r1, r2, r3);
    const m = moitaDaCopa(c, v, hashF(Math.floor(c.id * 1e6), 7, 23));
    if (!m) continue;
    // a restinga é mais clara e mais seca (o tom vai para o fim da faixa); o sub-bosque, na sombra, mais escuro
    const tom = m.restinga ? 0.85 + 0.15 * c.alt : m.subBosque ? 0.05 + 0.25 * c.alt : 0.2 + 0.6 * c.alt;
    moi.push(c.x, e.h - 0.15, c.z, m.especie, m.altura, m.largura, c.id * 6.2831853 * 5.0, tom, m.restinga ? 0.9 : 0.3);
  }
  return { arvores: Float32Array.from(arv), moitas: Float32Array.from(moi) };
}

// ------------------------------------------------------------------------------------------------ texturas

/** Atlas de folhas (desenho 9.3), feito na GPU num passe, com mipmaps. */
function gerarFolhas({ renderer, THREE: T, perfil }) {
  // sem o GLSL ainda, falha sem guardar nada (o domínio só pede depois que ele chega)
  if (!F) throw new Error('vegetação: o GLSL das folhas ainda não chegou');
  const { GLSL_GERAR_FOLHAS, LADO_FOLHAS } = F;
  const lado = porPerfil(LADO_FOLHAS, perfil) ?? 1024;
  const alvo = new T.WebGLRenderTarget(lado, lado / 2, {
    depthBuffer: false,
    generateMipmaps: true,
    minFilter: T.LinearMipmapLinearFilter,
    magFilter: T.LinearFilter,
    wrapS: T.ClampToEdgeWrapping,
    wrapT: T.ClampToEdgeWrapping,
    anisotropy: 4,
  });
  alvo.texture.colorSpace = T.NoColorSpace;
  // com nome: a bancada e a página de teste dizem de quem é o programa (o material é descartado logo depois)
  const mat = new T.ShaderMaterial({ name: 'arvores:gerar-folhas', uniforms: { uSemente: { value: 4243 } }, vertexShader: GLSL_GERAR_FOLHAS.vertice, fragmentShader: GLSL_GERAR_FOLHAS.fragmento, depthTest: false, depthWrite: false });
  const cena = new T.Scene();
  const q = new T.Mesh(new T.PlaneGeometry(2, 2), mat);
  q.frustumCulled = false;
  cena.add(q);
  const antes = renderer.getRenderTarget();
  renderer.setRenderTarget(alvo);
  renderer.render(cena, new T.OrthographicCamera(-1, 1, 1, -1, 0, 1));
  renderer.setRenderTarget(antes);
  q.geometry.dispose();
  mat.dispose();
  alvo.texture.userData.lado = lado;
  soltarComAlvo(alvo.texture, alvo);
  return alvo.texture;
}

// ------------------------------------------------------------------------------------------------ materiais

function trocar(src, alvo, novo) {
  if (!src.includes(alvo)) throw new Error(`vegetação: shader do three sem '${alvo}'`);
  return src.replace(alvo, novo);
}

// sem o HAO (o escuro do pé das paredes e do chão entre prédios; na copa só custava uma leitura por camada de folha)
const GANCHOS_ARVORE = ['sombra', 'sombraLonge', 'noite', 'neblina'];

/** Material das árvores (LOD0 com as cartas dos dois lados; LOD1 só de frente, as de trás saem pela face). */
export function criarMaterialArvore(ganchos, U, lod = 0) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.78, metalness: 0, alphaTest: 0.5, alphaToCoverage: true, side: lod ? THREE.FrontSide : THREE.DoubleSide });
  m.name = `arvore-lod${lod}`;
  if (lod) m.defines = { ARV_LOD1: '' };
  m.onBeforeCompile = (sh) => {
    const { GLSL_ARVORE } = F;
    Object.assign(sh.uniforms, U);
    let vs = sh.vertexShader;
    vs = trocar(vs, '#include <common>', `#include <common>\n${GLSL_ARVORE.verticePars}`);
    vs = trocar(vs, '#include <begin_vertex>', `#include <begin_vertex>\n${GLSL_ARVORE.vertice}`);
    vs = trocar(vs, '#include <color_vertex>', `#include <color_vertex>\n${GLSL_ARVORE.cor}`);
    let fs = sh.fragmentShader;
    fs = trocar(fs, '#include <common>', `#include <common>\n${GLSL_ARVORE.fragmentoPars}`);
    fs = trocar(fs, '#include <map_fragment>', GLSL_ARVORE.mapa);
    // a folha de dois lados guarda a normal da copa (não vira com a face)
    fs = trocar(fs, '#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\nif ( vArvCel < 6.5 ) normal = normalize( vNormal );\n#endif');
    fs = trocar(fs, '#include <lights_fragment_end>', `#include <lights_fragment_end>\n${GLSL_ARVORE.luz}`);
    sh.vertexShader = vs;
    sh.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => `arvore-${lod}`;
  return ganchos.aplicar(m, GANCHOS_ARVORE);
}

/** Material do gêmeo na sombra própria: só a profundidade, com o recorte das folhas. */
export function criarMaterialSombra(U) {
  const m = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
  m.name = 'arvore-sombra';
  m.onBeforeCompile = (sh) => {
    const { GLSL_ARV_SOMBRA } = F;
    Object.assign(sh.uniforms, U);
    let vs = sh.vertexShader;
    vs = trocar(vs, '#include <common>', `#include <common>\n${GLSL_ARV_SOMBRA.verticePars}`);
    vs = trocar(vs, '#include <begin_vertex>', `#include <begin_vertex>\n${GLSL_ARV_SOMBRA.vertice}`);
    let fs = sh.fragmentShader;
    fs = trocar(fs, '#include <common>', `#include <common>\n${GLSL_ARV_SOMBRA.fragmentoPars}`);
    fs = trocar(fs, '#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${GLSL_ARV_SOMBRA.fragmento}`);
    sh.vertexShader = vs;
    sh.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => 'arvore-sombra';
  return m;
}

/** Material dos impostores (as vistas do atlas viradas para a câmera; a normal da copa vem do atlas). */
export function criarMaterialImpostor(ganchos, U) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide });
  m.name = 'arvore-impostor';
  m.onBeforeCompile = (sh) => {
    const { GLSL_IMPOSTOR } = F;
    Object.assign(sh.uniforms, U);
    let vs = sh.vertexShader;
    vs = trocar(vs, '#include <common>', `#include <common>\n${GLSL_IMPOSTOR.verticePars}`);
    vs = trocar(vs, '#include <begin_vertex>', GLSL_IMPOSTOR.vertice);
    let fs = sh.fragmentShader;
    fs = trocar(fs, '#include <common>', `#include <common>\n${GLSL_IMPOSTOR.fragmentoPars}`);
    fs = trocar(fs, '#include <map_fragment>', GLSL_IMPOSTOR.mapa);
    fs = trocar(fs, '#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${GLSL_IMPOSTOR.normal}`);
    fs = trocar(fs, '#include <lights_fragment_end>', `#include <lights_fragment_end>\n${GLSL_IMPOSTOR.luz}`);
    sh.vertexShader = vs;
    sh.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => 'arvore-impostor';
  return ganchos.aplicar(m, GANCHOS_ARVORE);
}

// ------------------------------------------------------------------------------------------------ malhas

/** Geometria do three de uma malha do gerador. */
function geometriaDe(m) {
  const g = new THREE.BufferGeometry();
  const a = m.atributos;
  g.setAttribute('position', new THREE.BufferAttribute(a.posicao, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(a.normal, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(a.uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(a.cor, 3));
  g.setAttribute('aArv', new THREE.BufferAttribute(a.arv, 2));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  g.computeBoundingSphere();
  return g;
}

/**
 * Um balde de instâncias (uma espécie num LOD): InstancedMesh que cresce. Com matSombra, o gêmeo na sombra própria;
 * fora da cena (naCena false), ele só projeta: as árvores de LOD0 e LOD1 projetam com a malha do LOD1 (o recorte das
 * cartas grandes dá a mesma sombra no texel da cascata, com um décimo dos triângulos).
 */
class Balde {
  constructor(ctx, base, material, nome, matSombra = null, naCena = true) {
    this.ctx = ctx;
    this.base = base;
    this.material = material;
    this.nome = nome;
    this.matSombra = matSombra;
    this.naCena = naCena;
    this.cap = 0;
    this.n = 0;
    this.malha = null;
    this._garantir(64);
  }

  _garantir(n) {
    if (n <= this.cap) return;
    const cap = Math.max(64, 2 ** Math.ceil(Math.log2(n * 1.25)));
    const { ctx } = this;
    const g = new THREE.BufferGeometry();
    for (const [k, a] of Object.entries(this.base.attributes)) g.setAttribute(k, a);
    g.setIndex(this.base.index);
    const ai = new THREE.InstancedBufferAttribute(new Uint8Array(cap * 4), 4, true);
    ai.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aInst', ai);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    const m = new THREE.InstancedMesh(g, this.material, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
    m.visible = false;
    m.frustumCulled = false;
    m.matrixAutoUpdate = false;
    m.name = this.nome;
    const velha = this.malha;
    if (velha) {
      if (this.naCena) ctx.cena.remove(velha);
      if (this.matSombra) ctx.sombra.soltar(velha);
      this._soltarGeometria(velha.geometry);
      velha.dispose();
    }
    if (this.naCena) {
      ctx.medidas.familia(m, 'arvores');
      ctx.cena.add(m);
    }
    if (this.matSombra) ctx.medidas.familia(ctx.sombra.projetor(m, { material: this.matSombra }), 'sombra');
    this.malha = m;
    this.cap = cap;
  }

  /**
   * Solta só o que é desta geometria (o aInst). A forma (posição, normal, uv, cor, aArv e índices) é da espécie e
   * outros baldes a usam (o do outro LOD na sombra própria, por exemplo): o dispose do three apagaria os buffers dela
   * na GPU, e o VAO guardado dos outros baldes seguiria apontando para os apagados.
   */
  _soltarGeometria(g) {
    for (const k of Object.keys(this.base.attributes)) g.deleteAttribute(k);
    g.setIndex(null);
    g.dispose();
  }

  /** Escreve n instâncias (matrizes e bytes); o envio é só do trecho usado. */
  escrever(n, mats, bytes) {
    this._garantir(n);
    const m = this.malha;
    if (n) {
      m.instanceMatrix.array.set(mats.subarray(0, n * 16));
      m.geometry.attributes.aInst.array.set(bytes.subarray(0, n * 4));
    }
    for (const [a, k] of [[m.instanceMatrix, 16], [m.geometry.attributes.aInst, 4]]) {
      a.clearUpdateRanges();
      if (n) a.addUpdateRange(0, n * k);
      a.needsUpdate = true;
    }
    m.count = n;
    m.visible = n > 0;
    this.n = n;
  }

  descartar() {
    if (!this.malha) return;
    if (this.naCena) this.ctx.cena.remove(this.malha);
    if (this.matSombra) this.ctx.sombra.soltar(this.malha);
    this._soltarGeometria(this.malha.geometry);
    this.malha.dispose();
    this.malha = null;
  }
}

/** Os impostores: uma carta (2 triângulos) por árvore, numa geometria instanciada. */
class Impostores {
  constructor(ctx, material) {
    this.ctx = ctx;
    this.material = material;
    this.cap = 0;
    this.n = 0;
    this.malha = null;
    this._garantir(256);
  }

  _garantir(n) {
    if (n <= this.cap) return;
    const cap = Math.max(256, 2 ** Math.ceil(Math.log2(n * 1.25)));
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const at = (dados, k, norm = false) => {
      const a = new THREE.InstancedBufferAttribute(dados, k, norm);
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    };
    g.setAttribute('aImpPos', at(new Float32Array(cap * 4), 4));
    g.setAttribute('aImpEsc', at(new Float32Array(cap * 2), 2));
    g.setAttribute('aInst', at(new Uint8Array(cap * 4), 4, true));
    g.instanceCount = 0;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    const velha = this.malha;
    const m = velha ?? new THREE.Mesh(g, this.material);
    if (velha) {
      velha.geometry.dispose();
      velha.geometry = g;
    } else {
      m.name = 'arvores:impostores';
      m.frustumCulled = false;
      m.visible = false;
      this.ctx.medidas.familia(m, 'arvores');
      this.ctx.cena.add(m);
    }
    this.malha = m;
    this.cap = cap;
  }

  escrever(n, pos, esc, bytes) {
    this._garantir(n);
    const g = this.malha.geometry;
    if (n) {
      g.attributes.aImpPos.array.set(pos.subarray(0, n * 4));
      g.attributes.aImpEsc.array.set(esc.subarray(0, n * 2));
      g.attributes.aInst.array.set(bytes.subarray(0, n * 4));
    }
    for (const [a, k] of [[g.attributes.aImpPos, 4], [g.attributes.aImpEsc, 2], [g.attributes.aInst, 4]]) {
      a.clearUpdateRanges();
      if (n) a.addUpdateRange(0, n * k);
      a.needsUpdate = true;
    }
    g.instanceCount = n;
    this.malha.visible = n > 0;
    this.n = n;
  }

  descartar() {
    if (!this.malha) return;
    this.ctx.cena.remove(this.malha);
    this.malha.geometry.dispose();
    this.malha = null;
  }
}

/**
 * Material, cena e câmera do assado dos impostores (PC3): criados uma vez, quando o GLSL das árvores chega, para o
 * programa compilar em paralelo antes do assado (Aquecimento.compilar) e servir aos assados seguintes (a troca de
 * qualidade). Antes o material nascia no próprio assado e o primeiro desenho esperava a compilação, atrás da fila do
 * aquecimento (no Direct3D do PC do dono, uns 2 s).
 */
function criarAssadorImpostores(U, geo) {
  const { GLSL_IMP_ASSAR } = F;
  const mat = new THREE.ShaderMaterial({
    name: 'arvores:assar-impostores',
    uniforms: { ...U, uModoNormal: { value: 0 } },
    vertexShader: GLSL_IMP_ASSAR.vertice,
    fragmentShader: GLSL_IMP_ASSAR.fragmento,
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  const cena = new THREE.Scene();
  const malha = new THREE.Mesh(geo, mat);
  malha.frustumCulled = false;
  cena.add(malha);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  return { mat, cena, malha, cam };
}

/**
 * Assa as vistas de todas as espécies (LOD0) nos dois atlas: albedo (raiz quadrada) com alfa, e a normal da copa no
 * espaço da árvore. Cada vista é uma câmera ortográfica na esfera do modelo (geracao/impostor.js). Os mipmaps saem
 * uma vez só, no fim. assador: criarAssadorImpostores (o programa já compilado).
 */
function assarImpostores(renderer, modelos0, U, lado, assador) {
  const nE = modelos0.length;
  const D = dispor(nE, lado);
  const criar = () => {
    const a = new THREE.WebGLRenderTarget(D.largura, D.altura, {
      depthBuffer: true, generateMipmaps: false, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
    });
    a.texture.colorSpace = THREE.NoColorSpace;
    return a;
  };
  const alvos = [criar(), criar()];
  const { mat, cena, malha, cam } = assador;
  const antes = renderer.getRenderTarget();
  const corAntes = renderer.getClearColor(new THREE.Color());
  const alfaAntes = renderer.getClearAlpha();
  const autoAntes = renderer.autoClear;
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 0);
  alvos.forEach((alvo, modo) => {
    mat.uniforms.uModoNormal.value = modo;
    alvo.scissorTest = false;
    renderer.setRenderTarget(alvo);
    renderer.clear(true, true, false);
    for (let e = 0; e < nE; e++) {
      const M = modelos0[e];
      malha.geometry = M.geo;
      for (let k = 0; k < QUADROS; k++) {
        const c = cameraDoQuadro(k, M.esfera.centroY, M.esfera.raio);
        cam.left = -c.meio;
        cam.right = c.meio;
        cam.top = c.meio;
        cam.bottom = -c.meio;
        cam.near = c.perto;
        cam.far = c.longe;
        cam.position.set(...c.posicao);
        cam.up.set(...c.cima);
        cam.lookAt(...c.alvo);
        cam.updateProjectionMatrix();
        cam.updateMatrixWorld(true);
        alvo.viewport.set(k * lado, e * lado, lado, lado);
        alvo.scissor.set(k * lado, e * lado, lado, lado);
        alvo.scissorTest = true;
        const ultimo = e === nE - 1 && k === QUADROS - 1;
        alvo.texture.generateMipmaps = ultimo;
        renderer.setRenderTarget(alvo);
        renderer.clear(false, true, false);
        renderer.render(cena, cam);
      }
    }
    alvo.scissorTest = false;
    alvo.viewport.set(0, 0, D.largura, D.altura);
    alvo.scissor.set(0, 0, D.largura, D.altura);
    alvo.texture.generateMipmaps = true;
  });
  renderer.setRenderTarget(antes);
  renderer.setClearColor(corAntes, alfaAntes);
  renderer.autoClear = autoAntes;
  return { alvos, D };
}

// ------------------------------------------------------------------------------------------------ domínio

/**
 * Lista de árvores plantadas no formato das listas (PASSO_ARVORE por árvore), só com as válidas: coordenadas e tamanho
 * finitos, altura positiva e espécie conhecida (id ou índice). Uma inválida (espécie fora da tabela, NaN) quebrava a
 * montagem de todas as árvores no quadro. Aceita a lista de objetos ou um Float32Array já no formato.
 * @returns {Float32Array}
 */
export function plantaveis(itens) {
  const valida = (x, y, z, e, alt, larg) => Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    && Number.isInteger(e) && e >= 0 && e < N_ESPECIES && alt > 0 && alt < 200 && larg > 0 && larg < 200;
  const out = [];
  if (itens instanceof Float32Array) {
    for (let o = 0; o + PASSO_ARVORE <= itens.length; o += PASSO_ARVORE) {
      if (!valida(itens[o], itens[o + 1], itens[o + 2], itens[o + 3], itens[o + 4], itens[o + 5])) continue;
      for (let q = 0; q < PASSO_ARVORE; q++) out.push(Number.isFinite(itens[o + q]) ? itens[o + q] : 0);
    }
    return out.length === itens.length ? itens : Float32Array.from(out);
  }
  itens.forEach((a, k) => {
    const e = typeof a?.especie === 'string' ? ESPECIE[a.especie] : (a?.especie ?? ESPECIE.oiti);
    const P = ESPECIES[e];
    if (!P) return;
    const alt = a.altura ?? P.altura;
    const larg = a.largura ?? (alt * P.largura) / P.altura;
    if (!valida(a.x, a.y, a.z, e, alt, larg)) return;
    out.push(a.x, a.y, a.z, e, alt, larg, a.giro ?? hashF(k, 1, 31) * 6.283, a.tom ?? hashF(k, 2, 31), hashF(k, 3, 31));
  });
  return Float32Array.from(out);
}

/** Instâncias da rua pelos setores de vias (copa: oiti; palmeira: palmeira-imperial), no formato das listas. */
function arvoresDaRua(vias, alcance, out) {
  out.length = 0;
  for (const st of vias.setoresPerto(alcance)) {
    for (const [tipo, esp, alt] of [['copa', ESPECIE.oiti, 8.5], ['palmeira', ESPECIE.palmeira, 21]]) {
      const l = st.objetos?.[tipo];
      if (!l?.n) continue;
      for (let k = 0; k < l.n; k++) {
        const o = 16 * k;
        const sx = Math.hypot(l.mat[o], l.mat[o + 2]) || 1;
        const sy = l.mat[o + 5] || 1;
        const giro = Math.atan2(l.mat[o + 8], l.mat[o]);
        const b = l.bytes ? l.bytes[4 * k] / 255 : 0.5;
        const P = ESPECIES[esp];
        out.push(l.mat[o + 12], l.mat[o + 13], l.mat[o + 14], esp, alt * sy, (P.largura / P.altura) * alt * sx, giro, b, l.bytes ? l.bytes[4 * k + 1] / 255 : 0.5);
      }
    }
  }
  return out;
}

function criarVegetacao(ctx) {
  const chao = ctx.chao ?? ctx.dominio('terreno')?.chao ?? null;
  let pv = porPerfil(PERFIL_VEGETACAO, ctx.perfil);
  const U = {
    gArvFolhas: { value: null },
    gArvLado: { value: 1024 },
    gArvTempo: { value: 0 },
    gArvVento: { value: new THREE.Vector2(0.8, 0.35) },
    gImpCor: { value: null },
    gImpNormal: { value: null },
    gImpAtlas: { value: new THREE.Vector2(QUADROS, N_ESPECIES) },
    gImpEsfera: { value: Array.from({ length: 8 }, () => new THREE.Vector2(1, 1)) },
  };

  // modelos: uma semente por espécie; o tamanho de cada árvore vem da instância
  const modelos = [[], []];
  const tris = [new Float32Array(N_ESPECIES), new Float32Array(N_ESPECIES)];
  for (let e = 0; e < N_ESPECIES; e++) {
    for (const lod of [0, 1]) {
      const m = gerarArvore(e, lod, 1);
      const geo = geometriaDe(m);
      modelos[lod].push({ geo, tris: m.tris, medidas: m.medidas, esfera: { centroY: m.medidas.centroY, raio: m.medidas.raio } });
      tris[lod][e] = m.tris;
    }
    const m0 = modelos[0][e].medidas;
    U.gImpEsfera.value[e].set(m0.centroY, m0.raio);
  }
  // medida de referência de cada espécie (a instância escala para a altura e a largura pedidas)
  const ref = modelos[0].map((m) => ({ altura: m.medidas.altura, largura: 2 * m.medidas.raioH }));

  const mats = [criarMaterialArvore(ctx.ganchos, U, 0), criarMaterialArvore(ctx.ganchos, U, 1)];
  const matSombra = criarMaterialSombra(U);
  const matImp = criarMaterialImpostor(ctx.ganchos, U);
  // as malhas (na cena e na sombra própria) só nascem com o GLSL das árvores, que vem sob demanda: até ele chegar,
  // nada de atlas, assado, montagem nem aquecimento das árvores (o aquecimento compila até o escondido)
  let baldes = null;
  let sombras = null;
  let imp = null;
  let assado = null;
  let assador = null;
  // os programas das árvores, da sombra delas e do assado compilados (Aquecimento.compilar): só então as árvores
  // entram no quadro e o assado roda (PC3)
  let programasProntos = false;
  let comGlsl = false;
  let prepararDepois = false;
  let morto = false;
  let glslFalhou = false;
  const pegarFolhas = () => {
    const t = ctx.textura('arvores.folhas');
    U.gArvFolhas.value = t;
    U.gArvLado.value = t?.userData?.lado ?? 1024;
  };
  function nascer() {
    if (morto || comGlsl) return;
    comGlsl = true;
    pegarFolhas();
    baldes = [0, 1].map((lod) => modelos[lod].map((M, e) => new Balde(ctx, M.geo, mats[lod], `arvores:${ESPECIES[e].id}:${lod}`)));
    sombras = modelos[1].map((M, e) => new Balde(ctx, M.geo, matSombra, `arvores:${ESPECIES[e].id}:sombra`, matSombra, false));
    imp = new Impostores(ctx, matImp);
    assador = criarAssadorImpostores(U, modelos[0][0].geo);
    // chegou depois do aquecimento: uma rodada a mais compila os programas das árvores (nada compila no meio do jogo)
    const aq = ctx.quadro?.aquecer;
    if (aq?.pronto) {
      aq.delete?.(fonteAquecer);
      aq.add?.(fonteAquecer);
    }
    compilarProgramas(aq);
    if (prepararDepois) api.preparar();
  }

  /**
   * Os programas das árvores (os dois LODs e os impostores na cena, o gêmeo da sombra própria e o assado dos
   * impostores, num alvo próprio) compilam já, em paralelo; até ficarem prontos as árvores não entram e o assado não
   * roda. Sem isto o primeiro desenho da sombra das árvores ou o assado esperavam a compilação dentro do quadro (no
   * PC do dono, 'arvore-sombra' e 'arvores:assar-impostores' com uns 2,2 s cada, atrás da fila do aquecimento).
   */
  function compilarProgramas(aq) {
    if (typeof aq?.compilar !== 'function') {
      programasProntos = true;
      return;
    }
    const alvoAssar = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
    const ps = [
      aq.compilar([...baldes[0].map((b) => b.malha), ...baldes[1].map((b) => b.malha), imp.malha]),
      aq.compilar(sombras.map((b) => b.malha), { sombra: true }),
      aq.compilar([assador.cena], { alvo: alvoAssar, cena: assador.cena }),
    ];
    const fim = () => {
      alvoAssar.dispose();
      programasProntos = true;
    };
    Promise.all(ps).then(fim, (e) => {
      console.warn('vegetação: a compilação adiantada falhou; segue sem ela', e);
      fim();
    });
  }
  const fonteAquecer = () => (comGlsl ? [...baldes[0].map((b) => b.malha), ...baldes[1].map((b) => b.malha), imp.malha] : []);

  // ladrilhos da mata e do campo (gerados aos poucos, guardados), a rua e as plantadas
  const ladrilhos = new Map();
  const fila = [];
  const plantadas = new Map();
  const rua = [];
  let ruaArr = new Float32Array(0);
  let chaveRua = '';
  let comRua = false;
  let tRua = -1e9;
  let sujo = true;
  let tAnt = null;
  let ultimo = { x: NaN, y: 0, z: 0, dx: 0, dy: 0, dz: 0, t: -1e9 };
  const estado = { arvores: 0, lod0: 0, lod1: 0, impostores: 0, ladrilhos: 0, msGerar: 0, msMontar: 0 };

  const soltarChao = chao?.aoMudar?.((rets) => {
    if (!rets) ladrilhos.clear();
    else {
      for (const [k, L] of ladrilhos) {
        for (const r of rets) {
          if (L.x0 < r[2] && L.x0 + LADRILHO > r[0] && L.z0 < r[3] && L.z0 + LADRILHO > r[1]) {
            ladrilhos.delete(k);
            break;
          }
        }
      }
    }
    sujo = true;
  });

  function ligarChao(ligado) {
    if (!chao) return;
    chao.copaPerto?.(ligado ? pv.perto : 0, pv.faixa);
    chao.vegetacaoPerto?.(ligado ? pv.perto : 0, pv.faixa, ligado ? pv.moitas : 0, pv.faixaMoitas);
  }
  ligarChao(false);

  /** Gera ladrilhos da fila até o tempo do quadro acabar. */
  function gerarFila(tetoMs) {
    if (!fila.length) return 0;
    const A = chao?.amostras?.();
    if (!A) return 0;
    const t0 = performance.now();
    let n = 0;
    while (fila.length && performance.now() - t0 < tetoMs) {
      const k = fila.shift();
      if (ladrilhos.has(k)) continue;
      const [i, j] = k.split(',').map(Number);
      const L = gerarLadrilho(A, i * LADRILHO, j * LADRILHO);
      ladrilhos.set(k, { x0: i * LADRILHO, z0: j * LADRILHO, ...L, usado: 0 });
      n++;
    }
    estado.msGerar = performance.now() - t0;
    if (n) sujo = true;
    // cache: os mais velhos saem
    if (ladrilhos.size > MAX_LADRILHOS) {
      const velhos = [...ladrilhos.entries()].sort((a, b) => a[1].usado - b[1].usado).slice(0, ladrilhos.size - MAX_LADRILHOS);
      for (const [k] of velhos) ladrilhos.delete(k);
    }
    return n;
  }

  // listas de trabalho (crescem quando preciso): cada candidata guarda a lista (fonte) e a posição nela; a chave da
  // ordem é a distância e o número da candidata (sem limite de listas: um dono por lote passa de milhares)
  let cap = 0;
  let fonteRef = [];
  let candF = new Int32Array(0);
  let candO = new Int32Array(0);
  let ordF = new Int32Array(0);
  let ordO = new Int32Array(0);
  let chaves = new Float64Array(0);
  let distArr = new Float32Array(0);
  let espArr = new Uint8Array(0);
  // saídas por LOD (0, 1) e a da sombra (2: as de LOD0 e LOD1 com a malha do LOD1)
  const saida = [0, 1, 2].map(() => Array.from({ length: N_ESPECIES }, () => ({ mats: new Float32Array(16 * 64), bytes: new Uint8Array(4 * 64), n: 0 })));
  let impPos = new Float32Array(4 * 256);
  let impEsc = new Float32Array(2 * 256);
  let impBytes = new Uint8Array(4 * 256);
  const garantirTrabalho = (n) => {
    if (n <= cap) return;
    cap = Math.max(1024, 2 ** Math.ceil(Math.log2(n)));
    candF = new Int32Array(cap);
    candO = new Int32Array(cap);
    ordF = new Int32Array(cap);
    ordO = new Int32Array(cap);
    chaves = new Float64Array(cap);
    distArr = new Float32Array(cap);
    espArr = new Uint8Array(cap);
  };
  const crescer = (o, n) => {
    if (o.mats.length >= n * 16) return;
    const c = 2 ** Math.ceil(Math.log2(n * 1.25));
    const m = new Float32Array(c * 16);
    m.set(o.mats);
    const b = new Uint8Array(c * 4);
    b.set(o.bytes);
    o.mats = m;
    o.bytes = b;
  };

  const frustum = new THREE.Frustum();
  const m4 = new THREE.Matrix4();
  const camLarga = new THREE.PerspectiveCamera();
  const esfera = new THREE.Sphere();

  /** Escolhe as árvores do alcance, o LOD de cada uma e escreve os baldes (da mais perto para a mais longe). */
  function montar(c) {
    const t0 = performance.now();
    const cam = c.camera;
    const p = cam.position;
    // corte pela vista um pouco mais larga (girar a câmera não mostra o buraco antes da próxima montagem)
    if (cam.isPerspectiveCamera) {
      camLarga.copy(cam, false);
      camLarga.fov = Math.min(170, cam.fov * 1.35);
      camLarga.near = 0.5;
      camLarga.far = pv.perto * 1.2;
      camLarga.updateProjectionMatrix();
      m4.multiplyMatrices(camLarga.projectionMatrix, cam.matrixWorldInverse);
    } else m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    frustum.setFromProjectionMatrix(m4);
    // fontes: os ladrilhos do alcance (pedidos à fila os que faltam), a rua e as plantadas
    fonteRef = [];
    const R = pv.perto;
    const i0 = Math.floor((p.x - R) / LADRILHO);
    const i1 = Math.floor((p.x + R) / LADRILHO);
    const j0 = Math.floor((p.z - R) / LADRILHO);
    const j1 = Math.floor((p.z + R) / LADRILHO);
    const T = ctx.sim.espelho.terreno;
    const yChao = T ? alturaEm(T, p.x, p.z) : 0;
    const altCam = Math.max(0, p.y - yChao);
    const pedir = [];
    if (altCam < R) {
      const rh = Math.sqrt(R * R - altCam * altCam) + LADRILHO;
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const cx = (i + 0.5) * LADRILHO - p.x;
          const cz = (j + 0.5) * LADRILHO - p.z;
          if (cx * cx + cz * cz > rh * rh) continue;
          const k = `${i},${j}`;
          const L = ladrilhos.get(k);
          if (!L) {
            pedir.push([cx * cx + cz * cz, k]);
            continue;
          }
          L.usado = c.quadros ?? 0;
          if (L.arvores.length) fonteRef.push(L.arvores);
          if (L.moitas.length && cx * cx + cz * cz < (pv.moitas + LADRILHO) ** 2) fonteRef.push(L.moitas);
        }
      }
    }
    // os de perto primeiro
    pedir.sort((a, b) => a[0] - b[0]);
    fila.length = 0;
    for (const [, k] of pedir) fila.push(k);
    if (comRua && ruaArr.length) fonteRef.push(ruaArr);
    for (const l of plantadas.values()) if (l.length) fonteRef.push(l);
    // candidatas: dentro do alcance e da vista
    let total = 0;
    for (const l of fonteRef) total += l.length / PASSO_ARVORE;
    garantirTrabalho(Math.min(total, CANDIDATAS_MAX));
    let n = 0;
    fonteRef.forEach((l, f) => {
      const ehMoita = l.length && l[3] === ESPECIE.moita;
      const alc = ehMoita ? pv.moitas : R;
      for (let o = 0; o < l.length && n < CANDIDATAS_MAX; o += PASSO_ARVORE) {
        const alt = l[o + 4];
        const cy = l[o + 1] + alt * 0.5;
        const d = Math.hypot(l[o] - p.x, cy - p.y, l[o + 2] - p.z);
        // (também fora: a distância NaN de uma árvore plantada com coordenada inválida)
        if (!(d <= alc)) continue;
        esfera.center.set(l[o], cy, l[o + 2]);
        esfera.radius = Math.max(alt, l[o + 5]) * 0.6 + 2;
        if (!frustum.intersectsSphere(esfera)) continue;
        // chave: a distância em quartos de metro e o número da candidata
        chaves[n] = Math.min(65535, Math.floor(d * 4)) * CANDIDATAS_MAX + n;
        candF[n] = f;
        candO[n] = o;
        n++;
      }
    });
    const ordem = chaves.subarray(0, n).sort();
    for (let k = 0; k < n; k++) {
      const v = ordem[k];
      const ci = v % CANDIDATAS_MAX;
      ordF[k] = candF[ci];
      ordO[k] = candO[ci];
      distArr[k] = Math.floor(v / CANDIDATAS_MAX) / 4;
      espArr[k] = fonteRef[candF[ci]][candO[ci] + 3];
    }
    const lods = escolherLods(distArr, espArr, n, pv, tris);
    for (const lod of [0, 1, 2]) for (const o of saida[lod]) o.n = 0;
    let ni = 0;
    if (impPos.length < n * 4) {
      const c2 = 2 ** Math.ceil(Math.log2(Math.max(256, n)));
      impPos = new Float32Array(c2 * 4);
      impEsc = new Float32Array(c2 * 2);
      impBytes = new Uint8Array(c2 * 4);
    }
    const contagem = [0, 0, 0];
    for (let k = 0; k < n; k++) {
      const L = lods[k];
      if (L < 0) continue;
      const l = fonteRef[ordF[k]];
      const o = ordO[k];
      const e = l[o + 3];
      const alt = l[o + 4];
      const larg = l[o + 5];
      const sx = larg / ref[e].largura;
      const sy = alt / ref[e].altura;
      const ehMoita = e === ESPECIE.moita;
      const fade = ehMoita ? esmaecer(distArr[k], pv.moitas, pv.faixaMoitas) : esmaecer(distArr[k], R, pv.faixa);
      if (fade <= 0.01) continue;
      const tom = Math.round(Math.min(1, Math.max(0, l[o + 7])) * 255);
      const sem = Math.round(Math.min(1, Math.max(0, l[o + 8])) * 255);
      const fb = Math.round(fade * 255);
      contagem[L]++;
      if (L === 2) {
        impPos[4 * ni] = l[o];
        impPos[4 * ni + 1] = l[o + 1];
        impPos[4 * ni + 2] = l[o + 2];
        impPos[4 * ni + 3] = l[o + 6];
        impEsc[2 * ni] = sx;
        impEsc[2 * ni + 1] = sy;
        impBytes[4 * ni] = tom;
        impBytes[4 * ni + 1] = sem;
        impBytes[4 * ni + 2] = fb;
        impBytes[4 * ni + 3] = e;
        ni++;
        continue;
      }
      for (const q of [L, 2]) {
        const s = saida[q][e];
        crescer(s, s.n + 1);
        matrizArvore(s.mats, 16 * s.n, l[o], l[o + 1], l[o + 2], l[o + 6], sx, sy);
        s.bytes[4 * s.n] = tom;
        s.bytes[4 * s.n + 1] = sem;
        s.bytes[4 * s.n + 2] = fb;
        s.bytes[4 * s.n + 3] = e;
        s.n++;
      }
    }
    for (const lod of [0, 1]) for (let e = 0; e < N_ESPECIES; e++) baldes[lod][e].escrever(saida[lod][e].n, saida[lod][e].mats, saida[lod][e].bytes);
    for (let e = 0; e < N_ESPECIES; e++) sombras[e].escrever(saida[2][e].n, saida[2][e].mats, saida[2][e].bytes);
    imp.escrever(ni, impPos, impEsc, impBytes);
    estado.lod0 = contagem[0];
    estado.lod1 = contagem[1];
    estado.impostores = contagem[2];
    estado.arvores = contagem[0] + contagem[1] + contagem[2];
    estado.ladrilhos = ladrilhos.size;
    estado.msMontar = performance.now() - t0;
    c.stats.instancias.arvores = estado.arvores;
    ctx.sombra.marcar();
  }

  /** A câmera andou ou girou o bastante para montar de novo? */
  function mudou(c, tMs) {
    const cam = c.camera;
    const p = cam.position;
    const e = cam.matrixWorld.elements;
    const dx = -e[8];
    const dy = -e[9];
    const dz = -e[10];
    const passo = Math.max(3, 0.015 * Math.max(0, p.y));
    const andou = Math.hypot(p.x - ultimo.x, p.y - ultimo.y, p.z - ultimo.z) > passo || Number.isNaN(ultimo.x);
    const girou = dx * ultimo.dx + dy * ultimo.dy + dz * ultimo.dz < Math.cos((4 * Math.PI) / 180);
    if (!(andou || girou || sujo)) return false;
    if (tMs - ultimo.t < 90 && !Number.isNaN(ultimo.x) && !girou) return false;
    Object.assign(ultimo, { x: p.x, y: p.y, z: p.z, dx, dy, dz, t: tMs });
    return true;
  }

  const api = {
    nome: 'vegetacao',
    aplicar() {
      // o chão avisa o que mudou (chao.aoMudar); a rua vem dos setores de vias no quadro
    },
    quadro(tMs, c) {
      U.gArvTempo.value = (tMs / 1000) % 10000;
      // o vento do clima (m/s, [x, z] ou só a força): a direção e a força do balanço das copas
      const vento = c.sim.espelho.tempo?.clima?.vento;
      const vx = Array.isArray(vento) ? vento[0] : Number.isFinite(vento) ? vento * 0.92 : 2.8;
      const vz = Array.isArray(vento) ? vento[1] : Number.isFinite(vento) ? vento * 0.39 : 1.2;
      const v = Math.hypot(vx, vz) || 1;
      const forca = Math.min(1.6, 0.4 + v * 0.12);
      U.gArvVento.value.set((vx / v) * forca, (vz / v) * forca);
      if (!comGlsl || !programasProntos) return;
      if (!assado) {
        if (!U.gArvFolhas.value) return;
        try {
          assado = assarImpostores(c.renderer, modelos[0], U, pv.impostor, assador);
          U.gImpCor.value = assado.alvos[0].texture;
          U.gImpNormal.value = assado.alvos[1].texture;
          ligarChao(true);
        } catch (e) {
          console.error('vegetação: o assado dos impostores falhou', e);
          assado = { alvos: [], falhou: true };
        }
      }
      // a rua: pelos setores de vias, só se o domínio 'props' não desenha as copas dele (pendência da R3b)
      if (tMs - tRua > 1000) {
        tRua = tMs;
        comRua = !c.cena.getObjectByName('props:copa0');
      }
      const vias = c.dominio('vias');
      if (comRua && vias?.setoresPerto) {
        let h = `${vias.versaoObjetos ?? 0}`;
        for (const st of vias.setoresPerto(pv.perto)) h += `|${st.s}`;
        if (h !== chaveRua) {
          chaveRua = h;
          arvoresDaRua(vias, pv.perto, rua);
          ruaArr = Float32Array.from(rua);
          sujo = true;
        }
      }
      // o tempo de gerar ladrilhos acompanha o quadro (um quarto dele, de 3 a 200 ms): no aparelho lento a mata
      // aparece em poucos quadros em vez de em centenas
      const dt = tAnt === null ? 16 : Math.min(1000, tMs - tAnt);
      tAnt = tMs;
      gerarFila(Math.min(200, Math.max(fila.length > 40 ? 6 : 3, dt * 0.25)));
      if (mudou(c, tMs)) {
        sujo = false;
        montar(c);
      }
    },
    /** O GLSL das árvores chegou (ou falhou): o aquecimento da carga espera por ele (motor/quadro.js, D66). */
    pronto: () => (comGlsl && programasProntos) || glslFalhou || morto,
    /** Para as cenas e as capturas: gera todos os ladrilhos do alcance de uma vez e monta. */
    preparar() {
      if (!comGlsl) {
        prepararDepois = true;
        return api.medidas();
      }
      sujo = true;
      ultimo.x = NaN;
      montar(ctx);
      gerarFila(1e9);
      ultimo.x = NaN;
      montar(ctx);
      return api.medidas();
    },
    medidas() {
      const t = { lod0: 0, lod1: 0 };
      if (baldes) for (const lod of [0, 1]) for (let e = 0; e < N_ESPECIES; e++) t[`lod${lod}`] += baldes[lod][e].n * tris[lod][e];
      return { ...estado, tris0: t.lod0, tris1: t.lod1, trisImp: estado.impostores * 2, fila: fila.length, assado: !!assado && !assado.falhou };
    },
    descartar() {
      morto = true;
      soltarChao?.();
      soltar();
      ligarChao(false);
      for (const b of [...(baldes?.flat() ?? []), ...(sombras ?? [])]) b.descartar();
      imp?.descartar();
      for (const lod of [0, 1]) for (const M of modelos[lod]) M.geo.dispose();
      for (const m of [...mats, matSombra, matImp]) m.dispose();
      assador?.mat.dispose();
      for (const a of assado?.alvos ?? []) a.dispose();
    },
  };

  const soltar = ctx.ouvir('qualidade', () => {
    pv = porPerfil(PERFIL_VEGETACAO, ctx.perfil);
    if (comGlsl) pegarFolhas();
    for (const a of assado?.alvos ?? []) a.dispose();
    assado = null;
    ladrilhos.clear();
    sujo = true;
  });

  // o que publica: plantar por dono (lotes, praças, a Arcologia) e as medidas
  ctx.vegetacao = {
    especies: ESPECIES.map((e) => e.id),
    /**
     * Árvores de um dono (troca as anteriores dele): lista de { x, y, z, especie (id ou índice), altura, largura?,
     * giro?, tom? } ou um Float32Array de PASSO_ARVORE por árvore. Lista vazia ou null solta o dono.
     */
    plantar(dono, itens) {
      const l = itens?.length ? plantaveis(itens) : null;
      if (!l?.length) plantadas.delete(dono);
      else plantadas.set(dono, l);
      sujo = true;
    },
    medidas: () => api.medidas(),
    preparar: () => api.preparar(),
  };
  // os programas na carga (D66): os baldes ficam escondidos até ter árvore
  ctx.quadro?.aquecer?.add?.(fonteAquecer);
  if (F) nascer();
  else
    carregarGlsl().then(nascer, (e) => {
      glslFalhou = true;
      console.error('vegetação: o GLSL das árvores não carregou', e);
    });
  return api;
}

export function registrar(api) {
  api.registrarTextura('arvores.folhas', gerarFolhas);
  api.registrarDominio('vegetacao', criarVegetacao);
}
