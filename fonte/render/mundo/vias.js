// Vias (desenho do render 4, D39, D45): troca as faixas da depuração (domínio 'vias').
//   rede      lê o espelho (arestas e nós), classifica cada nó (cruzamento, curva, ponta, reto) e calcula os cortes
//             (cruzamento.js); cada aresta se divide em trechos de até 160 m, cada trecho vai para o setor de 256 m
//             do seu meio, cada nó para o setor dele. Mudou uma aresta: refaz os nós das pontas e os setores tocados
//   setores   malha LOD0 fundida por setor, gerada na oficina (tipo 'vias'), com atributos quantizados; só até o
//             alcance do perfil (Média 560 m do setor), com cache LRU; além disso a via é a pintura do chão (R2a),
//             que perto some (gancho no material do chão por ctx.chao) e longe fica
//   material  `via` (shaders/via.glsl.js): asfalto, marcas, calçada, noite, camada; tabela das arestas na GPU
//             (RGBA8 256²: camada, bits, desgaste) indexada pelo aId
//   seleção   registrarSelecionavel('aresta'): o ponto do chão sob o raio e a aresta mais perto dentro da largura
// Publica em ctx.dominio('vias'): material, tabela, rede (para o tráfego e a luz da rua), setores com os objetos
// (postes, árvores, semáforos, carros estacionados) para props.js e trafego.js, preparar(), pronto(), medidas(),
// geometriaDaMalha() (para a prévia da X2) e a versão da rede.
import * as THREE from 'three';
import { GradeSetores, distCaixa, LADO_SETOR } from './setores.js';
import { oficinaDe } from './oficina.js';
import { analisarNo, gerarSetorVias } from '../geracao/cruzamento.js';
import { perfilVia } from '../geracao/perfilVia.js';
import { BITS, estacao, hashF } from '../geracao/malhaVia.js';
import * as SH from '../materiais/shaders/via.glsl.js';
import { tabelaArco, maisPerto } from '../../comum/bezier.js';
import { ANO } from '../../comum/relogio.js';
import { pontoNoPoligono } from '../../comum/vetor.js';
import { ARESTA, AGUA, MAO } from '../../contratos/flags.js';
import { refDe, idxDaRef, gerDaRef } from '../../contratos/espelho.js';
import { pedeTudo } from '../ponte.js';
import { PRIORIDADE } from '../camera/selecao.js';
import { porPerfil } from '../motor/perfis.js';
import { criarViaduto } from '../vias/viaduto.js';

/**
 * Parâmetros por perfil: alcance da malha (m do setor), faixa de troca com o chão pintado, cache de setores, envios
 * à GPU por quadro, ocupação das vagas de estacionamento (0 sem carros parados).
 */
export const PERFIL_VIAS = Object.freeze({
  ultra: { alcance: 1400, faixa: 260, cache: 96, envios: 3, vagas: 0.6 },
  alta: { alcance: 900, faixa: 200, cache: 64, envios: 2, vagas: 0.55 },
  media: { alcance: 560, faixa: 140, cache: 40, envios: 1, vagas: 0.5 },
  leve: { alcance: 300, faixa: 90, cache: 20, envios: 1, vagas: 0 },
});
/** Trecho máximo de uma aresta num setor (m). */
export const TRECHO = 160;
/** Lado da tabela das arestas na GPU (65.536 vagas, D19). */
export const LADO_TAB = 256;
/** Viés de profundidade: k1 d + k2 d² (m), na faixa de troca com o chão pintado. */
const VIES = Object.freeze({ k1: 0.0003, k2: 1.5e-6 });
/** Tipos que ganham faixa de pedestres e retenção nos cruzamentos. */
const COM_ZEBRA = new Set(['rua', 'ruaMao', 'avenida', 'avenidaG']);

// ------------------------------------------------------------------------------------------------ material

function trocar(src, alvo, novo) {
  if (!src.includes(alvo)) throw new Error(`via: shader sem '${alvo}' (o three mudou?)`);
  return src.replace(alvo, novo);
}

/** Uniformes do material `via` (um objeto só). */
export function criarUniformesVia() {
  return {
    gViaTab: { value: null },
    gViaDetalhe: { value: null },
    gViaLonge: { value: new THREE.Vector4(300, 420, VIES.k1, VIES.k2) },
    gViaCamada: { value: new THREE.Vector4(0, 0, 0, 0) },
    gViaRampa: { value: Array.from({ length: 8 }, () => new THREE.Color()) },
    gViaMascara: { value: 0 },
  };
}

/**
 * Material `via` (desenho do render 9.1): MeshStandardMaterial com as vias no shader e os ganchos comuns (menos a
 * camada: a via pinta a dela).
 */
export function criarMaterialVia(ganchos, U) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 });
  m.name = 'via';
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    let vs = shader.vertexShader;
    vs = trocar(vs, '#include <common>', `#include <common>\n${SH.VIA_VERTICE_PARS}`);
    vs = trocar(vs, '#include <beginnormal_vertex>', SH.VIA_VERTICE_NORMAL);
    vs = trocar(vs, '#include <begin_vertex>', `#include <begin_vertex>\n${SH.VIA_VERTICE_MAIN}`);
    vs = trocar(vs, '#include <project_vertex>', `#include <project_vertex>\n${SH.VIA_VERTICE_VIES}`);
    let fs = shader.fragmentShader;
    fs = trocar(fs, '#include <common>', `#include <common>\n${SH.VIA_FRAGMENTO_PARS}`);
    fs = trocar(fs, '#include <color_fragment>', SH.VIA_FRAGMENTO_COR);
    fs = trocar(fs, '#include <roughnessmap_fragment>', SH.VIA_FRAGMENTO_RUGOSIDADE);
    fs = trocar(fs, '#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${SH.VIA_FRAGMENTO_EMISSIVO}`);
    fs = trocar(fs, '#include <aomap_fragment>', SH.VIA_FRAGMENTO_AO);
    fs = trocar(fs, '#include <dithering_fragment>', SH.VIA_FRAGMENTO_MASCARA);
    shader.vertexShader = vs;
    shader.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => 'via-1';
  m.userData.via = true;
  return ganchos.aplicar(m, ganchos.nomes().filter((n) => n !== 'camada'));
}

