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
//   tabela de prédios na GPU: RGBA8 512² (R camada, G bits, B agenda) e RG32F 512² (início e fim da obra, R4b)
// Publica para as outras parcelas: criarMaterialEdificio(ctx) (X1a, R5), uniformesEdificio, e no domínio
// ctx.dominio('predios'): { tabela, obra, material, preparar(), pronto(), caixaDoPredio(idx), medidas() }.
import * as THREE from 'three';
import { GradeSetores, pedidoDoSetor, assinatura, distCaixa, LADO_SETOR } from './setores.js';
import { ListaCompactada } from './instancias.js';
import { oficinaDe } from './oficina.js';
import { formaUnitaria, FORMAS, BITS_TABELA } from '../geracao/malhaPredio.js';
import { CAIXA, gerarSetor } from '../geracao/fundir.js';
import * as SH from '../materiais/shaders/fachada.glsl.js';
import { PREDIO, TIPO_PREDIO } from '../../contratos/flags.js';
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

function trocar(src, alvo, novo) {
  if (!src.includes(alvo)) throw new Error(`edificio: shader sem '${alvo}' (o three mudou?)`);
  return src.replace(alvo, novo);
}

/**
 * Material `edificio` (desenho do render 9.1): MeshStandardMaterial com a fachada no shader e os ganchos comuns. O
 * mesmo material serve ao LOD0 fundido (atributos quantizados por vértice) e ao LOD1 instanciado (o three compila as
 * duas variantes). Para X1a e R5: escrever a malha no formato de malhaPredio.js e usar este material. barata (PC2): a
 * fachada de longe do LOD1 e do LOD2 (FAC_BARATA: sem paralaxe, caixilho, ar-condicionado, grade, letras e o detalhe
 * fino, que somem no pixel; a grade de janelas, as persianas, as cortinas e a luz das janelas ficam).
 */
