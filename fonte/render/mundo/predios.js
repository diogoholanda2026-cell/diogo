// Prédios da cidade (desenho do render 5, D39, D43): troca o substituto de caixas da F0 (domínio 'predios').
//   LOD0  por setor de 256 m: a malha fundida que a oficina gera (fundir.js), um Mesh por setor perto da câmera, com
//         cache LRU e teto de memória por perfil
//   LOD1  instâncias de forma (caixa, chanfro, cilindro, duas águas) com a fachada de longe no shader (FAC_BARATA, PC2);
//         LOD2 é o mesmo buffer só com a peça principal de cada prédio; os buffers são montados com os setores visíveis,
//         da frente para trás (setores pela distância e, dentro deles, as instâncias na direção da vista). Com as duas
//         faixas de profundidade (?semClip=1, sem EXT_clip_control) os setores além do corte vão numa segunda lista,
//         só da faixa de longe, e os de perto numa só da faixa de perto: a cidade não é desenhada duas vezes
//   sombra própria (D43): listas de projetores com o LOD1 dos setores cuja sombra cai no chão da cascata
//         (ctx.sombra.regiao), cujos buffers de instância o gêmeo da cena de sombra compartilha (o LOD0 nunca projeta)
//   anexos (D39, R4b): o prédio que nasce, sobe de nível ou muda vai para o anexo do setor (malha pequena, refeita na
//         oficina em poucos ms) e a base do setor é refundida depois de 5 s sem mudança (mundo/anexos.js); o vértice
//         esconde a cópia que não vale pelo bit ANEXO da tabela
//   tabela de prédios na GPU: RGBA8 512² (R camada, G bits, B agenda) e RGBA32F 512² (início e fim da obra, cota da
//         base e altura do prédio: o corte da obra no vértice, R4b)
// Publica para as outras parcelas: criarMaterialEdificio(ctx) (X1a, R5), uniformesEdificio, e no domínio
// ctx.dominio('predios'): { tabela, obra, material, preparar(), pronto(), caixaDoPredio(idx), medidas(), planoObra(i),
// alturaObra(i, H) (R5: a altura do corte dos colocáveis), lotesVisiveis() (lotes.js) }.
import * as THREE from 'three';
import { GradeSetores, pedidoDoSetor, assinatura, distCaixa, LADO_SETOR } from './setores.js';
import { ListaCompactada } from './instancias.js';
import { oficinaDe } from './oficina.js';
import { formaUnitaria, FORMAS, BITS_TABELA, ID_ANEXO } from '../geracao/malhaPredio.js';
import { CAIXA, gerarSetor } from '../geracao/fundir.js';
import { planoPredio } from '../geracao/planoPredio.js';
import { RegistroAnexos } from './anexos.js';
import * as SH from '../materiais/shaders/fachada.glsl.js';
import { PREDIO, TIPO_PREDIO } from '../../contratos/flags.js';
import { GANCHOS } from '../../contratos/render.js';
import { refDe, idxDaRef } from '../../contratos/espelho.js';
import { LOD_PREDIOS } from '../../data/estilos.js';
import { PRIORIDADE } from '../camera/selecao.js';
import { pedeTudo } from '../ponte.js';
import { carregarDetalheCC0 } from '../materiais/texturas-predio.js';
import { modoMateriais } from '../materiais/texturas-chao.js';
import { CAMADA_LONGE } from '../motor/faixas.js';
import { porPerfil } from '../motor/perfis.js';

/** Lado das tabelas de prédios na GPU (262.144 vagas, D19). */
export const LADO_TABELA = 512;
/**
 * Na primeira leitura do espelho e quando o diário pede tudo de novo (carga, cena fixa, save aberto) o LOD1 da cidade
 * inteira sai na thread principal, na hora: a cidade aparece completa no primeiro quadro, sem esperar a fila da
 * oficina (12 mil prédios em 0,15 a 0,3 s no PC). Acima deste número de prédios a carga segue pela oficina.
 */
const LOD1_NA_CARGA = 40000;
const BYTES_INST = ['aFac', 'aCorA', 'aCorB', 'aTopo'];
/** O idx do prédio no aId (sem o bit do anexo). */
const MASCARA_ID = ID_ANEXO - 1;
/** Folga (m) em volta do chão da cascata para escolher os setores que projetam sombra. */
const FOLGA_SOMBRA = 60;
/** Alcance máximo (m) da sombra de um setor com o sol baixo. */
const SOMBRA_MAX = 600;

/**
 * Corte entre as duas faixas de profundidade (?semClip=1): a mesma conta de motor/faixas.js (Faixas.desenhar), que
 * só a faz na hora de desenhar; aqui ela escolhe a lista de cada setor antes.
 */
export const limiteFaixas = (dist) => Math.max(3000, dist * 1.6);

/**
 * Faixa de profundidade da caixa [x0, x1] x [y0, y1] x [z0, z1] (bits: 1 perto, 2 longe) pela profundidade no eixo
 * da câmera (posição c, direção f unitária): os planos das faixas são perpendiculares a esse eixo, e a distância em
 * linha reta passa da profundidade nos cantos da tela (até 25% a 40 graus), o que tirava da faixa de perto um setor
 * que ainda estava nela, com um buraco nos cantos. A de perto vai até 1,02 vez o corte e a de longe começa em 0,9
 * vez (Faixas.desenhar): a caixa na emenda vai nas duas.
 */
export function faixaDaCaixa(cx, cy, cz, fx, fy, fz, x0, y0, z0, x1, y1, z1, lim) {
  const meio = fx * ((x0 + x1) / 2 - cx) + fy * ((y0 + y1) / 2 - cy) + fz * ((z0 + z1) / 2 - cz);
  const ext = (Math.abs(fx) * (x1 - x0) + Math.abs(fy) * (y1 - y0) + Math.abs(fz) * (z1 - z0)) / 2;
  return (meio - ext < lim * 1.02 ? 1 : 0) | (meio + ext > lim * 0.9 ? 2 : 0);
}

/**
 * Ordena os setores visíveis da frente para trás pela faixa de distância (um lado de setor, 256 m) e pelo índice: a
 * ordem só muda quando um setor troca de faixa, e a lista compactada não é refeita a cada passo da câmera.
 * @param {{ s: number, dist: number }[]} lista
 */
export function ordenarDaFrente(lista) {
  const faixa = (st) => Math.floor(st.dist / LADO_SETOR);
  return lista.sort((a, b) => faixa(a) - faixa(b) || a.s - b.s);
}

/** Instâncias reordenadas por quadro no máximo (uns 1 a 2 ms de CPU; 21 mil na vista aberta: 4 quadros). */
const ORDEM_POR_QUADRO = 6000;

/** Direções da ordem das instâncias: 16 rumos (22,5 graus) e 3 inclinações (a tangente de cada faixa). */
const RUMOS = 16;
const TAN_INCLINACAO = Object.freeze([0.27, 0.7, 2]);

/**
 * Balde da direção da câmera para a ordem das instâncias dentro dos setores (PC2): o rumo em 16 passos e a inclinação
 * em 3 faixas. A ordem só é refeita quando o balde muda (girar a câmera 22,5 graus ou passar de uma faixa de
 * inclinação para outra).
 * @param {{ x: number, y: number, z: number }} frente  direção da vista (unitária)
 * @returns {{ id: number, fx: number, fz: number, k: number }}
 */
export function baldeDaVista(frente) {
  const h = Math.hypot(frente.x, frente.z);
  const r = (((Math.round((Math.atan2(frente.z, frente.x) / (2 * Math.PI)) * RUMOS) % RUMOS) + RUMOS) % RUMOS);
  const inc = Math.atan2(-frente.y, Math.max(h, 1e-6));
  const f = inc < 0.44 ? 0 : inc < 0.96 ? 1 : 2; // 25 e 55 graus
  const a = (r / RUMOS) * 2 * Math.PI;
  return { id: r * 3 + f, fx: Math.cos(a), fz: Math.sin(a), k: TAN_INCLINACAO[f] };
}

// rascunhos da ordem (crescem com o maior grupo e ficam): chaves empacotadas, índices e a cópia de trabalho
let _chaves = new Float64Array(0);
let _idx = new Uint32Array(0);
let _mat = new Float32Array(0);
let _bytes = new Uint8Array(0);
let _ids = new Uint32Array(0);
/** Chave em 1/8 de metro (a profundidade de um grupo cabe folgada em 2^37 com o índice nos 16 bits de baixo). */
const PASSO_CHAVE = 8;
const BASE_IDX = 65536;

function garantirRascunhos(n) {
  if (n <= _idx.length) return;
  const m = 2 ** Math.ceil(Math.log2(n));
  _chaves = new Float64Array(m);
  _idx = new Uint32Array(m);
  _mat = new Float32Array(16 * m);
  _bytes = new Uint8Array(16 * m);
  _ids = new Uint32Array(m);
}

/**
 * Índices [a, b) de mat em ordem de profundidade na direção do balde, escritos em _idx[a, b). A chave (a
 * profundidade em 1/8 de metro, mais o índice) vai empacotada num Float64Array: a ordenação numérica nativa, sem
 * função de comparação, custa uma fração da de antes (21 mil instâncias num giro de câmera).
 */