/**
 * Geometria do aquecimento do material 'via' (PC3): os mesmos atributos de um setor (geometriaDaMalha), com um
 * triângulo; o three tira do atributo de posição a chave do programa, e o ANGLE, do tipo dos atributos.
 */
export function geometriaAquecerVia() {
  return geometriaDaMalha({
    atributos: {
      posicao: new Int16Array(9), normal: new Int8Array(6), uv: new Float32Array(12), dados: new Uint8Array(12), id: new Uint32Array(3),
    },
    indices: new Uint16Array([0, 1, 2]),
  });
}

// depois do envio à GPU a cópia JS sai; fica o tamanho (medidas.js conta a memória de geometria)
function soltarCopia() {
  this.array = { byteLength: this.array.byteLength, length: this.array.length };
}

/**
 * BufferGeometry de uma malha: a quantizada do setor ({ atributos, indices, escala }) ou a crua de um ConstrutorVia
 * (a prévia da X2, gerarMalhaVia na thread principal). A crua sai em Float32, com a normal octaédrica calculada aqui.
 */
export function geometriaDaMalha(m, { soltar = false } = {}) {
  const g = new THREE.BufferGeometry();
  const at = (arr, k, norm) => {
    const a = new THREE.BufferAttribute(arr, k, norm);
    if (soltar) a.onUpload(soltarCopia);
    return a;
  };
  if (m.atributos) {
    const A = m.atributos;
    g.setAttribute('position', at(A.posicao, 3, true));
    g.setAttribute('normal', at(A.normal, 2, true));
    g.setAttribute('aUV', at(A.uv, 4, false));
    g.setAttribute('aDados', at(A.dados, 4, false));
    g.setAttribute('aId', at(A.id, 1, false));
    g.setIndex(at(m.indices, 1, false));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.sqrt(3) * 1.01);
    g.boundingBox = new THREE.Box3(new THREE.Vector3(-1.01, -1.01, -1.01), new THREE.Vector3(1.01, 1.01, 1.01));
    return g;
  }
  // construtor cru: normais para o octaedro (o shader decodifica sempre o octaedro)
  const nv = m.nv;
  const nor = new Int8Array(nv * 2);
  for (let i = 0; i < nv; i++) {
    const x = m.nor[3 * i];
    const y = m.nor[3 * i + 1];
    const z = m.nor[3 * i + 2];
    const s = Math.abs(x) + Math.abs(y) + Math.abs(z) || 1;
    let px = x / s;
    let py = z / s;
    if (y < 0) {
      const qx = (1 - Math.abs(py)) * (px >= 0 ? 1 : -1);
      const qy = (1 - Math.abs(px)) * (py >= 0 ? 1 : -1);
      px = qx;
      py = qy;
    }
    nor[2 * i] = Math.round(px * 127);
    nor[2 * i + 1] = Math.round(py * 127);
  }
  g.setAttribute('position', new THREE.BufferAttribute(m.pos.slice(0, nv * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 2, true));
  g.setAttribute('aUV', new THREE.BufferAttribute(m.uv.slice(0, nv * 4), 4));
  g.setAttribute('aDados', new THREE.BufferAttribute(m.dados.slice(0, nv * 4), 4));
  g.setAttribute('aId', new THREE.BufferAttribute(m.id.slice(0, nv), 1));
  g.setIndex(new THREE.BufferAttribute(m.idx.slice(0, m.ni), 1));
  g.computeBoundingSphere();
  return g;
}

/** Bit do realce da aresta selecionada no canal G da tabela (o shader soma o brilho, VIA_FRAGMENTO_EMISSIVO). */
export const BIT_REALCE = 1;

/**
 * Troca o realce da tabela das arestas (RGBA8, 4 bytes por aresta): apaga o bit da aresta de antes e acende o da nova
 * (-1: nenhuma). Devolve a nova. Puro (os testes conferem).
 */
export function realcarAresta(dados, antes, nova) {
  const max = dados.length / 4;
  if (antes >= 0 && antes < max) dados[4 * antes + 1] &= ~BIT_REALCE;
  if (nova >= 0 && nova < max) dados[4 * nova + 1] |= BIT_REALCE;
  return nova >= 0 && nova < max ? nova : -1;
}

/** idx da aresta de uma seleção { tipo: 'aresta', ref } viva no espelho, ou -1. */
export function arestaDaSelecao(sel, A) {
  if (!sel || sel.tipo !== 'aresta' || !Number.isFinite(sel.ref) || !A) return -1;
  const i = idxDaRef(sel.ref);
  return i < A.n && A.viva[i] && A.ger[i] === gerDaRef(sel.ref) ? i : -1;
}

// ------------------------------------------------------------------------------------------------ rede