export function criarMaterialEdificio(ctx, { ganchos = null, barata = false } = {}) {
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
  m.customProgramCacheKey = () => (barata ? 'edificio-1-barata' : 'edificio-1');
  m.userData.edificio = true;
  const g = ganchos ?? ctx.ganchos;
  g.aplicar(m, g.nomes());
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

// ------------------------------------------------------------------------------------------------ domínio

function criarPredios(ctx) {
  const { cena, medidas } = ctx;
  const esp0 = ctx.sim.espelho;
  const grade = new GradeSetores({ tam: esp0.mapa?.tam ?? 8192, origem: esp0.mapa?.origem ?? [-4096, -4096] });
  const oficina = oficinaDe(ctx);
  // o LOD0 (perto) com a fachada inteira; o LOD1 e o LOD2 (de longe) com a barata (PC2)
  const material = criarMaterialEdificio(ctx);
  const materialLonge = criarMaterialEdificio(ctx, { barata: true });

  // tabelas na GPU
  const dadosTab = new Uint8Array(LADO_TABELA * LADO_TABELA * 4);
  const tabela = new THREE.DataTexture(dadosTab, LADO_TABELA, LADO_TABELA, THREE.RGBAFormat, THREE.UnsignedByteType);
  tabela.magFilter = tabela.minFilter = THREE.NearestFilter;
  tabela.generateMipmaps = false;
  tabela.name = 'predios:tabela';
  // RG32F (2.4): início e fim da obra em tiques; o progresso sai no vértice, nenhum envio por quadro
  const dadosObra = new Float32Array(LADO_TABELA * LADO_TABELA * 2);
  const obra = new THREE.DataTexture(dadosObra, LADO_TABELA, LADO_TABELA, THREE.RGFormat, THREE.FloatType);
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
  uniformesEdificio.gDetalhe.value = ctx.textura('fachadaDetalhe');
  // A/B dos materiais (D46): com ?materiais=cc0 a fachada usa o detalhe fotográfico quando a montagem o traz
  if (modoMateriais() === 'cc0') {
    carregarDetalheCC0({ renderer: ctx.renderer, THREE: ctx.THREE }).then((t) => {
      if (t) uniformesEdificio.gDetalhe.value = t;
    });
  }
  const mascara = typeof location !== 'undefined' && new URLSearchParams(location.search).get('passe') === 'mascara';
  uniformesEdificio.gPrediosMascara.value = mascara ? 1 : 0;

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
  let chaveVis = -1;
  let ordemVista = -1; // o balde em que todos os setores visíveis já estão em ordem
  let chaveSombra = -1;
  let nLod0 = 0;
  let bytesLod0 = 0;
  let msEnvio = 0;
  const frustum = new THREE.Frustum();
  const mProj = new THREE.Matrix4();
  const caixa = new THREE.Box3();
  const alvo = new THREE.Vector3();
  const frente = new THREE.Vector3();

  const novoSetor = (s) => {
    const [x0, z0] = grade.canto(s);
    return { s, x0, z0, lista: [], versao: 1, lod1: null, lista1: null, v1: 0, pedido1: 0, lod0: null, pedido0: 0, ymin: -2, ymax: 40, usado: 0, modo: 1, vis: false };
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
  }

  function escreverTabela(P, i) {
    if (i >= LADO_TABELA * LADO_TABELA) return;
    const k = 4 * i;
    const viva = i < P.n && P.viva[i];
    const f = viva ? P.flags[i] : 0;
    let g = 0;
    if (f & PREDIO.ABANDONADO) g |= BITS_TABELA.ABANDONADO;
    if (f & PREDIO.OBRA) g |= BITS_TABELA.OBRA;
    if (viva && (f & PREDIO.HOLDING || P.tipo[i] === TIPO_PREDIO.HOLDING)) g |= BITS_TABELA.HOLDING;
    dadosTab[k + 1] = g;
    dadosTab[k + 2] = viva ? (Math.imul(P.semente[i] ^ 0x5bd1e995, 0x9e3779b1) >>> 24) & 255 : 0;
    dadosObra[2 * i] = viva ? P.obraIni[i] : 0;
    dadosObra[2 * i + 1] = viva ? P.obraFim[i] : 0;
    if (!tabelaInteira) tabela.addUpdateRange(k, 4);
    if (!obraInteira) obra.addUpdateRange(2 * i, 2);
  }

  function tirar(st, i) {
    const j = st.lista.indexOf(i);
    if (j >= 0) {
      st.lista.splice(j, 1);
      st.versao++;
    }
  }

  /** Espelho para os setores: quem mudou de setor, de lote ou de aparência pede o setor de novo. */
  function aplicar(d, esp) {
    const P = esp.predios;
    if (!P) return;
    crescer(P.cap);
    const tudo = !iniciado || pedeTudo(d, 'predios');
    // primeira leitura ou tudo de novo (um save aberto): o LOD1 sai na hora no próximo passo
    if (tudo) carga = true;
    iniciado = true;
    if (tudo) {
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
        let igual = l.length === st.lista.length;
        for (let k = 0; igual && k < l.length; k++) igual = l[k] === st.lista[k] && sig[l[k]] === assinatura(P, l[k]);
        if (!igual) {
          st.lista = l;
          st.versao++;
        }
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
      return;
    }
    if (!d.predios?.length) return;
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
      } else if (novo >= 0 && sig[i] !== sg) setorPara(novo).versao++;
      setorDe[i] = novo;
      sig[i] = sg;
      escreverTabela(P, i);
    }
    tabela.needsUpdate = true;
    obra.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------------------------- pedidos

  function pedir(st, lod0) {
    const P = ctx.sim.espelho.predios;
    const lista = st.lista.slice();
    const versao = st.versao;
    const { dados, transferir } = pedidoDoSetor(P, lista, grade, st.s, lod0);
    if (lod0) {
      st.pedido0 = versao;
      pendentes0++;
    } else {
      st.pedido1 = versao;
      pendentes1++;
    }
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    oficina.pedir('setor', dados, { chave: st.s, transferir }).then((r) => {
      if (lod0) pendentes0--;
      else pendentes1--;
      recebidos.push({ st, r, lista, versao, lod0, ms: (typeof performance !== 'undefined' ? performance.now() : 0) - t0 });
    });
  }

  function receberLod1(st, r, lista, versao) {
    st.lod1 = r.lod1;
    st.ordem = -1;
    st.lista1 = lista;
    st.caixas = r.caixas;
    st.v1 = versao;
    // altura do setor pelas caixas (para a distância e o descarte)
    let y0 = Infinity;
    let y1 = -Infinity;
    const P = ctx.sim.espelho.predios;
    for (let k = 0; k < lista.length; k++) {
      const i = lista[k];
      const yb = P.y[i];
      y0 = Math.min(y0, yb + r.caixas[CAIXA * k + 4]);
      y1 = Math.max(y1, yb + r.caixas[CAIXA * k + 5]);
    }
    st.ymin = Number.isFinite(y0) ? y0 : -2;
    st.ymax = Number.isFinite(y1) ? y1 : 10;
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
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    soltarLod0(st);
    const m = r.malhas?.[0];
    if (!m) {
      st.lod0 = { mesh: new THREE.Object3D(), versao, bytes: 0 };
      nLod0++;
      return;
    }
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
    mesh.position.set(st.x0 + cx, cy, st.z0 + cz);
    mesh.scale.setScalar(s);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.name = `predios:lod0:${st.s}`;
    medidas.familia(mesh, 'predios');
    cena.add(mesh);
    let bytes = m.indices.byteLength;
    for (const a of Object.values(A)) bytes += a.byteLength;
    st.lod0 = { mesh, versao, bytes, tris: m.tris };
    nLod0++;
    bytesLod0 += bytes;
    msEnvio = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
  }

  /** Recebe o que a oficina entregou: LOD1 todos, LOD0 até `max` (um por quadro no jogo). */
  function receber(max) {
    let feitos0 = 0;
    for (let k = 0; k < recebidos.length; ) {
      const { st, r, lista, versao, lod0 } = recebidos[k];
      if (r.erro) {
        if (lod0) st.pedido0 = 0;
        else st.pedido1 = 0;
        recebidos.splice(k, 1);
        continue;
      }
      if (lod0 && feitos0 >= max) {
        k++;
        continue;
      }
      recebidos.splice(k, 1);
      // uma resposta velha não passa por cima de uma mais nova
      if (!st.lod1 || versao >= st.v1) receberLod1(st, r, lista, versao);
      if (lod0 && (!st.lod0 || versao >= st.lod0.versao)) {
        receberLod0(st, r, versao);
        feitos0++;
      }
    }
  }

  // ---------------------------------------------------------------------------------------------- quadro

  const perfilLod = () => ({ lod0: ctx.perfil.lod0, ...(porPerfil(LOD_PREDIOS, ctx.perfil)) });

  /**
   * Escolhe o LOD de cada setor, faz os pedidos e monta as listas visíveis e de sombra. O LOD1 é leve (só o plano e as
   * instâncias): na carga sai inteiro aqui (LOD1_NA_CARGA); depois, com o worker, os setores que mudaram vão para a
   * fila de uma vez. O LOD0 segue com 2 na fila e 1 envio à GPU por quadro.
   */
  function passo({ envio = 1, pedidos1 = oficina.worker ? 1024 : 6, pedidos0 = 2 } = {}) {
    quadros++;
    receber(envio);
    const cam = ctx.camera;
    cam.updateMatrixWorld();
    mProj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    frustum.setFromProjectionMatrix(mProj);
    const L = perfilLod();
    const cp = cam.position;
    const cand1 = [];
    const cand0 = [];
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
      const faltam = [...setores.values()].filter((st) => st.lista.length && (!st.lod1 || st.v1 < st.versao));
      if (faltam.reduce((a, st) => a + st.lista.length, 0) <= LOD1_NA_CARGA) {
        const P = ctx.sim.espelho.predios;
        for (const st of faltam) {
          const lista = st.lista.slice();
          receberLod1(st, gerarSetor(pedidoDoSetor(P, lista, grade, st.s, false).dados), lista, st.versao);
        }
      }
    }
    for (const st of setores.values()) {
      if (!st.lista.length) {
        // setor que esvaziou: nada a desenhar
        if (st.lod0) soltarLod0(st);
        st.lod1 = null;
        st.lista1 = null;
        st.v1 = st.versao;
        continue;
      }
      const d = distCaixa(cp.x, cp.y, cp.z, st.x0, st.ymin, st.z0, st.x0 + LADO_SETOR, st.ymax, st.z0 + LADO_SETOR);
      st.dist = d;
      // histerese de 10% nas duas trocas
      const perto = st.modo === 0 ? d < L.lod0 * 1.1 : d < L.lod0 * 0.9;
      const longe = st.modo === 2 ? d > L.lod2 * 0.9 : d > L.lod2 * 1.1;
      st.modo = perto ? 0 : longe ? 2 : 1;
      if ((!st.lod1 || st.v1 < st.versao) && st.pedido1 !== st.versao) cand1.push(st);
      caixa.min.set(st.x0 - 40, st.ymin, st.z0 - 40);
      caixa.max.set(st.x0 + LADO_SETOR + 40, st.ymax + 5, st.z0 + LADO_SETOR + 40);
      st.vis = frustum.intersectsBox(caixa);
      if (st.modo === 0) {
        if ((!st.lod0 || st.lod0.versao < st.versao) && st.pedido0 !== st.versao && st.lista.length) cand0.push(st);
        if (st.lod0) st.usado = quadros;
      }
      const mostra0 = st.modo === 0 && st.lod0;
      if (st.lod0) st.lod0.mesh.visible = !!mostra0 && st.vis;
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
      if (st.ordem === balde.id) continue;
      if (cota <= 0) {
        emOrdem = false;
        continue;
      }
      for (const x of st.lod1) {
        ordenarInstancias(x, balde);
        cota -= x.n;
      }
      st.ordem = balde.id;
    }
    if (emOrdem) ordemVista = balde.id;
    hv = Math.imul(hv ^ ordemVista, 0x01000193);
    for (const st of vis) {
      hv = Math.imul(hv ^ st.s, 0x01000193);
      hv = Math.imul(hv ^ (st.modo * 7919 + st.v1 * 4 + st.faixa), 0x01000193);
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
    // listas visíveis do LOD1 (todas as peças) e do LOD2 (só as principais)
    if (hv !== chaveVis) {
      chaveVis = hv;
      let n = 0;
      formas.forEach((F, f) => {
        const perto = [];
        const longe = [];
        for (const st of vis) {
          const x = st.lod1[f];
          const k = st.modo === 2 ? x.np : x.n;
          if (!k) continue;
          // o LOD1 pela cópia com todas as peças em ordem (ordenarInstancias); o LOD2 só as principais
          const t = st.modo !== 2 && x.todas ? x.todas : x;
          const p = { mat: t.mat, ids: t.ids, bytes: t.bytes, n: k };
          if (st.faixa & 1) perto.push(p);
          if (st.faixa & 2) longe.push(p);
        }
        n += F.vis.compactar(perto);
        if (F.longe) n += F.longe.compactar(longe);
      });
      ctx.stats.instancias.predios = n;
    }
    // projetores de sombra (D43): os setores cuja sombra cai no chão da cascata (ctx.sombra.regiao: o foco que a R1a
    // puxa para baixo da câmera nas vistas rasantes, não o alvo), varridos para longe do sol pela altura do setor;
    // antes do primeiro passe, em volta do alvo da câmera
    const reg = ctx.sombra?.regiao;
    let rx;
    let rz;
    let raio;
    if (reg) {
      rx = reg.x;
      rz = reg.z;
      raio = reg.raio + FOLGA_SOMBRA;
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
    }
    if (hs !== chaveSombra) {
      chaveSombra = hs;
      formas.forEach((F, f) => F.sombra.compactar(somb.map((st) => ({ mat: st.lod1[f].mat, ids: null, bytes: null, n: st.sombraToda ? st.lod1[f].n : st.lod1[f].np }))));
      ctx.sombra.marcar();
    }
    // cache LRU do LOD0 e teto de memória
    const capCache = Math.max(L.cache, quer0);
    if (nLod0 > capCache || bytesLod0 > L.memoriaMB * 1048576 * 0.6) {
      const velhos = [...setores.values()].filter((st) => st.lod0 && st.modo !== 0).sort((a, b) => a.usado - b.usado);
      for (const st of velhos) {
        if (nLod0 <= capCache && bytesLod0 <= L.memoriaMB * 1048576 * 0.6) break;
        soltarLod0(st);
      }
    }
    const S = ctx.stats.setores;
    S.lod0 = lod0Vis;
    S.msEnvio = +msEnvio.toFixed(2);
  }

  /** Hora, noite e o céu de reserva do reflexo. */
  function uniformes(c) {
    uniformesEdificio.gHora.value = c.horaDoCeu();
    const dia = c.sol?.dia ?? 1;
    uniformesEdificio.gNoite.value = Math.min(1, Math.max(0, 1 - dia * 1.25));
    uniformesEdificio.gCeuLigado.value = c.cena.environment ? 0 : 1;
    const hor = c.ganchos.uniformes.gNeblinaCor?.value;
    if (hor) uniformesEdificio.gCeuHor.value.copy(hor);
    const bg = c.cena.background;
    if (bg?.isColor) uniformesEdificio.gCeuZen.value.copy(bg).multiplyScalar(0.85);
    else uniformesEdificio.gCeuZen.value.copy(uniformesEdificio.gCeuHor.value).multiply(new THREE.Color(0.55, 0.68, 0.95));
    uniformesEdificio.gCeuChao.value.copy(uniformesEdificio.gCeuHor.value).multiplyScalar(0.28);
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

  /** Seleção pela caixa de cada prédio (a mesma do plano), sem ler a GPU. */
  function selecionar(raio, esp) {
    const P = esp.predios;
    if (!P) return null;
    const o = raio.origem;
    const dv = raio.dir;
    let melhor = null;
    for (const st of setores.values()) {
      if (!st.lod1 || !st.lista1) continue;
      if (raioNaCaixaAlinhada(o, dv, st.x0 - 40, st.ymin, st.z0 - 40, st.x0 + LADO_SETOR + 40, st.ymax, st.z0 + LADO_SETOR + 40) === null) continue;
      const cx = st.caixas;
      for (let k = 0; k < st.lista1.length; k++) {
        const i = st.lista1[k];
        if (i >= P.n || !P.viva[i]) continue;
        const b = CAIXA * k;
        const t = raioNaCaixaGirada(o, dv, P.x[i], P.y[i], P.z[i], P.rot[i], cx[b], cx[b + 4], cx[b + 1], cx[b + 2], cx[b + 5], cx[b + 3]);
        if (t !== null && (!melhor || t < melhor.dist)) {
          melhor = { tipo: 'predio', idx: i, ref: refDe(i, P.ger[i]), dist: t, ponto: [o[0] + dv[0] * t, o[1] + dv[1] * t, o[2] + dv[2] * t] };
        }
      }
    }
    return melhor;
  }

  function prontoAgora() {
    if (pendentes0 || pendentes1 || recebidos.length) return false;
    for (const st of setores.values()) {
      if (st.lista.length && (!st.lod1 || st.v1 < st.versao)) return false;
      if (st.modo === 0 && st.vis && st.lista.length && (!st.lod0 || st.lod0.versao < st.versao)) return false;
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
      const agora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const t0 = agora();
      ctx.cameraApi?.atualizar?.(t0);
      if (!iniciado) aplicar(ctx.sim.mudancas.desde(-1), ctx.sim.espelho);
      uniformes(ctx);
      while (agora() - t0 < teto) {
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
      for (const st of setores.values()) if (st.lod0?.tris && st.lod0.mesh.visible) tris0 += st.lod0.tris;
      return {
        setores: setores.size, lod0: nLod0, lod0Visiveis: ctx.stats.setores.lod0, instancias: inst, trisLod1: tris1, trisLod0: tris0,
        memoriaLod0MB: +(bytesLod0 / 1048576).toFixed(2), sombra: formas.reduce((a, F) => a + F.sombra.count * F.tris, 0),
      };
    },
    /** Caixa de um prédio no espaço do lote ([x0, z0, x1, z1, y0, y1]) ou null (âncoras, câmera). */
    caixaDoPredio(i) {
      const st = setores.get(setorDe[i]);
      if (!st?.lista1) return null;
      const k = st.lista1.indexOf(i);
      return k < 0 ? null : Array.from(st.caixas.subarray(CAIXA * k, CAIXA * k + 6));
    },
    descartar() {
      for (const f of paraDesligar) f?.();
      for (const st of setores.values()) soltarLod0(st);
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
      tabela.dispose();
      obra.dispose();
      material.dispose();
      materialLonge.dispose();
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