function ordemDoTrecho(mat, a, b, balde) {
  if (b - a < 2) {
    if (b > a) _idx[a] = a;
    return;
  }
  let min = Infinity;
  for (let i = a; i < b; i++) {
    const k = balde.fx * mat[16 * i + 12] + balde.fz * mat[16 * i + 14] - balde.k * mat[16 * i + 13];
    _chaves[i] = k;
    if (k < min) min = k;
  }
  if (!Number.isFinite(min)) min = 0;
  for (let i = a; i < b; i++) {
    const q = Math.floor((_chaves[i] - min) * PASSO_CHAVE);
    // NaN (matriz vazia) vai para o fim, sem desmanchar a ordem das outras
    _chaves[i] = (q >= 0 && q < 2 ** 36 ? q : 2 ** 36) * BASE_IDX + (i - a);
  }
  const k = _chaves.subarray(a, b);
  k.sort();
  for (let i = a; i < b; i++) _idx[i] = a + (_chaves[i] % BASE_IDX);
}

/** Copia as instâncias na ordem de _idx (as n primeiras) de (mat, bytes, ids) para as saídas. */
function permutar(n, mat, bytes, ids, oMat, oBytes, oIds) {
  for (let d = 0; d < n; d++) {
    const o = 16 * _idx[d];
    const dd = 16 * d;
    for (let c = 0; c < 16; c++) oMat[dd + c] = mat[o + c];
    if (bytes) for (let c = 0; c < 16; c++) oBytes[dd + c] = bytes[o + c];
    if (ids) oIds[d] = ids[_idx[d]];
  }
}

/**
 * Ordena as instâncias de uma forma de um setor da frente para trás na direção do balde (profundidade ao longo da
 * vista: rumo no chão e a altura pela inclinação). No próprio buffer, as peças principais (as np primeiras, o LOD2)
 * e depois as outras; em x.todas, uma cópia com todas as peças juntas em ordem (o LOD1). Com a cidade em ordem, o
 * teste de profundidade descarta o prédio de trás antes da fachada. Grupos acima de 65.536 instâncias ficam como estão.
 * @param {{ n: number, np: number, mat: Float32Array, bytes: Uint8Array | null, ids: Uint32Array | null, todas?: object }} x
 */
export function ordenarInstancias(x, balde) {
  if (!x || x.n < 1 || x.n > BASE_IDX) return;
  const n = x.n;
  const np = Math.min(Math.max(x.np | 0, 0), n);
  garantirRascunhos(n);
  const { mat, bytes, ids } = x;
  // o LOD2: as principais em ordem e depois as outras, no próprio buffer
  ordemDoTrecho(mat, 0, np, balde);
  ordemDoTrecho(mat, np, n, balde);
  let igual = true;
  for (let i = 0; i < n && igual; i++) igual = _idx[i] === i;
  if (!igual) {
    _mat.set(mat.subarray(0, 16 * n));
    if (bytes) _bytes.set(bytes.subarray(0, 16 * n));
    if (ids) _ids.set(ids.subarray(0, n));
    permutar(n, _mat, bytes ? _bytes : null, ids ? _ids : null, mat, bytes, ids);
  }
  // o LOD1: todas as peças juntas em ordem, numa cópia (as secundárias de perto passam na frente das principais de trás)
  if (np >= n) {
    x.todas = null;
    return;
  }
  const t = x.todas && x.todas.mat.length === 16 * n ? x.todas : (x.todas = { mat: new Float32Array(16 * n), bytes: bytes ? new Uint8Array(16 * n) : null, ids: ids ? new Uint32Array(n) : null });
  ordemDoTrecho(mat, 0, n, balde);
  permutar(n, mat, bytes, ids, t.mat, t.bytes, t.ids);
}

/** Distância do ponto (px, pz) ao retângulo [x0, x1] x [z0, z1] no chão (0 dentro). */
function distRet(px, pz, x0, z0, x1, z1) {
  const dx = px < x0 ? x0 - px : px > x1 ? px - x1 : 0;
  const dz = pz < z0 ? z0 - pz : pz > z1 ? pz - z1 : 0;
  return Math.hypot(dx, dz);
}

/**
 * A sombra do setor alcança o círculo (cx, cz, raio)? O setor varrido para longe do sol (ux, uz: direção do sol no
 * chão) por até `alcance` m: a distância do centro ao retângulo que anda é convexa, então 5 amostras bastam com a folga.
 */
export function sombraAlcanca(x0, z0, lado, cx, cz, raio, ux, uz, alcance) {
  for (let k = 0; k <= 4; k++) {
    const t = (alcance * k) / 4;
    if (distRet(cx + ux * t, cz + uz * t, x0, z0, x0 + lado, z0 + lado) <= raio) return true;
  }
  return false;
}

// ------------------------------------------------------------------------------------------------ material

/** Uniformes do material `edificio` (um objeto só: mudar o valor vale para todos os prédios). */
export const uniformesEdificio = {
  gPredTab: { value: null },
  gPredObra: { value: null },
  gTique: { value: 0 },
  gCorHolding: { value: new THREE.Vector3(201, 168, 106) },
  gDetalhe: { value: null },
  gHora: { value: 10 },
  gNoite: { value: 0 },
  gSelecionado: { value: -1 },
  gPrediosMascara: { value: 0 },
  gCeuLigado: { value: 1 },
  gCeuZen: { value: new THREE.Color(0.28, 0.42, 0.62) },
  gCeuHor: { value: new THREE.Color(0.62, 0.7, 0.8) },
  gCeuChao: { value: new THREE.Color(0.16, 0.16, 0.15) },
};

/**
 * Ganchos da fachada de longe (LOD1 e LOD2, a partir do alcance do LOD0; R4b): o HAO sai (a oclusão do céu no pé das
 * paredes some no pixel de longe) e a sombra própria lê o mapa com 2 amostras em vez de 8 (SOMBRA_LONGE_AMOSTRAS: o
 * texel da cascata de longe já passa do pixel; na placa cada amostra é uma leitura de textura). Medido passe a passe
 * no SwiftShader (nota da R4b): todos os ganchos juntos são uns 30% do custo por pixel da fachada de longe (a sombra é
 * o maior, uns 18%); o resto é a fachada. ?ganchosLonge=a,b e ?amostrasLonge=n trocam na carga, e bancadaLonge() na
 * mesma página (bancada A/B).
 */
export const GANCHOS_FORA_LONGE = Object.freeze(['hao']);
/** Os ganchos do contrato menos os de GANCHOS_FORA_LONGE (um gancho novo no contrato entra de longe sozinho). */
export const GANCHOS_LONGE = Object.freeze(GANCHOS.filter((n) => !GANCHOS_FORA_LONGE.includes(n)));
export const SOMBRA_LONGE_AMOSTRAS = 2;

function trocar(src, alvo, novo) {
  if (!src.includes(alvo)) throw new Error(`edificio: shader sem '${alvo}' (o three mudou?)`);
  return src.replace(alvo, novo);
}

/**
 * Material `edificio` (desenho do render 9.1): MeshStandardMaterial com a fachada no shader e os ganchos comuns. O
 * mesmo material serve ao LOD0 fundido (atributos quantizados por vértice) e ao LOD1 instanciado (o three compila as
 * duas variantes). Para X1a e R5: escrever a malha no formato de malhaPredio.js e usar este material. barata (PC2): a
 * fachada de longe do LOD1 e do LOD2 (FAC_BARATA: sem paralaxe, caixilho, ar-condicionado, grade, letras e o detalhe
 * fino, que somem no pixel; a grade de janelas, as persianas, as cortinas e a luz das janelas ficam). nomes: os ganchos
 * (todos por padrão); amostras: teto das amostras do PCF da sombra própria neste material (0: o do perfil).
 */
export function criarMaterialEdificio(ctx, { ganchos = null, barata = false, nomes = null, amostras = 0 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  m.name = barata ? 'edificio-longe' : 'edificio';
  if (barata) m.defines = { ...m.defines, FAC_BARATA: '' };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniformesEdificio);
    let vs = shader.vertexShader;
    vs = trocar(vs, '#include <common>', `#include <common>\n${SH.VERTICE_PARS}`);
    vs = trocar(vs, '#include <beginnormal_vertex>', SH.VERTICE_NORMAL);
    vs = trocar(vs, '#include <begin_vertex>', `#include <begin_vertex>\n${SH.VERTICE_MAIN}`);
    let fs = shader.fragmentShader;
    fs = trocar(fs, '#include <common>', `#include <common>\n${SH.FRAGMENTO_PARS}`);
    fs = trocar(fs, '#include <color_fragment>', SH.FRAGMENTO_COR);
    fs = trocar(fs, '#include <roughnessmap_fragment>', SH.FRAGMENTO_RUGOSIDADE);
    fs = trocar(fs, '#include <metalnessmap_fragment>', SH.FRAGMENTO_METAL);
    fs = trocar(fs, '#include <normal_fragment_maps>', SH.FRAGMENTO_NORMAL);
    fs = trocar(fs, '#include <emissivemap_fragment>', SH.FRAGMENTO_EMISSIVO);
    fs = trocar(fs, '#include <lights_fragment_maps>', SH.FRAGMENTO_CEU);
    fs = trocar(fs, '#include <aomap_fragment>', SH.FRAGMENTO_AO);
    fs = trocar(fs, '#include <dithering_fragment>', SH.FRAGMENTO_MASCARA);
    shader.vertexShader = vs;
    shader.fragmentShader = fs;
  };
  const g = ganchos ?? ctx.ganchos;
  const lista = (nomes ?? g.nomes()).filter((n) => g.nomes().includes(n));
  m.customProgramCacheKey = () => `${barata ? 'edificio-1-barata' : 'edificio-1'}|${lista.join(',')}|${amostras}`;
  m.userData.edificio = true;
  g.aplicar(m, lista);
  if (amostras > 0) {
    // o PCF com menos amostras só neste material: o uniforme próprio segue o do gancho com o teto
    const meu = { value: amostras };
    const comGanchos = m.onBeforeCompile;
    m.onBeforeCompile = (shader, renderer) => {
      comGanchos.call(m, shader, renderer);
      if (shader.uniforms.gSombraAmostras) shader.uniforms.gSombraAmostras = meu;
    };
    m.userData.amostras = () => {
      meu.value = Math.min(amostras, g.uniformes.gSombraAmostras?.value ?? amostras);
    };
  }
  return m;
}