/** Desgaste de uma aresta (0 nova a 1 gasta): as do mapa e da cidade de antes do jogo, pela semente; as novas, pela idade. */
export function desgasteDe(idade, tique, e) {
  if (!idade) return 0.45 + 0.4 * hashF(e, 97);
  const anos = Math.max(0, tique - idade) / ANO;
  return Math.min(1, 0.08 + 0.3 * anos);
}

/** A calçada é de pedra portuguesa? Orla (área nomeada ou a menos de ~250 m do mar) e as vias da Arcologia. */
function pedraEm(esp, x, z, flags) {
  if (flags & ARESTA.ARCOLOGIA) return true;
  for (const a of esp.areas ?? []) if (a.id === 'orla' && a.contorno && pontoNoPoligono(x, z, a.contorno)) return true;
  const T = esp.terreno;
  if (!T?.agua) return false;
  for (let k = 0; k < 12; k++) {
    const ang = (k * Math.PI) / 6;
    for (const r of [120, 250]) {
      const px = x + Math.cos(ang) * r;
      const pz = z + Math.sin(ang) * r;
      const i = Math.round((px - T.origem[0]) / T.passo);
      const j = Math.round((pz - T.origem[1]) / T.passo);
      if (i >= 0 && j >= 0 && i < T.n && j < T.n && T.agua[j * T.n + i] === AGUA.MAR) return true;
    }
  }
  return false;
}

/**
 * Estado da rede a partir do espelho: por aresta { tipo, p, tab, L, a, b, cIni, cFim, marcas, trechos: [[s0, s1,
 * setor]] }, por nó { tipo, setor, analise }. Refeita inteira (tudo) ou em volta das arestas e nós tocados.
 */
export class Rede {
  constructor(grade) {
    this.grade = grade;
    this.arestas = new Map();
    this.nos = new Map();
    this.versao = 0;
  }

  /** Braços de um nó a partir do espelho. */
  bracos(esp, n) {
    const N = esp.vias.nos;
    const out = [];
    for (let k = 0; k < 6; k++) {
      const e = N.lig[6 * n + k];
      if (e < 0) continue;
      const ar = this.arestas.get(e);
      if (!ar) continue;
      out.push({ e, tipo: ar.tipo, p: ar.p, tab: ar.tab, inverte: ar.b === n && ar.a !== n, marcas: ar.pedra ? BITS.PEDRA : 0, ponte: ar.ponte, cotas: ar.cotas });
    }
    return out;
  }

  /** Lê uma aresta do espelho (ou a tira, se morreu). Devolve os setores que ela ocupava. */
  lerAresta(esp, e) {
    const A = esp.vias.arestas;
    const velha = this.arestas.get(e);
    const sujos = new Set(velha ? velha.trechos.map((t) => t[2]) : []);
    if (e >= A.n || !A.viva[e]) {
      this.arestas.delete(e);
      return { sujos, nos: velha ? [velha.a, velha.b] : [] };
    }
    const p = Float64Array.from(A.p.subarray(8 * e, 8 * e + 8));
    const tab = tabelaArco(p);
    const flags = A.flags[e];
    const meio = estacao(p, tab, tab[16] / 2);
    const ar = {
      e, tipo: A.tipo[e], p, tab, L: tab[16], a: A.a[e], b: A.b[e], mao: A.mao[e], flags, idade: A.idade[e], ger: A.ger[e],
      ponte: !!(flags & ARESTA.PONTE), cotas: [A.y[2 * e], A.y[2 * e + 1]], pedra: velha && velha.p.every((v, k) => v === p[k]) ? velha.pedra : pedraEm(esp, meio.x, meio.z, flags),
      cIni: 0, cFim: 0, marcas: 0, trechos: [],
    };
    this.arestas.set(e, ar);
    return { sujos, nos: [ar.a, ar.b, ...(velha ? [velha.a, velha.b] : [])] };
  }

  /** Refaz a análise de um nó e os cortes das suas arestas. Devolve os setores sujos e as arestas tocadas. */
  lerNo(esp, n) {
    const N = esp.vias.nos;
    const velho = this.nos.get(n);
    const sujos = new Set(velho ? [velho.setor] : []);
    if (n >= N.n || !N.viva[n]) {
      this.nos.delete(n);
      return { sujos, arestas: [] };
    }
    const bracos = this.bracos(esp, n);
    const x = N.x[n];
    const z = N.z[n];
    const setor = this.grade.indice(x, z);
    sujos.add(setor);
    if (!bracos.length) {
      this.nos.delete(n);
      return { sujos, arestas: [] };
    }
    const an = analisarNo({ n, x, z, bracos });
    const grauAlto = an.tipo === 'cruzamento' && an.bracos.length >= 3;
    const semaforos = grauAlto && an.bracos.some((b) => b.P.id === 'avenida' || b.P.id === 'avenidaG') && !an.bracos.some((b) => b.P.id === 'rodovia');
    this.nos.set(n, { n, x, z, tipo: an.tipo, setor, analise: an, zebra: grauAlto, semaforos });
    return { sujos, arestas: an.bracos.map((b) => b.e) };
  }

  /** Cortes, marcas e trechos de uma aresta pelos nós das pontas. Devolve os setores dos trechos (novos). */
  fecharAresta(e) {
    const ar = this.arestas.get(e);
    if (!ar) return [];
    const corte = (n, inv) => this.nos.get(n)?.analise.bracos.find((b) => b.e === e && b.inverte === inv)?.corte ?? 0;
    ar.cIni = corte(ar.a, false);
    ar.cFim = corte(ar.b, true);
    const P = perfilVia(ar.tipo);
    let m = ar.pedra ? BITS.PEDRA : 0;
    const noA = this.nos.get(ar.a);
    const noB = this.nos.get(ar.b);
    if (COM_ZEBRA.has(P.id)) {
      // retenção: as faixas que chegam ao nó (físico b para a no início, a para b no fim), no sentido do perfil
      const inA = ar.mao === 0 ? -1 : -ar.mao; // sentido do perfil das faixas que andam para a
      const inB = ar.mao === 0 ? 1 : ar.mao;
      const bitsDe = (s, ini) => (s < 0 ? (ini ? BITS.RET_INI_A : BITS.RET_FIM_A) : ini ? BITS.RET_INI_B : BITS.RET_FIM_B);
      if (noA?.zebra) m |= BITS.ZEBRA_INI | (ar.mao === MAO.AB ? 0 : bitsDe(inA, true));
      if (noB?.zebra) m |= BITS.ZEBRA_FIM | (ar.mao === MAO.BA ? 0 : bitsDe(inB, false));
    }
    ar.marcas = m;
    ar.tampaIni = noA?.tipo === 'cruzamento';
    ar.tampaFim = noB?.tipo === 'cruzamento';
    // trechos de até TRECHO m, cada um no setor do seu meio
    const s0 = ar.cIni;
    const s1 = ar.L - ar.cFim;
    const n = Math.max(1, Math.ceil((s1 - s0) / TRECHO));
    ar.trechos = [];
    const est = { x: 0, z: 0, tx: 1, tz: 0, t: 0 };
    for (let k = 0; k < n; k++) {
      const a = s0 + ((s1 - s0) * k) / n;
      const b = s0 + ((s1 - s0) * (k + 1)) / n;
      estacao(ar.p, ar.tab, (a + b) / 2, est);
      ar.trechos.push([a, b, this.grade.indice(est.x, est.z)]);
    }
    return ar.trechos.map((t) => t[2]);
  }

  /** Relê tudo. Devolve todos os setores com via. */
  tudo(esp) {
    const A = esp.vias?.arestas;
    const N = esp.vias?.nos;
    const antes = new Set([...this.arestas.values()].flatMap((a) => a.trechos.map((t) => t[2])));
    for (const n of this.nos.values()) antes.add(n.setor);
    this.arestas.clear();
    this.nos.clear();
    if (!A || !N) return antes;
    for (let e = 0; e < A.n; e++) if (A.viva[e]) this.lerAresta(esp, e);
    for (let n = 0; n < N.n; n++) if (N.viva[n]) this.lerNo(esp, n);
    for (const e of this.arestas.keys()) for (const s of this.fecharAresta(e)) antes.add(s);
    for (const n of this.nos.values()) antes.add(n.setor);
    this.versao++;
    return antes;
  }

  /** Aplica as arestas e os nós tocados. Devolve os setores sujos. */
  tocar(esp, arestas, nos) {
    const sujos = new Set();
    const nosT = new Set(nos);
    for (const e of arestas) {
      const r = this.lerAresta(esp, e);
      for (const s of r.sujos) sujos.add(s);
      for (const n of r.nos) nosT.add(n);
    }
    const arT = new Set();
    for (const n of nosT) {
      const r = this.lerNo(esp, n);
      for (const s of r.sujos) sujos.add(s);
      for (const e of r.arestas) arT.add(e);
    }
    for (const e of arestas) arT.add(e);
    for (const e of arT) {
      const ar = this.arestas.get(e);
      if (!ar) continue;
      for (const t of ar.trechos) sujos.add(t[2]);
      for (const s of this.fecharAresta(e)) sujos.add(s);
    }
    this.versao++;
    return sujos;
  }
}

// ------------------------------------------------------------------------------------------------ chão

/** A leitura do uso do solo no fragmento do chão (R2a), com ou sem os espaços que a montagem tira do GLSL. */
export const ALVO_USO_CHAO = /vec4\s+tUso\s*=\s*texture\s*\(\s*uTerUso\s*,\s*tUVM\s*\)\s*;/;

/**
 * Fragmento do chão com o canal da via do uso do solo apagado perto da câmera (vTer.z é a distância à câmera), ou
 * null se o chão não tem a leitura esperada.
 */
export function ligarChaoNoShader(fs) {
  if (!ALVO_USO_CHAO.test(fs) || !fs.includes('#include <common>')) return null;
  return fs
    .replace('#include <common>', '#include <common>\nuniform vec2 uViaPerto;')
    .replace(ALVO_USO_CHAO, (m) => `${m}\ntUso.r *= smoothstep( uViaPerto.x, uViaPerto.y, vTer.z );`);
}

/**
 * Perto da câmera a malha desenha a via: a pintura do asfalto no uso do solo (R2a, raster de 4 m que alarga a pista
 * uns 2 m) some ali. Gancho no material do chão por ctx.chao (sem editar o terreno): multiplica o canal da via do
 * uso do solo pela distância. Devolve os uniformes (ou null se o chão não é o da R2a).
 */
function ligarChao(ctx) {
  const mat = ctx.chao?.malha?.material;
  if (!mat || mat.userData.viaLigada) return mat?.userData.viaUniformes ?? null;
  const U = { uViaPerto: { value: new THREE.Vector2(0, 1) } };
  const antes = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    antes?.call(mat, shader, renderer);
    const fs = ligarChaoNoShader(shader.fragmentShader);
    if (!fs) {
      console.warn('vias: o chão não tem o uso do solo esperado; a pintura da via fica perto da câmera');
      return;
    }
    Object.assign(shader.uniforms, U);
    shader.fragmentShader = fs;
  };
  const chave = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => `${chave ? chave() : ''}|viaPerto`;
  mat.userData.viaLigada = true;
  mat.userData.viaUniformes = U;
  mat.needsUpdate = true;
  return U;
}