/** Geometria de uma forma unitária do LOD1 (posição, normal, aUnit e índices). */
function geometriaForma(f) {
  const u = formaUnitaria(f);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(u.posicao, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(u.normal, 3));
  g.setAttribute('aUnit', new THREE.BufferAttribute(u.unit, 4));
  g.setIndex(new THREE.BufferAttribute(u.indices, 1));
  return { g, tris: u.tris };
}

// depois do envio à GPU a cópia JS sai; fica o tamanho, para a conta de memória de geometria (medidas.js)
function soltarCopia() {
  this.array = { byteLength: this.array.byteLength, length: this.array.length };
}

/** Malha LOD0 quantizada da oficina (fundir.js) num Mesh do three, no canto do setor. */
function malhaLod0(m, material, x0, z0, nome) {
  const A = m.atributos;
  const g = new THREE.BufferGeometry();
  const at = (arr, k, norm) => new THREE.BufferAttribute(arr, k, norm).onUpload(soltarCopia);
  g.setAttribute('position', at(A.posicao, 3, true));
  g.setAttribute('normal', at(A.normal, 2, true));
  const fuv = new THREE.Float16BufferAttribute(A.facUV, 4);
  fuv.onUpload(soltarCopia);
  g.setAttribute('aFacUV', fuv);
  g.setAttribute('aFac', at(A.fac, 4, false));
  g.setAttribute('aCorA', at(A.corA, 4, false));
  g.setAttribute('aCorB', at(A.corB, 4, false));
  g.setAttribute('aId', at(A.id, 1, false));
  g.setAttribute('aAO', at(A.ao, 1, true));
  g.setIndex(at(m.indices, 1, false));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.sqrt(3) * 1.01);
  g.boundingBox = new THREE.Box3(new THREE.Vector3(-1.01, -1.01, -1.01), new THREE.Vector3(1.01, 1.01, 1.01));
  const mesh = new THREE.Mesh(g, material);
  const [cx, cy, cz, s] = m.escala;
  mesh.position.set(x0 + cx, cy, z0 + cz);
  mesh.scale.setScalar(s);
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  mesh.name = nome;
  let bytes = m.indices.byteLength;
  for (const a of Object.values(A)) bytes += a.byteLength;
  return { mesh, bytes, tris: m.tris };
}

/** Grupo do LOD1 ({ n, np, mat, ids, bytes }) só com as instâncias que passam em ok(id): cópia para a sombra e o lote. */
export function filtrarGrupo(x, ok) {
  if (!x?.n) return { n: 0, np: 0, mat: new Float32Array(0), ids: null, bytes: null };
  const keep = [];
  let np = 0;
  for (let i = 0; i < x.n; i++) {
    if (!ok(x.ids[i])) continue;
    keep.push(i);
    if (i < (x.np ?? x.n)) np++;
  }
  if (keep.length === x.n) return x;
  const k4 = x.bytes ? x.bytes.length / Math.max(1, x.n) : 0;
  const mat = new Float32Array(keep.length * 16);
  const bytes = x.bytes ? new Uint8Array(keep.length * k4) : null;
  const ids = new Uint32Array(keep.length);
  keep.forEach((i, k) => {
    mat.set(x.mat.subarray(16 * i, 16 * i + 16), 16 * k);
    if (bytes) bytes.set(x.bytes.subarray(k4 * i, k4 * i + k4), k4 * k);
    ids[k] = x.ids[i];
  });
  return { n: keep.length, np, mat, ids, bytes };
}

const agoraMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// ------------------------------------------------------------------------------------------------ domínio

function criarPredios(ctx) {
  const { cena, medidas } = ctx;
  const esp0 = ctx.sim.espelho;
  const grade = new GradeSetores({ tam: esp0.mapa?.tam ?? 8192, origem: esp0.mapa?.origem ?? [-4096, -4096] });
  const oficina = oficinaDe(ctx);
  const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  // o LOD0 (perto) com a fachada inteira; o LOD1 e o LOD2 (de longe) com a barata (PC2) e os ganchos de longe (R4b)
  const material = criarMaterialEdificio(ctx);
  const nomesLonge = qs.has('ganchosLonge') ? qs.get('ganchosLonge').split(',').filter(Boolean) : GANCHOS_LONGE;
  const amostrasLonge = qs.has('amostrasLonge') ? Number(qs.get('amostrasLonge')) || 0 : SOMBRA_LONGE_AMOSTRAS;
  const materialLonge = criarMaterialEdificio(ctx, { barata: true, nomes: nomesLonge, amostras: amostrasLonge });
  const variantesLonge = new Map(); // bancadaLonge
  // o programa do LOD0 (Mesh comum com o 'edificio', com normal: o three decide o sombreamento por ela) compila na
  // carga (D66): o primeiro setor de perto pode chegar da oficina depois da rodada final do aquecimento, e o 'edificio'
  // compilava no meio do jogo (C1b)
  const geoMolde = new THREE.BufferGeometry();
  geoMolde.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  geoMolde.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(6), 2));
  const moldeLod0 = new THREE.Mesh(geoMolde, material);
  moldeLod0.name = 'predios:aquecer-lod0';
  ctx.quadro?.aquecer?.add?.(moldeLod0);
  const reg = new RegistroAnexos();

  // tabelas na GPU
  const dadosTab = new Uint8Array(LADO_TABELA * LADO_TABELA * 4);
  const tabela = new THREE.DataTexture(dadosTab, LADO_TABELA, LADO_TABELA, THREE.RGBAFormat, THREE.UnsignedByteType);
  tabela.magFilter = tabela.minFilter = THREE.NearestFilter;
  tabela.generateMipmaps = false;
  tabela.name = 'predios:tabela';
  // RGBA32F (2.4): início e fim da obra em tiques, a cota da base e a altura do prédio (o corte no vértice, R4b); só
  // muda quando a obra começa ou acaba: nenhum envio por quadro
  const dadosObra = new Float32Array(LADO_TABELA * LADO_TABELA * 4);
  const obra = new THREE.DataTexture(dadosObra, LADO_TABELA, LADO_TABELA, THREE.RGBAFormat, THREE.FloatType);
  obra.magFilter = obra.minFilter = THREE.NearestFilter;
  obra.generateMipmaps = false;
  obra.name = 'predios:obra';
  // até o primeiro envio (e depois de um 'tudo') a tabela vai inteira; depois, só as vagas que mudaram
  let tabelaInteira = true;
  let obraInteira = true;
  tabela.onUpdate = () => {
    tabelaInteira = false;
  };
  obra.onUpdate = () => {
    obraInteira = false;
  };
  uniformesEdificio.gPredTab.value = tabela;
  uniformesEdificio.gPredObra.value = obra;
  uniformesEdificio.gDetalhe.value = ctx.textura('fachadaDetalhe');
  // A/B dos materiais (D46): com ?materiais=cc0 a fachada usa o detalhe fotográfico quando a montagem o traz
  if (modoMateriais() === 'cc0') {
    carregarDetalheCC0({ renderer: ctx.renderer, THREE: ctx.THREE }).then((t) => {
      if (t) uniformesEdificio.gDetalhe.value = t;
    });
  }
  uniformesEdificio.gPrediosMascara.value = qs.get('passe') === 'mascara' ? 1 : 0;

  // listas do LOD1/LOD2 visível e dos projetores de sombra, uma por forma; com as duas faixas de profundidade
  // (ctx.semClip), 'vis' fica só na faixa de perto e 'longe' (os setores além do corte) só na de longe
  const duasFaixas = !!ctx.semClip;
  const naCena = (faixa) => (m, velha) => {
    if (velha) cena.remove(velha);
    medidas.familia(m, 'predios');
    if (faixa === 'longe') m.layers.set(CAMADA_LONGE);
    if (faixa) m.userData.faixa = faixa;
    cena.add(m);
  };
  const formas = FORMAS.map((nome, f) => {
    const { g, tris } = geometriaForma(f);
    const gs = new THREE.BufferGeometry();
    gs.setAttribute('position', g.attributes.position);
    gs.setIndex(g.index);
    const vis = new ListaCompactada({ geometria: g, material: materialLonge, nome: `predios:lod1:${nome}`, bytes: BYTES_INST, comId: true, cap: 2048 });
    const sombra = new ListaCompactada({ geometria: gs, material: null, nome: `predios:sombra:${nome}`, cap: 1024 });
    vis.aoCriar = naCena(duasFaixas ? 'perto' : null);
    vis.aoCriar(vis.malha, null);
    let longe = null;
    if (duasFaixas) {
      longe = new ListaCompactada({ geometria: g, material: materialLonge, nome: `predios:lod2:${nome}`, bytes: BYTES_INST, comId: true, cap: 2048 });
      longe.aoCriar = naCena('longe');
      longe.aoCriar(longe.malha, null);
    }
    sombra.aoCriar = (m, velha) => {
      if (velha) ctx.sombra.soltar(velha);
      medidas.familia(ctx.sombra.projetor(m), 'sombra');
    };
    sombra.aoCriar(sombra.malha, null);
    return { vis, longe, sombra, tris };
  });

  const setores = new Map();
  let setorDe = new Int32Array(0);
  let sig = new Uint32Array(0);
  let iniciado = false;
  let carga = false; // o próximo passo gera o LOD1 que falta na thread principal
  let quadros = 0;
  const recebidos = [];
  let pendentes1 = 0;
  let pendentes0 = 0;
  let pendentesA = 0;
  let chaveVis = -1;
  let ordemVista = -1; // o balde em que todos os setores visíveis já estão em ordem
  let chaveSombra = -1;
  let sombraAdiada = false;
  // o pior envio por parte desde a carga (bancada: medidas().envio)
  const piorPartes = { receber: 0, listas: 0, sombra: 0 };
  let nLod0 = 0;
  let bytesLod0 = 0;
  let nAnexos = 0;
  let serialAnexo = 0; // cada anexo montado ganha um número: as listas visíveis e de sombra seguem a troca
  // ms de envio (malhas novas e listas compactadas) por quadro e o pior dos últimos 120
  const janelaEnvio = new Float32Array(120);
  // versão dos bits (anexo, obra) por setor: as cópias filtradas da sombra e do lote seguem esta versão
  let versaoBits = 1;
  let filtros = 0;
  // plano dos prédios em obra (a altura do corte, o esqueleto e a grua de obras.js) e as alturas de fora (R5)
  const planos = new Map();
  const alturasFora = new Map();
  const frustum = new THREE.Frustum();
  const mProj = new THREE.Matrix4();
  const caixa = new THREE.Box3();
  const alvo = new THREE.Vector3();
  const frente = new THREE.Vector3();

  const novoSetor = (s) => {
    const [x0, z0] = grade.canto(s);
    return {
      s, x0, z0, lista: [], versao: 1, lod1: null, lista1: null, v1: 0, pedido1: 0, lod0: null, pedido0: 0, lote: null,
      anexo: null, pedidoA: null, ymin: -2, ymax: 40, usado: 0, modo: 1, vis: false, vBits: 0, filtro: null, vMin: 0,
    };
  };
  const setorPara = (s) => {
    let st = setores.get(s);
    if (!st) {
      st = novoSetor(s);
      setores.set(s, st);
    }
    return st;
  };

  function crescer(cap) {
    if (setorDe.length >= cap) return;
    const a = new Int32Array(cap).fill(-1);
    a.set(setorDe);
    setorDe = a;
    const b = new Uint32Array(cap);
    b.set(sig);
    sig = b;
    reg.crescer(cap);
  }

  /** Plano de um prédio da cidade em obra (guardado pela assinatura) ou null. */
  function planoObra(i) {
    const P = ctx.sim.espelho.predios;
    if (!P || i >= P.n || !P.viva[i] || P.tipo[i] !== TIPO_PREDIO.ZONA) return null;
    const sg = assinatura(P, i);
    const g = planos.get(i);
    if (g && g.sig === sg) return g.plano;
    const plano = planoPredio({ w: P.w[i], d: P.d[i], modelo: P.modelo[i], semente: P.semente[i], nivel: P.nivel[i], estilo: P.estilo[i], cor: P.cor[i], abandonado: !!(P.flags[i] & PREDIO.ABANDONADO) });
    planos.set(i, { sig: sg, plano });
    return plano;
  }

  /** Bits do canal G da tabela (sem os do anexo). */
  function bitsDe(P, i) {
    const viva = i < P.n && P.viva[i];
    const f = viva ? P.flags[i] : 0;
    let g = 0;
    if (f & PREDIO.ABANDONADO) g |= BITS_TABELA.ABANDONADO;
    if (f & PREDIO.OBRA) g |= BITS_TABELA.OBRA;
    if (f & PREDIO.OBRA_NIVEL) g |= BITS_TABELA.NIVEL;
    if (viva && (f & PREDIO.HOLDING || P.tipo[i] === TIPO_PREDIO.HOLDING)) g |= BITS_TABELA.HOLDING;
    return g;
  }

  /** Reescreve o canal G da vaga i (bits da simulação e os do anexo). Devolve true se mudou. */
  function escreverBits(P, i) {
    if (i >= LADO_TABELA * LADO_TABELA) return false;
    const viva = i < P.n && P.viva[i] && P.tipo[i] === TIPO_PREDIO.ZONA;
    const b = reg.bits(i, viva ? setorDe[i] : -1, viva ? sig[i] : 0);
    const g = bitsDe(P, i) | (b.anexo ? BITS_TABELA.ANEXO : 0) | (b.apagado ? BITS_TABELA.APAGADO : 0);
    const k = 4 * i + 1;
    if (dadosTab[k] === g) return false;
    dadosTab[k] = g;
    if (!tabelaInteira) tabela.addUpdateRange(4 * i, 4);
    tabela.needsUpdate = true;
    return true;
  }

  /** Escreve a vaga i nas duas tabelas. Devolve true se os bits do canal G mudaram (anexo, obra, abandono). */
  function escreverTabela(P, i) {
    if (i >= LADO_TABELA * LADO_TABELA) return false;
    const k = 4 * i;
    const viva = i < P.n && P.viva[i];
    const ag = viva ? (Math.imul(P.semente[i] ^ 0x5bd1e995, 0x9e3779b1) >>> 24) & 255 : 0;
    if (dadosTab[k + 2] !== ag) {
      dadosTab[k + 2] = ag;
      if (!tabelaInteira) tabela.addUpdateRange(k, 4);
      tabela.needsUpdate = true;
    }
    const mudou = escreverBits(P, i);
    // a obra: início, fim, a cota da base e a altura do prédio (0: sem corte)
    const f = viva ? P.flags[i] : 0;
    const emObra = !!(f & PREDIO.OBRA) && !(f & PREDIO.OBRA_NIVEL);
    let H = 0;
    if (emObra) H = alturasFora.get(i) ?? planoObra(i)?.alturaTopo ?? 0;
    else planos.delete(i);
    // a vaga morta esquece a altura de fora (R5): reaproveitada por um prédio da cidade, o corte sai do plano dele
    if (!viva) alturasFora.delete(i);
    const o = 4 * i;
    const ini = viva ? P.obraIni[i] : 0;
    const fim = viva ? P.obraFim[i] : 0;
    const y = viva ? Math.fround(P.y[i]) : 0;
    const h = emObra ? Math.fround(Math.max(0, H)) : 0;
    if (dadosObra[o] !== ini || dadosObra[o + 1] !== fim || dadosObra[o + 2] !== y || dadosObra[o + 3] !== h) {
      dadosObra[o] = ini;
      dadosObra[o + 1] = fim;
      dadosObra[o + 2] = y;
      dadosObra[o + 3] = h;
      if (!obraInteira) obra.addUpdateRange(o, 4);
      obra.needsUpdate = true;
    }
    return mudou;
  }

  function tirar(st, i) {
    const j = st.lista.indexOf(i);
    if (j >= 0) {
      st.lista.splice(j, 1);
      st.versao++;
    }
  }

  /** Esquece as malhas de um setor (base, anexo e lote). */
  function esvaziar(st) {
    soltarLod0(st);
    soltarAnexo(st);
    st.lod1 = null;
    st.lista1 = null;
    st.lote = null;
    st.filtro = null;
  }

  /** Espelho para os setores: quem mudou de setor, de lote ou de aparência entra no anexo do setor (D39). */
  function aplicar(d, esp) {
    const P = esp.predios;
    if (!P) return;
    crescer(P.cap);
    const tudo = !iniciado || pedeTudo(d, 'predios');
    // primeira leitura ou tudo de novo (um save aberto): o LOD1 sai na hora no próximo passo
    if (tudo) carga = true;
    iniciado = true;
    if (d.holding || tudo) corHolding(esp);
    if (tudo) {
      // tudo de novo (a carga, uma cena, um save aberto): o setor que ficou igual (a mesma lista e as mesmas
      // assinaturas na base, sem anexo) fica; os outros recomeçam sem malha e sem registro
      planos.clear();
      const novas = new Map();
      for (let i = 0; i < P.n; i++) {
        if (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.ZONA) continue;
        const s = grade.indice(P.x[i], P.z[i]);
        if (s < 0) continue;
        let l = novas.get(s);
        if (!l) novas.set(s, (l = []));
        l.push(i);
      }
      for (const s of new Set([...setores.keys(), ...novas.keys()])) {
        const st = setorPara(s);
        const l = novas.get(s) ?? [];
        const b = reg.setores.get(s)?.base;
        const igual = st.lod1 && !st.anexo && b && b.lista.length === l.length && l.every((i, k) => b.lista[k] === i && b.sigs[k] === assinatura(P, i));
        st.lista = l;
        if (igual) continue;
        esvaziar(st);
        atualizarBits(reg.baseChegou(s, [], []).tocados);
        const e = reg.setor(s);
        e.sujo = false;
        e.desde = -1;
        e.pedidoBase = null;
        e.pedidoAnexo = null;
        st.pedidoA = null;
        st.versao++;
        st.vMin = st.versao;
      }
      setorDe.fill(-1);
      for (const [s, l] of novas) for (const i of l) {
        setorDe[i] = s;
        sig[i] = assinatura(P, i);
      }
      tabelaInteira = true;
      obraInteira = true;
      tabela.clearUpdateRanges();
      obra.clearUpdateRanges();
      for (let i = 0; i < Math.min(P.cap, LADO_TABELA * LADO_TABELA); i++) escreverTabela(P, i);
      tabela.needsUpdate = true;
      obra.needsUpdate = true;
      versaoBits++;
      return;
    }
    if (!d.predios?.length) return;
    const t = agoraMs();
    for (const i of d.predios) {
      const velho = setorDe[i];
      const vivo = i < P.n && P.viva[i] && P.tipo[i] === TIPO_PREDIO.ZONA;
      const novo = vivo ? grade.indice(P.x[i], P.z[i]) : -1;
      const sg = vivo ? assinatura(P, i) : 0;
      if (velho !== novo) {
        if (velho >= 0) tirar(setorPara(velho), i);
        if (novo >= 0) {
          const st = setorPara(novo);
          st.lista.push(i);
          st.lista.sort((a, b) => a - b);
          st.versao++;
        }
        reg.mudou(velho, novo, t);
      } else if (novo >= 0 && sig[i] !== sg) {
        setorPara(novo).versao++;
        reg.mudou(novo, novo, t);
      }
      // a vaga voltou viva fora dos setores (colocável, mesmo idx no aId): as malhas com a cópia velha refundem já,
      // senão o APAGADO esconderia o colocável junto até a refusão
      if (!vivo && i < P.n && P.viva[i] && (reg.baseSec[i] >= 0 || reg.anexoSec[i] >= 0)) reg.urgente(i, t);
      const mexeu = velho !== novo || sig[i] !== sg;
      setorDe[i] = novo;
      sig[i] = sg;
      // a simulação marca o prédio por muita coisa (moradores, empregos): a cópia filtrada da sombra e do lote só é
      // refeita quando o lugar, a aparência ou os bits mudam
      if (escreverTabela(P, i) || mexeu) {
        if (velho >= 0) setorPara(velho).vBits = ++versaoBits;
        if (novo >= 0) setorPara(novo).vBits = ++versaoBits;
      }
    }
  }

  /** Cor da Holding (D34) para o vértice, em sRGB 0..255. */
  function corHolding(esp) {
    const hex = esp.holding?.cor;
    if (typeof hex !== 'string' || hex.length < 7) return;
    const n = parseInt(hex.slice(1, 7), 16);
    if (Number.isFinite(n)) uniformesEdificio.gCorHolding.value.set((n >> 16) & 255, (n >> 8) & 255, n & 255);
  }

  /** Bits dos prédios tocados por uma base ou um anexo que chegou. */
  function atualizarBits(idx) {
    const P = ctx.sim.espelho.predios;
    if (!P) return;
    for (const i of idx) {
      if (!escreverBits(P, i)) continue;
      const s = setorDe[i];
      if (s >= 0) setorPara(s).vBits = ++versaoBits;
      const b = reg.baseSec[i];
      if (b >= 0 && b !== s) setorPara(b).vBits = ++versaoBits;
    }
  }

  // ---------------------------------------------------------------------------------------------- pedidos

  /** Pede a base do setor (refusão): LOD1 sempre, LOD0 e o lote quando o setor está perto. */
  function pedir(st, lod0) {
    const P = ctx.sim.espelho.predios;
    const lista = reg.listaDaBase(st.s, st.lista);
    const sigs = lista.map((i) => sig[i]);
    const versao = st.versao;
    const { dados, transferir } = pedidoDoSetor(P, lista, grade, st.s, lod0);
    if (lod0) {
      st.pedido0 = versao;
      pendentes0++;
    } else {
      st.pedido1 = versao;
      pendentes1++;
    }
    reg.pedirBase(st.s, lista, sigs);
    const t0 = agoraMs();
    oficina.pedir('setor', dados, { chave: st.s, transferir }).then((r) => {
      if (lod0) pendentes0--;
      else pendentes1--;
      recebidos.push({ tipo: 'base', st, r, lista, sigs, versao, lod0, ms: agoraMs() - t0 });
    });
  }

  /** Pede o anexo do setor: só os prédios que a base não tem na versão atual. */
  function pedirAnexo(st, lista, lod0) {
    const P = ctx.sim.espelho.predios;
    const sigs = lista.map((i) => sig[i]);
    const { dados, transferir } = pedidoDoSetor(P, lista, grade, st.s, lod0);
    st.pedidoA = { lista, sigs, lod0 };
    pendentesA++;
    reg.pedirAnexo(st.s, lista, sigs);
    const versao = st.versao;
    oficina.pedir('anexo', dados, { chave: st.s, transferir }).then((r) => {
      pendentesA--;
      recebidos.push({ tipo: 'anexo', st, r, lista, sigs, lod0, versao });
    });
  }

  function receberLod1(st, r, lista, versao) {
    st.lod1 = r.lod1;
    st.ordem = -1;
    st.lista1 = lista;
    st.caixas = r.caixas;
    st.v1 = versao;
    st.filtro = null;
    // altura do setor pelas caixas (para a distância e o descarte)
    const [y0, y1] = alturaDasCaixas(lista, r.caixas);
    st.ymin = y0;
    st.ymax = y1;
  }

  function alturaDasCaixas(lista, caixas) {
    let y0 = Infinity;
    let y1 = -Infinity;
    const P = ctx.sim.espelho.predios;
    for (let k = 0; k < lista.length; k++) {
      const i = lista[k];
      const yb = P.y[i];
      y0 = Math.min(y0, yb + caixas[CAIXA * k + 4]);
      y1 = Math.max(y1, yb + caixas[CAIXA * k + 5]);
    }
    return [Number.isFinite(y0) ? y0 : -2, Number.isFinite(y1) ? y1 : 10];
  }

  function soltarLod0(st) {
    if (!st.lod0) return;
    cena.remove(st.lod0.mesh);
    st.lod0.mesh.geometry.dispose();
    nLod0--;
    bytesLod0 -= st.lod0.bytes;
    st.lod0 = null;
  }

  function receberLod0(st, r, versao) {
    soltarLod0(st);
    const m = r.malhas?.[0];
    st.lote = r.lote ?? null;
    st.filtro = null;
    if (!m) {
      st.lod0 = { mesh: new THREE.Object3D(), versao, bytes: 0 };
      nLod0++;
      return;
    }
    const L = malhaLod0(m, material, st.x0, st.z0, `predios:lod0:${st.s}`);
    medidas.familia(L.mesh, 'predios');
    cena.add(L.mesh);
    st.lod0 = { mesh: L.mesh, versao, bytes: L.bytes, tris: L.tris };
    nLod0++;
    bytesLod0 += L.bytes;
  }

  function soltarAnexo(st) {
    const a = st.anexo;
    if (!a) return;
    if (a.lod0) {
      cena.remove(a.lod0.mesh);
      a.lod0.mesh.geometry.dispose();
      bytesLod0 -= a.lod0.bytes;
    }
    st.anexo = null;
    nAnexos--;
    st.filtro = null;
    st.vBits = ++versaoBits;
    atualizarBits(reg.soltarAnexo(st.s));
  }

  function receberAnexo(st, r, lista, sigs, lod0) {
    const velho = st.anexo;
    if (velho?.lod0) {
      cena.remove(velho.lod0.mesh);
      velho.lod0.mesh.geometry.dispose();
      bytesLod0 -= velho.lod0.bytes;
    }
    if (!velho) nAnexos++;
    let l0 = null;
    const m = lod0 ? r.malhas?.[0] : null;
    if (m) {
      const L = malhaLod0(m, material, st.x0, st.z0, `predios:anexo:${st.s}`);
      medidas.familia(L.mesh, 'predios');
      L.mesh.visible = st.modo === 0 && st.vis;
      cena.add(L.mesh);
      bytesLod0 += L.bytes;
      l0 = L;
    }
    st.anexo = { n: ++serialAnexo, lod1: r.lod1, caixas: r.caixas, lista, lod0: l0, temLod0: !!lod0, lote: lod0 ? r.lote : null, ordem: -1 };
    st.filtro = null;
    // a sombra e o lote seguem o anexo novo mesmo quando nenhum bit muda (a mesma lista, outra versão dos prédios)
    st.vBits = ++versaoBits;
    const [y0, y1] = alturaDasCaixas(lista, r.caixas);
    st.ymin = Math.min(st.ymin, y0);
    st.ymax = Math.max(st.ymax, y1);
    atualizarBits(reg.anexoChegou(st.s, lista, sigs));
  }

  /**
   * Recebe o que a oficina entregou. A base sem LOD0 e o anexo sem LOD0 entram todos; com LOD0, uma base e um anexo
   * por quadro (o envio à GPU). A troca de malha e o bit do anexo mudam no mesmo quadro: nada pisca.
   */
  function receber(max) {
    let feitos0 = 0;
    let feitosA = 0;
    for (let k = 0; k < recebidos.length; ) {
      const x = recebidos[k];
      const { st, r } = x;
      if (r.erro) {
        if (x.tipo === 'anexo') {
          st.pedidoA = null;
          reg.setor(st.s).pedidoAnexo = null;
        } else {
          if (x.lod0) st.pedido0 = 0;
          else st.pedido1 = 0;
          reg.setor(st.s).pedidoBase = null;
          reg.setor(st.s).sujo = true;
        }
        recebidos.splice(k, 1);
        continue;
      }
      if (x.versao < (st.vMin ?? 0)) {
        // pedida antes de o setor recomeçar (tudo de novo): não vale
        recebidos.splice(k, 1);
        continue;
      }
      if (x.tipo === 'anexo') {
        if (x.lod0 && feitosA >= max) {
          k++;
          continue;
        }
        recebidos.splice(k, 1);
        if (st.pedidoA && st.pedidoA.lista === x.lista) st.pedidoA = null;
        receberAnexo(st, r, x.lista, x.sigs, x.lod0);
        if (x.lod0) feitosA++;
        // a base refundida chegou antes deste anexo com tudo dentro: ele nasceu inútil (malha e chamada a mais) e sai
        if (!reg.desejado(st.s, st.lista, (i) => sig[i]).length) soltarAnexo(st);
        continue;
      }
      if (x.lod0 && feitos0 >= max) {
        k++;
        continue;
      }
      recebidos.splice(k, 1);
      // uma resposta velha não passa por cima de uma mais nova
      if (st.lod1 && x.versao < st.v1) {
        reg.setor(st.s).pedidoBase = null;
        continue;
      }
      receberLod1(st, r, x.lista, x.versao);
      if (x.lod0) {
        receberLod0(st, r, x.versao);
        feitos0++;
      } else if (st.lod0) {
        // a base nova é só do LOD1: o LOD0 guardado (setor longe) ficou velho
        soltarLod0(st);
        st.lote = null;
      }
      const { tocados } = reg.baseChegou(st.s, x.lista, x.sigs);
      atualizarBits(tocados);
      // o anexo que a base absorveu inteiro sai
      if (st.anexo && !reg.desejado(st.s, st.lista, (i) => sig[i]).length) soltarAnexo(st);
    }
  }

  // ---------------------------------------------------------------------------------------------- quadro

  const perfilLod = () => ({ lod0: ctx.perfil.lod0, ...(porPerfil(LOD_PREDIOS, ctx.perfil)) });

  /** Prédio idx (com o bit do anexo no id) visível nesta cópia? emObra: some também a obra nova (sombra e lote). */
  function valeId(id, semObra) {
    const i = id & MASCARA_ID;
    const g = dadosTab[4 * i + 1];
    if (g & BITS_TABELA.APAGADO) return false;
    if (!!(g & BITS_TABELA.ANEXO) !== !!(id & ID_ANEXO)) return false;
    return !(semObra && (g & (BITS_TABELA.OBRA | BITS_TABELA.NIVEL)) === BITS_TABELA.OBRA);
  }

  /** Cópias filtradas do setor (sombra: sem as cópias que não valem nem a obra; lote: idem), pela versão dos bits. */
  function filtroDe(st) {
    if (st.filtro && st.filtro.v === st.vBits && st.filtro.v1 === st.v1 && st.filtro.a === st.anexo) return st.filtro;
    const ok = (id) => valeId(id, true);
    const sombra = [];
    for (let f = 0; f < FORMAS.length; f++) {
      const g = [];
      if (st.lod1) g.push(filtrarGrupo(st.lod1[f], ok));
      if (st.anexo?.lod1) g.push(filtrarGrupo(st.anexo.lod1[f], ok));
      sombra.push(g);
    }
    const lotes = [];
    for (const lote of [st.lote, st.anexo?.lote]) {
      if (!lote) continue;
      // os itens do lote levam o idx puro: valem pela cópia da malha de onde vieram (base ou anexo)
      const marca = lote === st.anexo?.lote ? ID_ANEXO : 0;
      const okL = (id) => valeId((id | marca) >>> 0, true);
      lotes.push({ copa: filtrarGrupo(lote.copa, okL), palmeira: filtrarGrupo(lote.palmeira, okL), carros: lote.carros.map((c) => filtrarGrupo(c, okL)) });
    }
    st.filtro = { v: st.vBits, v1: st.v1, a: st.anexo, sombra, lotes, n: ++filtros };
    return st.filtro;
  }

  /**
   * Escolhe o LOD de cada setor, faz os pedidos e monta as listas visíveis e de sombra. O LOD1 é leve (só o plano e as
   * instâncias): na carga sai inteiro aqui (LOD1_NA_CARGA). Depois, o que muda vai para o anexo do setor (pequeno, um
   * por quadro) e a base é refundida quando o setor fica quieto (D39).
   */
  function passo({ envio = 1, pedidos1 = oficina.worker ? 1024 : 6, pedidos0 = 2, pedidosA = 8 } = {}) {
    quadros++;
    const tEnvio0 = agoraMs();
    receber(envio);
    const tReceber = agoraMs() - tEnvio0;
    const agora = agoraMs();
    const cam = ctx.camera;
    cam.updateMatrixWorld();
    mProj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    frustum.setFromProjectionMatrix(mProj);
    const L = perfilLod();
    const cp = cam.position;
    const cand1 = [];
    const cand0 = [];
    const candA = [];
    let hv = 0x811c9dc5;
    const vis = [];
    let quer0 = 0;
    let lod0Vis = 0;
    // o corte com a mesma distância (e a mesma reserva sem câmera) que Faixas.desenhar usa neste quadro
    const lim = duasFaixas ? limiteFaixas(ctx.cameraApi?.estado?.().dist ?? 1000) : Infinity;
    if (duasFaixas) cam.getWorldDirection(frente);
    // carga: o LOD1 que falta sai aqui mesmo, sem a oficina
    if (carga) {
      carga = false;
      const faltam = [...setores.values()].filter((st) => st.lista.length && !st.lod1);
      if (faltam.reduce((a, st) => a + st.lista.length, 0) <= LOD1_NA_CARGA) {
        const P = ctx.sim.espelho.predios;
        for (const st of faltam) {
          const lista = reg.listaDaBase(st.s, st.lista);
          const sigs = lista.map((i) => sig[i]);
          receberLod1(st, gerarSetor(pedidoDoSetor(P, lista, grade, st.s, false).dados), lista, st.versao);
          reg.pedirBase(st.s, lista, sigs);
          atualizarBits(reg.baseChegou(st.s, lista, sigs).tocados);
        }
      }
    }
    const devidos = new Set(reg.devidos(agora, (s) => setores.get(s)?.anexo?.lista.length ?? 0));
    for (const st of setores.values()) {
      if (!st.lista.length) {
        // setor que esvaziou: nada a desenhar (a base sai do registro: as vagas mortas dela deixam de estar apagadas)
        if (st.lod1 || st.lod0 || st.anexo) {
          esvaziar(st);
          atualizarBits(reg.baseChegou(st.s, [], []).tocados);
        }
        st.v1 = st.versao;
        continue;
      }
      const d = distCaixa(cp.x, cp.y, cp.z, st.x0, st.ymin, st.z0, st.x0 + LADO_SETOR, st.ymax, st.z0 + LADO_SETOR);
      st.dist = d;
      // histerese de 10% nas duas trocas
      const perto = st.modo === 0 ? d < L.lod0 * 1.1 : d < L.lod0 * 0.9;
      const longe = st.modo === 2 ? d > L.lod2 * 0.9 : d > L.lod2 * 1.1;
      st.modo = perto ? 0 : longe ? 2 : 1;
      // a base: uma no ar por setor; sem base, na refusão (D39) e, perto, sem o LOD0
      const noAr = !!reg.setor(st.s).pedidoBase;
      const refundir = devidos.has(st.s);
      caixa.min.set(st.x0 - 40, st.ymin, st.z0 - 40);
      caixa.max.set(st.x0 + LADO_SETOR + 40, st.ymax + 5, st.z0 + LADO_SETOR + 40);
      st.vis = frustum.intersectsBox(caixa);
      if (st.modo === 0) {
        if (!noAr && (!st.lod1 || refundir || !st.lod0)) cand0.push(st);
        if (st.lod0) st.usado = quadros;
      } else if (!noAr && (!st.lod1 || refundir)) cand1.push(st);
      // anexo: o que a base não tem na versão atual, pedido quando a lista ou uma assinatura muda (um no ar por setor)
      if (st.lod1 && !st.pedidoA && reg.setor(st.s).sujo) {
        const quer = reg.desejado(st.s, st.lista, (i) => sig[i]);
        const a = st.anexo;
        const perto0 = st.modo === 0;
        const igual = a && a.lista.length === quer.length && quer.every((i, k) => a.lista[k] === i && reg.setor(st.s).anexo?.sigs[k] === sig[i]) && (a.temLod0 || !perto0);
        if (quer.length && !igual) candA.push({ st, quer, lod0: perto0 });
      } else if (st.modo === 0 && st.anexo && !st.anexo.temLod0 && !st.pedidoA) {
        candA.push({ st, quer: st.anexo.lista.slice(), lod0: true });
      }
      // o LOD0 só com o anexo também no LOD0: o anexo que ainda é só do LOD1 (pedido de longe) esconde a cópia da base
      // e não seria desenhado; até o LOD0 dele chegar, o setor fica no LOD1 (base e anexo)
      const mostra0 = st.modo === 0 && st.lod0 && (!st.anexo || st.anexo.temLod0);
      if (st.lod0) st.lod0.mesh.visible = !!mostra0 && st.vis;
      if (st.anexo?.lod0) st.anexo.lod0.mesh.visible = !!mostra0 && st.vis;
      if (st.modo === 0) quer0++;
      if (mostra0 && st.vis) lod0Vis++;
      if (st.vis && st.lod1 && !mostra0) {
        // faixa de profundidade: perto se algo do setor fica antes do corte da de perto, longe se algo passa do
        // começo da de longe (o setor na emenda vai nas duas); a caixa é a do descarte, com a folga dos lotes
        const fx = duasFaixas ? faixaDaCaixa(cp.x, cp.y, cp.z, frente.x, frente.y, frente.z, caixa.min.x, caixa.min.y, caixa.min.z, caixa.max.x, caixa.max.y, caixa.max.z, lim) : 1;
        st.faixa = fx;
        vis.push(st);
      }
    }
    // da frente para trás (PC2): o teste de profundidade descarta o prédio de trás antes da fachada. Por faixas de um
    // setor de distância, para a lista não ser refeita a cada passo da câmera
    ordenarDaFrente(vis);
    // e as instâncias de cada setor na direção da vista (só quando o balde da direção muda), com um teto de instâncias
    // por quadro, os setores da frente primeiro: girar a câmera não trava um quadro. As listas só são refeitas com a
    // ordem nova em todos (até lá a GPU desenha a ordem de antes, que só custa um pouco mais de pixel)
    cam.getWorldDirection(frente);
    const balde = baldeDaVista(frente);
    let cota = ORDEM_POR_QUADRO;
    let emOrdem = true;
    for (const st of vis) {
      if (st.ordem === balde.id && (!st.anexo || st.anexo.ordem === balde.id)) continue;
      if (cota <= 0) {
        emOrdem = false;
        continue;
      }
      for (const x of st.lod1) {
        ordenarInstancias(x, balde);
        cota -= x.n;
      }
      st.ordem = balde.id;
      if (st.anexo) {
        for (const x of st.anexo.lod1) ordenarInstancias(x, balde);
        st.anexo.ordem = balde.id;
      }
    }
    if (emOrdem) ordemVista = balde.id;
    hv = Math.imul(hv ^ ordemVista, 0x01000193);
    for (const st of vis) {
      hv = Math.imul(hv ^ st.s, 0x01000193);
      hv = Math.imul(hv ^ (st.modo * 7919 + st.v1 * 4 + st.faixa), 0x01000193);
      if (st.anexo) hv = Math.imul(hv ^ st.anexo.n, 0x01000193);
    }
    // pedidos: os mais perto primeiro
    cand1.sort((a, b) => a.dist - b.dist);
    for (const st of cand1) {
      if (pendentes1 >= pedidos1) break;
      pedir(st, false);
    }
    cand0.sort((a, b) => a.dist - b.dist);
    for (const st of cand0) {
      if (pendentes0 >= pedidos0) break;
      pedir(st, true);
    }
    candA.sort((a, b) => a.st.dist - b.st.dist);
    for (const c of candA) {
      if (pendentesA >= pedidosA) break;
      pedirAnexo(c.st, c.quer, c.lod0);
    }
    // listas visíveis do LOD1 (todas as peças) e do LOD2 (só as principais), com as peças do anexo depois das da base
    const tLista0 = agoraMs();
    const refazVis = hv !== chaveVis;
    if (refazVis) {
      chaveVis = hv;
      let n = 0;
      formas.forEach((F, f) => {
        const perto = [];
        const longe = [];
        const por = (x, modo, faixa) => {
          const k = modo === 2 ? x.np : x.n;
          if (!k) return;
          // o LOD1 pela cópia com todas as peças em ordem (ordenarInstancias); o LOD2 só as principais
          const t = modo !== 2 && x.todas ? x.todas : x;
          const p = { mat: t.mat, ids: t.ids, bytes: t.bytes, n: k };
          if (faixa & 1) perto.push(p);
          if (faixa & 2) longe.push(p);
        };
        for (const st of vis) {
          por(st.lod1[f], st.modo, st.faixa);
          if (st.anexo) por(st.anexo.lod1[f], st.modo, st.faixa);
        }
        n += F.vis.compactar(perto);
        if (F.longe) n += F.longe.compactar(longe);
      });
      ctx.stats.instancias.predios = n;
    }
    // projetores de sombra (D43): os setores cuja sombra cai no chão da cascata (ctx.sombra.regiao: o foco que a R1a
    // puxa para baixo da câmera nas vistas rasantes, não o alvo), varridos para longe do sol pela altura do setor;
    // antes do primeiro passe, em volta do alvo da câmera. Sem as cópias que não valem nem as obras (a sombra da obra
    // que sobe é de obras.js)
    const reg0 = ctx.sombra?.regiao;
    let rx;
    let rz;
    let raio;
    if (reg0) {
      rx = reg0.x;
      rz = reg0.z;
      raio = reg0.raio + FOLGA_SOMBRA;
    } else {
      ctx.cameraApi?.alvo?.(alvo);
      rx = alvo.x;
      rz = alvo.z;
      raio = Math.min(ctx.perfil.sombra.raioMax, Math.max(60, 0.6 * cp.distanceTo(alvo))) + FOLGA_SOMBRA;
    }
    const sd = ctx.sol?.dir;
    const sh = sd ? Math.hypot(sd.x, sd.z) : 0;
    const ux = sh > 1e-4 ? sd.x / sh : 0;
    const uz = sh > 1e-4 ? sd.z / sh : 0;
    // cotangente da elevação do sol, com o sol no mínimo a ~11 graus (abaixo disso a sombra some na luz da tarde)
    const cot = sd ? sh / Math.max(0.2, sd.y) : 0;
    // de perto do foco todas as peças; mais longe só a principal de cada prédio (o texel da sombra já passa de 1 m)
    let hs = 0x811c9dc5;
    const somb = [];
    for (const st of setores.values()) {
      if (!st.lod1) continue;
      const alcance = Math.min(SOMBRA_MAX, Math.max(0, st.ymax - st.ymin) * cot);
      if (!sombraAlcanca(st.x0, st.z0, LADO_SETOR, rx, rz, raio, ux, uz, alcance)) continue;
      st.sombraToda = distRet(rx, rz, st.x0, st.z0, st.x0 + LADO_SETOR, st.z0 + LADO_SETOR) < 250;
      somb.push(st);
      hs = Math.imul(hs ^ st.s, 0x01000193);
      hs = Math.imul(hs ^ (st.v1 * 2 + (st.sombraToda ? 1 : 0)), 0x01000193);
      hs = Math.imul(hs ^ st.vBits, 0x01000193);
    }
    const tVis = agoraMs() - tLista0;
    // a sombra espera um quadro quando as listas visíveis já foram refeitas neste (o envio do quadro não soma as duas;
    // a sombra da cópia velha fica um quadro a mais)
    const tSombra0 = agoraMs();
    if (hs !== chaveSombra && (!refazVis || sombraAdiada)) {
      sombraAdiada = false;
      chaveSombra = hs;
      formas.forEach((F, f) => {
        const pedacos = [];
        for (const st of somb) for (const g of filtroDe(st).sombra[f]) if (g.n) pedacos.push({ mat: g.mat, ids: null, bytes: null, n: st.sombraToda ? g.n : g.np });
        F.sombra.compactar(pedacos);
      });
      ctx.sombra.marcar();
    } else if (hs !== chaveSombra) sombraAdiada = true;
    const tSomb = agoraMs() - tSombra0;
    const tListas = tVis + tSomb;
    // cache LRU do LOD0 e teto de memória
    const capCache = Math.max(L.cache, quer0);
    if (nLod0 > capCache || bytesLod0 > L.memoriaMB * 1048576 * 0.6) {
      const velhos = [...setores.values()].filter((st) => st.lod0 && st.modo !== 0).sort((a, b) => a.usado - b.usado);
      for (const st of velhos) {
        if (nLod0 <= capCache && bytesLod0 <= L.memoriaMB * 1048576 * 0.6) break;
        soltarLod0(st);
        st.lote = null;
        st.filtro = null;
      }
    }
    // envio do quadro: as malhas novas (base e anexo) e as listas compactadas; o pior dos últimos 120 quadros
    const ms = tReceber + tListas;
    janelaEnvio[quadros % janelaEnvio.length] = ms;
    piorPartes.receber = Math.max(piorPartes.receber, tReceber);
    piorPartes.listas = Math.max(piorPartes.listas, tVis);
    piorPartes.sombra = Math.max(piorPartes.sombra, tSomb);
    const S = ctx.stats.setores;
    S.lod0 = lod0Vis;
    S.anexos = nAnexos;
    S.msEnvio = +ms.toFixed(2);
    S.piorEnvio = +Math.max(...janelaEnvio).toFixed(2);
    S.pendentes = pendentes0 + pendentes1 + pendentesA + recebidos.length;
  }

  /** Hora, noite, tique da obra e o céu de reserva do reflexo. */
  function uniformes(c) {
    uniformesEdificio.gHora.value = c.horaDoCeu();
    const tp = c.sim.espelho.tempo;
    uniformesEdificio.gTique.value = (tp?.tique ?? 0) + (tp?.frac ?? 0);
    const dia = c.sol?.dia ?? 1;
    uniformesEdificio.gNoite.value = Math.min(1, Math.max(0, 1 - dia * 1.25));
    uniformesEdificio.gCeuLigado.value = c.cena.environment ? 0 : 1;
    const hor = c.ganchos.uniformes.gNeblinaCor?.value;
    if (hor) uniformesEdificio.gCeuHor.value.copy(hor);
    const bg = c.cena.background;
    if (bg?.isColor) uniformesEdificio.gCeuZen.value.copy(bg).multiplyScalar(0.85);
    else uniformesEdificio.gCeuZen.value.copy(uniformesEdificio.gCeuHor.value).multiply(new THREE.Color(0.55, 0.68, 0.95));
    uniformesEdificio.gCeuChao.value.copy(uniformesEdificio.gCeuHor.value).multiplyScalar(0.28);
    materialLonge.userData.amostras?.();
  }

  // camadas (X3a): o valor por prédio no canal R da tabela; seleção: realce pelo idx
  const paraDesligar = [
    ctx.ouvir('camadas', (c) => {
      const P = ctx.sim.espelho.predios;
      if (!P) return;
      const liga = c && c.fonte === 'predios' && c.dados;
      const min = c?.min ?? 0;
      const max = c?.max ?? 1;
      const n = Math.min(P.n, LADO_TABELA * LADO_TABELA);
      for (let i = 0; i < n; i++) {
        const v = liga ? (c.dados[i] - min) / (max - min || 1) : 0;
        dadosTab[4 * i] = Math.max(0, Math.min(255, Math.round(v * 255)));
      }
      tabelaInteira = true;
      tabela.clearUpdateRanges();
      tabela.needsUpdate = true;
    }),
    ctx.ouvir('selecionado', (ref) => {
      uniformesEdificio.gSelecionado.value = ref === null || ref === undefined ? -1 : idxDaRef(ref);
    }),
  ];

  /** Seleção pela caixa de cada prédio (a mesma do plano), sem ler a GPU; a base e o anexo, só a cópia que vale. */
  function selecionar(raio, esp) {
    const P = esp.predios;
    if (!P) return null;
    const o = raio.origem;
    const dv = raio.dir;
    let melhor = null;
    const testar = (lista, cx, marca) => {
      for (let k = 0; k < lista.length; k++) {
        const i = lista[k];
        if (i >= P.n || !P.viva[i] || !valeId((i | marca) >>> 0, false)) continue;
        const b = CAIXA * k;
        const t = raioNaCaixaGirada(o, dv, P.x[i], P.y[i], P.z[i], P.rot[i], cx[b], cx[b + 4], cx[b + 1], cx[b + 2], cx[b + 5], cx[b + 3]);
        if (t !== null && (!melhor || t < melhor.dist)) {
          melhor = { tipo: 'predio', idx: i, ref: refDe(i, P.ger[i]), dist: t, ponto: [o[0] + dv[0] * t, o[1] + dv[1] * t, o[2] + dv[2] * t] };
        }
      }
    };
    for (const st of setores.values()) {
      if (!st.lod1 || !st.lista1) continue;
      if (raioNaCaixaAlinhada(o, dv, st.x0 - 40, st.ymin, st.z0 - 40, st.x0 + LADO_SETOR + 40, st.ymax, st.z0 + LADO_SETOR + 40) === null) continue;
      testar(st.lista1, st.caixas, 0);
      if (st.anexo) testar(st.anexo.lista, st.anexo.caixas, ID_ANEXO);
    }
    return melhor;
  }

  function prontoAgora() {
    if (pendentes0 || pendentes1 || pendentesA || recebidos.length) return false;
    for (const st of setores.values()) {
      if (st.lista.length && !st.lod1) return false;
      if (st.modo === 0 && st.vis && st.lista.length && (!st.lod0 || (st.anexo && !st.anexo.temLod0))) return false;
    }
    return true;
  }

  const dom = {
    nome: 'predios',
    material,
    materialLonge,
    tabela,
    obra,
    aplicar(d, esp) {
      aplicar(d, esp);
    },
    quadro(tMs, c) {
      uniformes(c);
      passo();
    },
    selecionar,
    /** true quando todos os setores têm o LOD pedido pela vista atual. */
    pronto: prontoAgora,
    /**
     * Para as cenas fixas e as capturas: lê o espelho, põe a câmera em dia e espera a oficina entregar tudo o que a
     * vista pede (sem o limite de um setor por quadro). Devolve as medidas.
     */
    async preparar({ teto = 120000 } = {}) {
      const t0 = agoraMs();
      ctx.cameraApi?.atualizar?.(t0);
      if (!iniciado) aplicar(ctx.sim.mudancas.desde(-1), ctx.sim.espelho);
      uniformes(ctx);
      while (agoraMs() - t0 < teto) {
        passo({ envio: 64, pedidos1: 1024, pedidos0: 4 });
        if (prontoAgora()) break;
        if (oficina.worker) await new Promise((ok) => setTimeout(ok, 30));
        else {
          oficina.rodarLocal(4);
          await Promise.resolve();
        }
      }
      passo({ envio: 64 });
      return dom.medidas();
    },
    medidas() {
      let inst = 0;
      let tris1 = 0;
      formas.forEach((F) => {
        const c = F.vis.count + (F.longe?.count ?? 0);
        inst += c;
        tris1 += c * F.tris;
      });
      let tris0 = 0;
      for (const st of setores.values()) {
        if (st.lod0?.tris && st.lod0.mesh.visible) tris0 += st.lod0.tris;
        if (st.anexo?.lod0?.tris && st.anexo.lod0.mesh.visible) tris0 += st.anexo.lod0.tris;
      }
      return {
        setores: setores.size, lod0: nLod0, lod0Visiveis: ctx.stats.setores.lod0, anexos: nAnexos, instancias: inst, trisLod1: tris1, trisLod0: tris0,
        memoriaLod0MB: +(bytesLod0 / 1048576).toFixed(2), sombra: formas.reduce((a, F) => a + F.sombra.count * F.tris, 0),
        envio: Object.fromEntries(Object.entries(piorPartes).map(([k, v]) => [k, +v.toFixed(2)])),
      };
    },
    /** Zera o pior envio por parte (medidas().envio): a cena bairro mede só o crescimento, sem a carga. */
    zerarEnvio() {
      for (const k of Object.keys(piorPartes)) piorPartes[k] = 0;
    },
    /** Caixa de um prédio no espaço do lote ([x0, z0, x1, z1, y0, y1]) ou null (âncoras, câmera). */
    caixaDoPredio(i) {
      const st = setores.get(setorDe[i]);
      if (!st) return null;
      const a = st.anexo ? st.anexo.lista.indexOf(i) : -1;
      if (a >= 0 && valeId((i | ID_ANEXO) >>> 0, false)) return Array.from(st.anexo.caixas.subarray(CAIXA * a, CAIXA * a + 6));
      if (!st.lista1) return null;
      const k = st.lista1.indexOf(i);
      return k < 0 ? null : Array.from(st.caixas.subarray(CAIXA * k, CAIXA * k + 6));
    },
    /** Plano do prédio da cidade em obra (obras.js: esqueleto, grua e tela) ou null. */
    planoObra,
    /**
     * Altura (m) do corte da obra de um prédio que não é da cidade (R5: os colocáveis desenhados com o material
     * `edificio`); 0 ou null tira (sem corte).
     */
    alturaObra(i, H) {
      if (H > 0) alturasFora.set(i, H);
      else alturasFora.delete(i);
      const P = ctx.sim.espelho.predios;
      if (P && i < P.cap) escreverTabela(P, i);
    },
    /** Itens do lote (árvores e carros) dos setores com o LOD0 à vista, filtrados (lotes.js). */
    lotesVisiveis() {
      const out = [];
      for (const st of setores.values()) {
        if (st.modo !== 0 || !st.vis || !st.lod0 || (!st.lote && !st.anexo?.lote)) continue;
        const f = filtroDe(st);
        out.push({ s: st.s, dist: st.dist, chave: f.n, lotes: f.lotes });
      }
      return out;
    },
    /**
     * Bancada A/B dos ganchos de longe (R4b): põe no LOD1 e no LOD2 o material de longe com estes ganchos e amostras
     * (null volta ao do domínio), na mesma página e na mesma câmera; devolve o nome da variante.
     */
    bancadaLonge(v = null) {
      const k = v ? `${(v.nomes ?? GANCHOS_LONGE).join(',')}|${v.amostras ?? 0}` : '';
      let m = materialLonge;
      if (v) {
        variantesLonge.set(k, variantesLonge.get(k) ?? criarMaterialEdificio(ctx, { barata: true, nomes: v.nomes ?? GANCHOS_LONGE, amostras: v.amostras ?? 0 }));
        m = variantesLonge.get(k);
        m.userData.amostras?.();
      }
      for (const F of formas) {
        for (const l of [F.vis, F.longe]) {
          if (!l) continue;
          l.material = m;
          if (l.malha) l.malha.material = m;
        }
      }
      return k || 'dominio';
    },
    /** Lista do setor do prédio i e as assinaturas atuais (testes e obras.js). */
    setorDe: (i) => (i < setorDe.length ? setorDe[i] : -1),
    registro: reg,
    descartar() {
      for (const f of paraDesligar) f?.();
      for (const st of setores.values()) {
        soltarLod0(st);
        soltarAnexo(st);
      }
      for (const F of formas) {
        cena.remove(F.vis.malha);
        if (F.longe) {
          cena.remove(F.longe.malha);
          F.longe.descartar();
        }
        ctx.sombra.soltar(F.sombra.malha);
        F.vis.descartar();
        F.sombra.descartar();
      }
      ctx.quadro?.aquecer?.delete?.(moldeLod0);
      geoMolde.dispose();
      tabela.dispose();
      obra.dispose();
      material.dispose();
      materialLonge.dispose();
      for (const m of variantesLonge.values()) m.dispose();
    },
  };
  return dom;
}