// ------------------------------------------------------------------------------------------------ pedidos

const EST = { x: 0, z: 0, tx: 1, tz: 0, t: 0 };
const agora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Retalho da grade do chão que cobre o retângulo (alinhado às amostras). */
export function retalho(T, x0, z0, x1, z1) {
  const i0 = Math.max(0, Math.floor((x0 - T.origem[0]) / T.passo));
  const j0 = Math.max(0, Math.floor((z0 - T.origem[1]) / T.passo));
  const i1 = Math.min(T.n - 1, Math.ceil((x1 - T.origem[0]) / T.passo));
  const j1 = Math.min(T.n - 1, Math.ceil((z1 - T.origem[1]) / T.passo));
  const n = Math.max(2, Math.max(i1 - i0, j1 - j0) + 1);
  const altura = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    const jj = Math.min(T.n - 1, j0 + j);
    for (let i = 0; i < n; i++) altura[j * n + i] = T.altura[jj * T.n + Math.min(T.n - 1, i0 + i)];
  }
  return { ox: T.origem[0] + i0 * T.passo, oz: T.origem[1] + j0 * T.passo, n, passo: T.passo, altura };
}

/**
 * Pedido de um setor à oficina (tipo 'vias'): os trechos das arestas e os nós que caem nele e o retalho do chão que os
 * cobre. Puro sobre a rede (a thread principal e os testes montam igual).
 * @param {Rede} rede
 * @param {{ s: number, x0: number, z0: number, versao: number }} st
 * @returns {{ dados: object, transferir: ArrayBuffer[] }}
 */
export function pedidoDeSetor(rede, st, esp, vagas = 0) {
  const arestas = [];
  let x0 = st.x0;
  let z0 = st.z0;
  let x1 = st.x0 + LADO_SETOR;
  let z1 = st.z0 + LADO_SETOR;
  for (const ar of rede.arestas.values()) {
    for (const [a, b, s] of ar.trechos) {
      if (s !== st.s) continue;
      arestas.push({
        e: ar.e, tipo: ar.tipo, p: Array.from(ar.p), sIni: ar.cIni, sFim: ar.L - ar.cFim, s0: a, s1: b, marcas: ar.marcas, ponte: ar.ponte,
        cotas: ar.cotas, tampaIni: ar.tampaIni, tampaFim: ar.tampaFim, mao: ar.mao,
      });
      // o chão do trecho (não da aresta inteira: uma rodovia de 2 km mandaria o retalho de 2 km a cada setor), pelas
      // estações a cada 8 m e a meia largura com folga
      const m = perfilVia(ar.tipo).meia + 4;
      const n = Math.max(2, Math.ceil((b - a) / 8) + 1);
      for (let k = 0; k < n; k++) {
        estacao(ar.p, ar.tab, a + ((b - a) * k) / (n - 1), EST);
        x0 = Math.min(x0, EST.x - m);
        x1 = Math.max(x1, EST.x + m);
        z0 = Math.min(z0, EST.z - m);
        z1 = Math.max(z1, EST.z + m);
      }
    }
  }
  const nos = [];
  for (const no of rede.nos.values()) {
    if (no.setor !== st.s || no.tipo === 'reto') continue;
    nos.push({
      n: no.n, x: no.x, z: no.z, semaforos: no.semaforos,
      bracos: no.analise.bracos.map((b) => ({ e: b.e, tipo: b.tipo, p: Array.from(b.p), inverte: b.inverte, marcas: b.marcas, ponte: b.ponte, cotas: b.cotas })),
    });
    // a peça do nó vai até o corte de cada braço mais a meia largura (a curva de avenida grande passa de 80 m)
    const r = Math.max(60, ...no.analise.bracos.map((b) => b.corte + b.P.meia + 4));
    x0 = Math.min(x0, no.x - r);
    x1 = Math.max(x1, no.x + r);
    z0 = Math.min(z0, no.z - r);
    z1 = Math.max(z1, no.z + r);
  }
  const T = esp.terreno;
  const chaoR = T ? retalho(T, x0 - 16, z0 - 16, x1 + 16, z1 + 16) : null;
  return {
    dados: { setor: st.s, versao: st.versao, ox: st.x0, oz: st.z0, chao: chaoR, arestas, nos, vagas },
    transferir: chaoR ? [chaoR.altura.buffer] : [],
  };
}

// ------------------------------------------------------------------------------------------------ domínio

function criarVias(ctx) {
  const { cena, medidas } = ctx;
  const esp0 = ctx.sim.espelho;
  const grade = new GradeSetores({ tam: esp0.mapa?.tam ?? 8192, origem: esp0.mapa?.origem ?? [-4096, -4096] });
  const oficina = oficinaDe(ctx);
  const rede = new Rede(grade);
  const U = criarUniformesVia();
  U.gViaDetalhe.value = ctx.textura('via.detalhe');
  const dadosTab = new Uint8Array(LADO_TAB * LADO_TAB * 4);
  const tabela = new THREE.DataTexture(dadosTab, LADO_TAB, LADO_TAB, THREE.RGBAFormat, THREE.UnsignedByteType);
  tabela.magFilter = tabela.minFilter = THREE.NearestFilter;
  tabela.generateMipmaps = false;
  tabela.name = 'vias:tabela';
  U.gViaTab.value = tabela;
  const mascara = typeof location !== 'undefined' && new URLSearchParams(location.search).get('passe') === 'mascara';
  U.gViaMascara.value = mascara ? 1 : 0;
  const material = criarMaterialVia(ctx.ganchos, U);
  // aquecimento (D66, PC3): o programa 'via' compila na carga mesmo sem nenhuma via no alcance da câmera (a abertura
  // do jogo vê o mapa de 2 km de altura: sem isto ele compilava ao chegar perto da Vila ou na primeira via construída)
  const aquecerVia = new THREE.Mesh(geometriaAquecerVia(), material);
  aquecerVia.name = 'vias:aquecer';
  aquecerVia.receiveShadow = true;
  ctx.quadro?.aquecer?.add?.(aquecerVia);
  let chao = ligarChao(ctx);

  // pilares, viga e guarda-corpo das pontes e viadutos (PONT2, D106): uma malha só
  const viaduto = criarViaduto(ctx, rede);
  const setores = new Map();
  const recebidos = [];
  /** A aresta realçada (idx, -1 nenhuma) e a última seleção do evento 'selecao' ({ tipo, ref } ou null). */
  let realcada = -1;
  let selecao = null;
  let pendentes = 0;
  let iniciado = false;
  let quadros = 0;
  let bytes = 0;
  let nMalhas = 0;
  let versaoObjetos = 0;
  let msPedidos = 0;
  let nPedidos = 0;
  let mesTabela = null;
  const frustum = new THREE.Frustum();
  const mProj = new THREE.Matrix4();
  const caixa = new THREE.Box3();

  const perfil = () => porPerfil(PERFIL_VIAS, ctx.perfil);
  const setorPara = (s) => {
    let st = setores.get(s);
    if (!st) {
      const [x0, z0] = grade.canto(s);
      st = { s, x0, z0, versao: 1, pedido: 0, malha: null, objetos: null, estacionados: null, usado: 0, dist: Infinity, ymin: -5, ymax: 60, caixa: null };
      setores.set(s, st);
    }
    return st;
  };
  const sujar = (lista) => {
    for (const s of lista) if (s >= 0) setorPara(s).versao++;
  };

  function escreverTabela(esp, e) {
    if (e >= LADO_TAB * LADO_TAB) return;
    const ar = rede.arestas.get(e);
    const k = 4 * e;
    dadosTab[k + 2] = ar ? Math.round(desgasteDe(ar.idade, esp.tempo?.tique ?? 0, e) * 255) : 0;
    tabela.needsUpdate = true;
  }

  function aplicar(d, esp) {
    const A = esp.vias?.arestas;
    if (!A || !esp.vias?.nos) return;
    // a aresta realçada morreu (ou a vaga foi reaproveitada): apaga o realce
    if (realcada >= 0 && arestaDaSelecao(selecao, A) !== realcada) {
      realcada = realcarAresta(dadosTab, realcada, arestaDaSelecao(selecao, A));
      tabela.needsUpdate = true;
    }
    const tudo = !iniciado || pedeTudo(d, 'vias') || pedeTudo(d, 'arestas') || pedeTudo(d, 'nos');
    iniciado = true;
    if (tudo) {
      sujar(rede.tudo(esp));
      for (let e = 0; e < Math.min(A.cap, LADO_TAB * LADO_TAB); e++) escreverTabela(esp, e);
    } else if (d.arestas?.length || d.nos?.length) {
      sujar(rede.tocar(esp, d.arestas ?? [], d.nos ?? []));
      for (const e of d.arestas ?? []) escreverTabela(esp, e);
    }
    // o asfalto envelhece com o jogo (a idade da aresta): a coluna do desgaste é reescrita a cada mês de jogo
    const mes = esp.tempo ? (esp.tempo.ano ?? 0) * 12 + (esp.tempo.mes ?? 0) : null;
    if (mes !== mesTabela) {
      if (mesTabela !== null && !tudo) for (const e of rede.arestas.keys()) escreverTabela(esp, e);
      mesTabela = mes;
    }
    // o chão mudou (aplainar de uma via nova, obra): os setores sobre o retângulo refazem as cotas
    const rets = pedeTudo(d, 'terreno') ? [[-1e9, -1e9, 1e9, 1e9]] : d.terreno ?? [];
    if (rets.length && !tudo) {
      for (const st of setores.values()) {
        const x1 = st.x0 + LADO_SETOR;
        const z1 = st.z0 + LADO_SETOR;
        if (rets.some((r) => r[0] <= x1 + 100 && r[2] >= st.x0 - 100 && r[1] <= z1 + 100 && r[3] >= st.z0 - 100)) st.versao++;
      }
    }
  }

  // ---------------------------------------------------------------------------------------------- pedidos

  const pedidoDoSetor = (st) => pedidoDeSetor(rede, st, ctx.sim.espelho, perfil().vagas);

  function pedir(st) {
    const versao = st.versao;
    st.pedido = versao;
    pendentes++;
    const { dados, transferir } = pedidoDoSetor(st);
    if (!dados.arestas.length && !dados.nos.length) {
      pendentes--;
      recebidos.push({ st, r: { malhas: [], objetos: null, estacionados: [] }, versao });
      return;
    }
    // o gerador não tem relógio (render/geracao): mede-se aqui, do pedido à resposta (com a fila do worker)
    const t0 = agora();
    oficina.pedir('vias', dados, { chave: st.s, transferir }).then((r) => {
      pendentes--;
      msPedidos += agora() - t0;
      nPedidos++;
      recebidos.push({ st, r, versao });
    });
  }

  function soltarMalha(st) {
    if (!st.malha) return;
    cena.remove(st.malha.mesh);
    st.malha.mesh.geometry.dispose();
    bytes -= st.malha.bytes;
    nMalhas--;
    st.malha = null;
  }

  function receber(max) {
    let feitos = 0;
    for (let k = 0; k < recebidos.length; ) {
      const { st, r, versao } = recebidos[k];
      if (r.erro) {
        // o gerador falhou nesta versão: não pede de novo a cada quadro (a oficina já avisou no console); volta a
        // pedir quando o setor mudar
        st.erro = versao;
        recebidos.splice(k, 1);
        continue;
      }
      if (feitos >= max) break;
      recebidos.splice(k, 1);
      if (st.malha && st.malha.versao > versao) continue;
      soltarMalha(st);
      const m = r.malhas?.[0];
      st.objetos = r.objetos ?? null;
      st.estacionados = r.estacionados ?? [];
      versaoObjetos++;
      if (!m) {
        st.malha = { mesh: new THREE.Object3D(), versao, bytes: 0, tris: 0 };
        nMalhas++;
        continue;
      }
      const g = geometriaDaMalha(m, { soltar: true });
      const mesh = new THREE.Mesh(g, material);
      const [cx, cy, cz, s] = m.escala;
      mesh.position.set(st.x0 + cx, cy, st.z0 + cz);
      mesh.scale.setScalar(s);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.name = `vias:${st.s}`;
      mesh.receiveShadow = true;
      medidas.familia(mesh, 'vias');
      cena.add(mesh);
      let b = m.indices.byteLength;
      for (const a of Object.values(m.atributos)) b += a.byteLength;
      st.malha = { mesh, versao, bytes: b, tris: m.tris };
      st.ymin = st.y0 = m.caixa[1];
      st.ymax = m.caixa[4];
      st.caixa = [st.x0 + m.caixa[0], m.caixa[1], st.z0 + m.caixa[2], st.x0 + m.caixa[3], m.caixa[4], st.z0 + m.caixa[5]];
      bytes += b;
      nMalhas++;
      feitos++;
    }
  }

  // ---------------------------------------------------------------------------------------------- quadro

  function passo({ envios = perfil().envios, pedidos = oficina.worker ? 3 : 1 } = {}) {
    quadros++;
    receber(envios);
    const L = perfil();
    const cam = ctx.camera;
    cam.updateMatrixWorld();
    mProj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    frustum.setFromProjectionMatrix(mProj);
    const cp = cam.position;
    const cand = [];
    let vis = 0;
    let tris = 0;
    for (const st of setores.values()) {
      const c = st.caixa ?? [st.x0, st.ymin, st.z0, st.x0 + LADO_SETOR, st.ymax, st.z0 + LADO_SETOR];
      st.dist = distCaixa(cp.x, cp.y, cp.z, c[0], c[1], c[2], c[3], c[4], c[5]);
      const perto = st.dist < L.alcance;
      if (perto && st.pedido !== st.versao && st.erro !== st.versao && (!st.malha || st.malha.versao < st.versao)) cand.push(st);
      if (st.malha) {
        caixa.min.set(c[0], c[1] - 1, c[2]);
        caixa.max.set(c[3], c[4] + 1, c[5]);
        const mostra = perto && frustum.intersectsBox(caixa);
        st.malha.mesh.visible = mostra;
        if (perto) st.usado = quadros;
        if (mostra) {
          vis++;
          tris += st.malha.tris;
        }
      }
    }
    cand.sort((a, b) => a.dist - b.dist);
    for (const st of cand) {
      if (pendentes >= pedidos) break;
      pedir(st);
    }
    // cache: solta os mais velhos fora do alcance
    if (nMalhas > L.cache) {
      const velhos = [...setores.values()].filter((st) => st.malha && st.dist >= L.alcance).sort((a, b) => a.usado - b.usado);
      for (const st of velhos) {
        if (nMalhas <= L.cache) break;
        soltarMalha(st);
        st.objetos = null;
        st.estacionados = null;
        st.pedido = 0;
        versaoObjetos++;
      }
    }
    return { vis, tris };
  }

  /** Distâncias de troca com o chão pintado (a luz da rua à noite vem do gancho `noite`, luzRua.js). */
  function uniformes() {
    const L = perfil();
    const fim = L.alcance - L.faixa;
    U.gViaLonge.value.set(fim - 160, fim, VIES.k1, VIES.k2);
    if (chao) chao.uViaPerto.value.set(fim - 120, fim - 40);
  }

  const paraDesligar = [
    // a troca de qualidade refaz o material do chão (terreno.js ouve antes): liga o gancho no novo
    ctx.ouvir('qualidade', () => {
      chao = ligarChao(ctx);
    }),
    // realce da aresta selecionada (bit G da tabela) pelo evento 'selecao' do render: { tipo: 'aresta', ref }
    ctx.ouvir('selecao', (sel) => {
      selecao = sel ?? null;
      realcada = realcarAresta(dadosTab, realcada, arestaDaSelecao(selecao, ctx.sim.espelho.vias?.arestas));
      tabela.needsUpdate = true;
    }),
    // camadas por aresta (X3a): o valor no canal R da tabela; qualquer camada deixa a via neutra
    ctx.ouvir('camadas', (c) => {
      const A = ctx.sim.espelho.vias?.arestas;
      const liga = !!(c && c.fonte === 'arestas' && c.dados && A);
      const n = A ? Math.min(A.n, LADO_TAB * LADO_TAB) : 0;
      for (let e = 0; e < LADO_TAB * LADO_TAB; e++) {
        let v = 0;
        if (liga && e < n) {
          const x = c.dados[e];
          if (Number.isFinite(x)) v = c.categorico ? Math.max(0, Math.min(7, Math.round(x))) : 1 + Math.round(Math.min(1, Math.max(0, (x - (c.min ?? 0)) / ((c.max ?? 1) - (c.min ?? 0) || 1))) * 254);
        }
        dadosTab[4 * e] = v;
      }
      tabela.needsUpdate = true;
      U.gViaCamada.value.set(c ? 1 : 0, Math.min(8, c?.cores?.length ?? 0), c?.categorico ? 1 : 0, 0);
      (c?.cores ?? []).slice(0, 8).forEach((h, k) => U.gViaRampa.value[k].set(h).convertSRGBToLinear());
    }),
  ];

  /** Seleção: o ponto do chão sob o raio e a aresta viva mais perto, dentro da largura. */
  function selecionar(raio, c) {
    const esp = c.sim.espelho;
    const A = esp.vias?.arestas;
    if (!A) return null;
    const p = Number.isFinite(raio.xTela) ? c.raio(raio.xTela, raio.yTela) : null;
    if (!p) return null;
    const mp = { t: 0, d: 0, x: 0, z: 0 };
    let melhor = null;
    for (const ar of rede.arestas.values()) {
      const P = perfilVia(ar.tipo);
      // caixa rápida pelos pontos de controle
      let x0 = Infinity;
      let x1 = -Infinity;
      let z0 = Infinity;
      let z1 = -Infinity;
      for (let k = 0; k < 4; k++) {
        x0 = Math.min(x0, ar.p[2 * k]);
        x1 = Math.max(x1, ar.p[2 * k]);
        z0 = Math.min(z0, ar.p[2 * k + 1]);
        z1 = Math.max(z1, ar.p[2 * k + 1]);
      }
      if (p[0] < x0 - P.meia || p[0] > x1 + P.meia || p[2] < z0 - P.meia || p[2] > z1 + P.meia) continue;
      maisPerto(ar.p, p[0], p[2], 0, mp);
      if (mp.d <= P.meia + 0.3 && (!melhor || mp.d < melhor.d)) melhor = { e: ar.e, d: mp.d };
    }
    if (!melhor) return null;
    const o = raio.origem;
    return { tipo: 'aresta', idx: melhor.e, ref: refDe(melhor.e, A.ger[melhor.e]), ponto: p, dist: Math.hypot(p[0] - o[0], p[1] - o[1], p[2] - o[2]) };
  }

  function prontoAgora() {
    if (pendentes || recebidos.length) return false;
    const L = perfil();
    for (const st of setores.values()) if (st.dist < L.alcance && st.erro !== st.versao && (!st.malha || st.malha.versao < st.versao)) return false;
    return true;
  }

  const dom = {
    nome: 'vias',
    material,
    tabela,
    uniformes: U,
    rede,
    grade,
    aplicar,
    viaduto,
    quadro(tMs, c) {
      uniformes(c);
      passo();
      viaduto.quadro(tMs);
    },
    selecionar,
    pronto: prontoAgora,
    /** Versão dos objetos da rua dos setores (props e carros estacionados recompactam quando muda). */
    get versaoObjetos() {
      return versaoObjetos;
    },
    /** Setores com malha perto (dentro do alcance): { s, dist, objetos, estacionados }. */
    *setoresPerto(max = Infinity) {
      for (const st of setores.values()) if (st.malha && st.objetos && st.dist < max) yield st;
    },
    /** Para as cenas e capturas: lê o espelho e espera a oficina entregar os setores da vista. */
    async preparar({ teto = 120000 } = {}) {
      const t0 = agora();
      ctx.cameraApi?.atualizar?.(t0);
      if (!iniciado) aplicar(ctx.sim.mudancas.desde(-1), ctx.sim.espelho);
      uniformes(ctx);
      while (agora() - t0 < teto) {
        passo({ envios: 64, pedidos: oficina.worker ? 6 : 2 });
        if (prontoAgora()) break;
        if (oficina.worker) await new Promise((ok) => setTimeout(ok, 20));
        else {
          oficina.rodarLocal(4);
          await Promise.resolve();
        }
      }
      passo({ envios: 64 });
      return dom.medidas();
    },
    medidas() {
      let vis = 0;
      let tris = 0;
      for (const st of setores.values()) {
        if (st.malha?.mesh.visible) {
          vis++;
          tris += st.malha.tris;
        }
      }
      return {
        setores: setores.size, malhas: nMalhas, visiveis: vis, tris, memoriaMB: +(bytes / 1048576).toFixed(2),
        arestas: rede.arestas.size, nos: rede.nos.size, msPedidoMedio: nPedidos ? +(msPedidos / nPedidos).toFixed(1) : 0,
      };
    },
    /** Gera um setor na hora, na thread principal (testes e depuração). */
    gerarAgora(s) {
      return gerarSetorVias(pedidoDoSetor(setorPara(s)).dados);
    },
    descartar() {
      for (const f of paraDesligar) f?.();
      ctx.quadro?.aquecer?.delete?.(aquecerVia);
      viaduto.descartar();
      aquecerVia.geometry.dispose();
      for (const st of setores.values()) soltarMalha(st);
      tabela.dispose();
      material.dispose();
    },
  };
  return dom;
}

export function registrar(api) {
  api.registrarDominio('vias', criarVias);
  api.registrarSelecionavel('aresta', (raio, ctx) => ctx.dominio('vias')?.selecionar?.(raio, ctx) ?? null, { prioridade: PRIORIDADE.mundo });
}