// ------------------------------------------------------------------------------------------------ raio

function raioNaCaixaAlinhada(o, d, x0, y0, z0, x1, y1, z1) {
  let t0 = 0;
  let t1 = Infinity;
  const eixo = (oo, dd, lo, hi) => {
    if (Math.abs(dd) < 1e-9) return oo >= lo && oo <= hi;
    let a = (lo - oo) / dd;
    let b = (hi - oo) / dd;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    return t0 <= t1;
  };
  if (!eixo(o[0], d[0], x0, x1) || !eixo(o[1], d[1], y0, y1) || !eixo(o[2], d[2], z0, z1)) return null;
  return t0;
}

/** Raio contra a caixa [x0, x1] x [y0, y1] x [z0, z1] do lote girado por rot em torno de (cx, cy, cz). */
function raioNaCaixaGirada(o, d, cx, cy, cz, rot, x0, y0, z0, x1, y1, z1) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  // mundo para o lote: inverso de x = xl c + zl s, z = -xl s + zl c
  const ox = o[0] - cx;
  const oz = o[2] - cz;
  const lo = [ox * c - oz * s, o[1] - cy, ox * s + oz * c];
  const ld = [d[0] * c - d[2] * s, d[1], d[0] * s + d[2] * c];
  return raioNaCaixaAlinhada(lo, ld, x0, y0, z0, x1, y1, z1);
}

/** Registra o domínio (troca o substituto da F0) e a seleção dos prédios. */
export function registrar(api) {
  api.registrarDominio('predios', criarPredios);
  api.registrarSelecionavel('predios', (raio, ctx) => ctx.dominio('predios')?.selecionar?.(raio, ctx.sim.espelho) ?? null, { prioridade: PRIORIDADE.mundo });
}
