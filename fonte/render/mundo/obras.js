// Obras da cidade (desenho do render 12.1, 2.4, D76, D102; R4b e OBR2): as fases à CS2 andam na GPU, pelo uniforme de
// tique (gTique = tique + frac do espelho) sobre a textura de início e fim da obra (predios.js), sem envio por quadro.
// Aqui ficam as peças em volta do prédio cortado no vértice (fachada.glsl.js), cada classe de obra com a sua sequência:
//   canteiro    tapume de chapa em volta do lote com a placa da obra, contêiner, caçamba e pilhas de material (o chão
//               de terra é do terreno, pela bandeira OBRA); a escavadeira cava e despeja no monte de terra, que o
//               caminhão basculante leva; operários andam pelo lote; a poeira sobe da cava e do caminhão
//   fundação    a perfuratriz anda em zigue-zague pela malha e a armação de cada estaca aparece quando ela passa (nos
//               prédios maiores); a laje sobe até 0,3 m e o caminhão betoneira chega, descarrega e sai
//   estrutura   o esqueleto de concreto (pilares e lajes por andar) sobe até a altura do prédio; o núcleo sobe à frente
//               em ciclos de 4 m e, nos altos, a fôrma trepante e a plataforma sobem com ele; operários e faíscas de
//               solda no último andar; prédio alto (mais de 14 m) com grua de torre que pega no canteiro, sobe, gira e
//               assenta a carga, prédio baixo com grua móvel e andaime
//   fechamento  a fachada sobe andar por andar (módulos de 3 m, no gancho da grua) atrás do esqueleto, com a tela entre a
//               fachada e o topo; no acabamento, o balancim desce pela fachada
//   fecho       quando a obra acaba, o canteiro se desmonta (tapume e contêineres descem, os caminhões saem), a bandeirola
//               sobe no topo e um brilho de faíscas se apaga: 16 tiques, só do que a obra tinha desenhado
// A classe vem da altura: casa (até 6 m), prédio baixo (até 14 m), torre (acima) e serviço (colocável, sem plano, com o
// volume da pegada). A reforma de subir de nível (OBRA_NIVEL) não corta o prédio: tela ou andaime em volta, a grua se for
// alto, dois operários e o brilho no fim.
// Três chamadas (caixas, cascas e gruas) e dois projetores na sombra própria (caixas, com a massa do prédio até a
// altura pronta, e gruas); as instâncias só mudam quando uma obra começa, acaba ou troca de fase (ou a câmera anda muito).
// A poeira e as faíscas são billboards da própria caixa (duas faces, alfa por cobertura), nenhuma chamada a mais. Os
// shaders (materiais/shaders/obra.glsl.js) vêm sob demanda; as peças (pecasDaObra, puro) e as listas ficam aqui.
import * as THREE from 'three';
import { PREDIO, TIPO_PREDIO } from '../../contratos/flags.js';
import { FASES_OBRA, progressoObra } from '../../contratos/espelho.js';
import { porPerfil } from '../motor/perfis.js';
import { pedeTudo } from '../ponte.js';
import { uniformesEdificio } from './predios.js';
import { COLOCAVEIS, tipoColocavel } from '../../data/colocaveis.js';

/** Tipos das caixas (aObra.y) e das cascas. */
export const PECA = Object.freeze({
  PILAR: 0, LAJE: 1, CONTEINER: 2, PILHA: 3, BETONEIRA: 4, TAPUME: 5, MASSA: 6,
  ESTACA: 7, OPERARIO: 8, OPERARIO_ALTO: 9, NUCLEO: 10, FORMA: 11, POEIRA: 12, FAISCA: 13, BANDEIRA: 14, MONTE: 15,
  BASCULANTE: 16, BALANCIM: 17,
});
/** Somado ao tipo da peça no aObra.y: a peça do fecho da obra (o aAux.x leva o tique em que a obra acabou). */
export const FECHO = Object.freeze({ deslocamento: 32, tiques: 16 });
/** Modelos da instância de máquina (aObra.y da lista de gruas). */
export const MODELO = Object.freeze({ TORRE: 0, MOVEL: 1, ESCAVADEIRA: 2, PERFURATRIZ: 3 });
export const CASCA = Object.freeze({ ANDAIME: 0, TELA: 1 });
/** Prédio alto (grua de torre e tela) acima desta altura em metros; abaixo, grua móvel e andaime. */
export const ALTO = 14;
/** Obras novas (peças e blocos feitos) por quadro; as outras entram nos quadros seguintes. */
export const NOVAS_POR_QUADRO = 12;
/** Alcance das obras desenhadas (m do alvo da câmera) e o teto de obras por perfil. */
export const PERFIL_OBRAS = Object.freeze({
  ultra: { alcance: 2600, max: 300 },
  alta: { alcance: 2000, max: 200 },
  media: { alcance: 1200, max: 80 },
  leve: { alcance: 600, max: 30 },
});

// ------------------------------------------------------------------------------------------------ geometria

/** Construtor de malha com atributos extras por vértice (puro, só arrays). */
class Geo {
  constructor(extras = {}) {
    this.pos = [];
    this.nor = [];
    this.idx = [];
    this.extras = Object.fromEntries(Object.entries(extras).map(([k, n]) => [k, { n, v: [] }]));
  }

  /** Caixa de (x0, y0, z0) a (x1, y1, z1); faces: 'todas', 'paredes' ou 'semFundo'; ex: valores extras por vértice. */
  caixa(x0, y0, z0, x1, y1, z1, ex = {}, faces = 'todas') {
    const F = [
      [[1, 0, 0], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], 'z'],
      [[-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], 'z'],
      [[0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], 'x'],
      [[0, 0, -1], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], 'x'],
    ];
    if (faces !== 'paredes') F.push([[0, 1, 0], [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], 'x']);
    if (faces === 'todas') F.push([[0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], 'x']);
    for (const [n, q] of F) {
      const b = this.pos.length / 3;
      for (const p of q) {
        this.pos.push(...p);
        this.nor.push(...n);
        for (const [k, e] of Object.entries(this.extras)) {
          const v = typeof ex[k] === 'function' ? ex[k](p, n) : ex[k] ?? new Array(e.n).fill(0);
          e.v.push(...(Array.isArray(v) ? v : [v]));
        }
      }
      this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }

  geometria() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    for (const [k, e] of Object.entries(this.extras)) g.setAttribute(k, new THREE.Float32BufferAttribute(e.v, e.n));
    g.setIndex(this.idx);
    return { g, tris: this.idx.length / 3 };
  }
}

/** Caixa unitária (base em y = 0, topo em 1, x e z em [-0,5, 0,5]). */
export function geometriaCaixa() {
  const G = new Geo();
  G.caixa(-0.5, 0, -0.5, 0.5, 1, 0.5);
  return G.geometria();
}

/** Casca unitária: só as quatro paredes (o andaime e a tela). */
export function geometriaCasca() {
  const G = new Geo();
  G.caixa(-0.5, 0, -0.5, 0.5, 1, 0.5, {}, 'paredes');
  return G.geometria();
}

/** Partes da grua (aParte) e as classes de cor (aTrel.w). */
export const PARTE_GRUA = Object.freeze({
  MASTRO: 0, TOPO: 1, LANCA: 2, CABO: 3, CARGA: 4, CHASSI: 5, BRACO: 6,
  ESTEIRA: 7, CORPO: 8, LANCA_E: 9, BRACO_E: 10, CACAMBA: 11, MASTRO_P: 12, CABECA: 13, BROCA: 14,
});
const COR = { ESTRUTURA: 0, CONCRETO: 1, CABINE: 2, CABO: 4, CARGA: 5, ESTEIRA: 7, AMARELO: 8, VIDRO: 9 };

/**
 * Grua de torre (aModelo 0) e grua móvel sobre caminhão (aModelo 1) numa geometria só (a instância escolhe o modelo).
 * Medidas de uma grua de topo de 1,6 m de mastro (Liebherr 150 EC-B): lança de comprimento L (a instância escala o x
 * da LANCA), contra-lança de 12 m com o contrapeso, torre de topo, cabine; o mastro tem altura 1 (a obra escala) e o
 * cabo tem altura 1 para baixo. aTrel: [través (m), meia largura, treliça (0/1), classe de cor].
 */
export function geometriaGrua() {
  const G = new Geo({ aParte: 1, aModelo: 1, aTrel: 4 });
  const trav = (eixo) => (p, n) => (eixo === 'x' ? (Math.abs(n[2]) > 0.5 ? p[1] : p[2]) : Math.abs(n[0]) > 0.5 ? p[2] : p[0]);
  const caixa = (x0, y0, z0, x1, y1, z1, parte, modelo, { trel = 0, cor = COR.ESTRUTURA, eixo = 'y', meia = 0.8, centro = [0, 0] } = {}) => {
    G.caixa(x0, y0, z0, x1, y1, z1, {
      aParte: parte,
      aModelo: modelo,
      aTrel: (p, n) => [trav(eixo)(p, n) - (eixo === 'x' ? (Math.abs(n[2]) > 0.5 ? centro[0] : centro[1]) : 0), meia, trel ? (eixo === 'x' ? 2 : 1) : 0, cor],
    });
  };
  const carga = (modelo) => {
    caixa(-1.1, -3.3, -0.6, 1.1, -1.9, 0.6, PARTE_GRUA.CARGA, modelo, { cor: COR.CARGA });
    for (const sx of [-0.7, 0.7]) caixa(sx - 0.03, -1.9, -0.03, sx + 0.03, -1.4, 0.03, PARTE_GRUA.CARGA, modelo, { cor: COR.CABO });
  };
  // torre: mastro (y de 0 a 1), torre de topo, lança (x de 0 a 1), contra-lança, contrapeso, cabine, cabo
  caixa(-0.8, 0, -0.8, 0.8, 1, 0.8, PARTE_GRUA.MASTRO, 0, { trel: 1, meia: 0.8 });
  caixa(-0.6, 0, -0.6, 0.6, 7, 0.6, PARTE_GRUA.TOPO, 0, { trel: 1, meia: 0.6 });
  caixa(0, 0.4, -0.6, 1, 2.0, 0.6, PARTE_GRUA.LANCA, 0, { trel: 1, eixo: 'x', meia: 0.6, centro: [1.2, 0] });
  caixa(-12, 0.6, -0.6, -0.8, 1.6, 0.6, PARTE_GRUA.TOPO, 0, { trel: 1, eixo: 'x', meia: 0.5, centro: [1.1, 0] });
  caixa(-11.5, -1.2, -0.9, -8.5, 1.6, 0.9, PARTE_GRUA.TOPO, 0, { cor: COR.CONCRETO });
  caixa(0.9, -2.6, 0.8, 2.7, 0, 2.6, PARTE_GRUA.TOPO, 0, { cor: COR.CABINE });
  caixa(-0.05, -1, -0.05, 0.05, 0, 0.05, PARTE_GRUA.CABO, 0, { cor: COR.CABO });
  caixa(-0.35, -1.4, -0.35, 0.35, -1.0, 0.35, PARTE_GRUA.CABO, 0, { cor: COR.CABO });
  // a carga (ferragem ou módulo de fachada) com as lingas, só no meio do ciclo
  carga(0);
  // móvel: chassi de 10 m com a cabine e as sapatas, braço telescópico (x de 0 a 1) em três seções
  caixa(-5, 0.6, -1.3, 5, 2.4, 1.3, PARTE_GRUA.CHASSI, 1, { cor: COR.ESTRUTURA });
  caixa(3.2, 2.4, -1.25, 5, 3.8, 1.25, PARTE_GRUA.CHASSI, 1, { cor: COR.CABINE });
  caixa(-2.8, 2.4, -1.0, 0.2, 3.6, 1.0, PARTE_GRUA.CHASSI, 1, { cor: COR.ESTRUTURA });
  for (const [x, z] of [[-4, -2.4], [-4, 2.4], [3, -2.4], [3, 2.4]]) caixa(x - 0.3, 0, z - 0.3, x + 0.3, 0.8, z + 0.3, PARTE_GRUA.CHASSI, 1, { cor: COR.CONCRETO });
  caixa(0, -0.55, -0.55, 1, 0.55, 0.55, PARTE_GRUA.BRACO, 1, { cor: COR.ESTRUTURA });
  caixa(0.55, -0.4, -0.4, 1.0, 0.4, 0.4, PARTE_GRUA.BRACO, 1, { cor: COR.CABINE });
  caixa(-0.05, -1, -0.05, 0.05, 0, 0.05, PARTE_GRUA.CABO, 1, { cor: COR.CABO });
  caixa(-0.35, -1.4, -0.35, 0.35, -1.0, 0.35, PARTE_GRUA.CABO, 1, { cor: COR.CABO });
  carga(1);
  // escavadeira de 20 t (origem no eixo da torre, no chão; lança, braço e caçamba em cadeia a partir de cada pivô)
  const E = 2;
  caixa(-2.5, 0, 0.55, 2.5, 0.85, 1.35, PARTE_GRUA.ESTEIRA, E, { cor: COR.ESTEIRA });
  caixa(-2.5, 0, -1.35, 2.5, 0.85, -0.55, PARTE_GRUA.ESTEIRA, E, { cor: COR.ESTEIRA });
  caixa(-1.6, 0.5, -0.6, 1.6, 1.0, 0.6, PARTE_GRUA.ESTEIRA, E, { cor: COR.ESTEIRA });
  caixa(-2.1, 1.0, -1.25, 0.9, 2.05, 1.25, PARTE_GRUA.CORPO, E, { cor: COR.AMARELO });
  caixa(-2.7, 1.0, -1.1, -2.1, 2.2, 1.1, PARTE_GRUA.CORPO, E, { cor: COR.ESTEIRA });
  caixa(0.0, 2.05, -1.2, 1.3, 3.25, -0.1, PARTE_GRUA.CORPO, E, { cor: COR.AMARELO });
  caixa(1.28, 2.2, -1.12, 1.34, 3.1, -0.2, PARTE_GRUA.CORPO, E, { cor: COR.VIDRO });
  caixa(-1.8, 2.05, 0.5, -1.5, 2.8, 0.8, PARTE_GRUA.CORPO, E, { cor: COR.ESTEIRA });
  caixa(0, -0.3, -0.3, 4.2, 0.3, 0.3, PARTE_GRUA.LANCA_E, E, { cor: COR.AMARELO });
  caixa(0, -0.22, -0.22, 2.4, 0.22, 0.22, PARTE_GRUA.BRACO_E, E, { cor: COR.AMARELO });
  caixa(0, -0.55, -0.5, 1.0, 0.25, 0.5, PARTE_GRUA.CACAMBA, E, { cor: COR.ESTEIRA });
  // perfuratriz de estacas hélice contínua (origem no pé do mastro: o mastro, o cabeçote e a broca andam em +x 1,4 m)
  const R = 3;
  caixa(-2.5, 0, 0.55, 2.5, 0.85, 1.35, PARTE_GRUA.ESTEIRA, R, { cor: COR.ESTEIRA });
  caixa(-2.5, 0, -1.35, 2.5, 0.85, -0.55, PARTE_GRUA.ESTEIRA, R, { cor: COR.ESTEIRA });
  caixa(-2.6, 0.85, -1.3, 1.0, 2.3, 1.3, PARTE_GRUA.CORPO, R, { cor: COR.AMARELO });
  caixa(-0.4, 0.2, -0.35, 0.4, 15, 0.35, PARTE_GRUA.MASTRO_P, R, { trel: 1, meia: 0.4, cor: COR.AMARELO });
  caixa(-0.7, -0.7, -0.55, 0.7, 0.7, 0.55, PARTE_GRUA.CABECA, R, { cor: COR.ESTEIRA });
  caixa(-0.2, -15, -0.2, 0.2, -0.7, 0.2, PARTE_GRUA.BROCA, R, { cor: COR.ESTEIRA });
  return G.geometria();
}

// ------------------------------------------------------------------------------------------------ materiais

function trocar(src, alvo, novo, nome) {
  if (!src.includes(alvo)) throw new Error(`${nome}: shader sem '${alvo}'`);
  return src.replace(alvo, novo);
}

const UNIFORMES = ['gPredTab', 'gPredObra', 'gTique', 'gCorHolding'];

/**
 * Material de uma variante (caixas, cascas, gruas), com os ganchos comuns (sombra própria, neblina, HAO, noite). S: o
 * módulo materiais/shaders/obra.glsl.js (sob demanda).
 */
export function criarMaterialObra(ganchos, variante, S) {
  const V = S.GLSL_OBRA[variante];
  const casca = variante === 'cascas';
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, side: casca ? THREE.DoubleSide : THREE.FrontSide, alphaToCoverage: true });
  m.name = `obra-${variante}`;
  m.onBeforeCompile = (s) => {
    for (const u of UNIFORMES) s.uniforms[u] = uniformesEdificio[u];
    let vs = s.vertexShader;
    vs = trocar(vs, '#include <common>', `#include <common>\n${S.GLSL_OBRA.comumVertice}\n${V.pars}`, m.name);
    vs = trocar(vs, '#include <begin_vertex>', `#include <begin_vertex>\n${V.vertice}`, m.name);
    let fs = s.fragmentShader;
    fs = trocar(fs, '#include <common>', `#include <common>\n${S.GLSL_OBRA.comumFragmento}`, m.name);
    fs = trocar(fs, '#include <color_fragment>', `#include <color_fragment>\n${V.cor}`, m.name);
    fs = trocar(fs, '#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = gObraRug;', m.name);
    fs = trocar(fs, '#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = gObraMet;', m.name);
    fs = trocar(fs, '#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += gObraEmis;', m.name);
    s.vertexShader = vs;
    s.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => `obra-${variante}-2`;
  return ganchos.aplicar(m, ganchos.nomes().filter((n) => n !== 'camada' && n !== 'mascara'));
}

/** Material do projetor de sombra (caixas com a massa do prédio, ou gruas): só a profundidade. */
export function criarMaterialSombraObra(variante, S) {
  const V = S.GLSL_OBRA[variante];
  const m = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
  m.name = `obra-${variante}-sombra`;
  m.onBeforeCompile = (s) => {
    for (const u of UNIFORMES) s.uniforms[u] = uniformesEdificio[u];
    s.vertexShader = trocar(s.vertexShader, '#include <common>', `#include <common>\n#define OBRA_SOMBRA\n${S.GLSL_OBRA.comumVertice}\n${V.pars}`, m.name);
    s.vertexShader = trocar(s.vertexShader, '#include <begin_vertex>', `#include <begin_vertex>\n${V.vertice}`, m.name);
  };
  m.customProgramCacheKey = () => `obra-${variante}-sombra-1`;
  return m;
}

// ------------------------------------------------------------------------------------------------ instâncias (puro)

const agoraMs = () => (typeof performance !== 'undefined' ? performance.now() : 0);

const h01 = (a, b) => ((Math.imul(a ^ Math.imul(b + 0x632be5ab, 0x9e3779b1), 0x85ebca6b) >>> 8) & 0xffff) / 65535;

/** Volumes do corpo do prédio no plano (as peças do LOD1, sem telhado, lote e saliência). */
export function volumesDoPlano(plano) {
  return plano.pecas.filter((P) => P.lod1 && !P.lote && !P.sobra && (P.forma === 'caixa' || P.forma === 'chanfro' || P.forma === 'cilindro') && P.h > 2);
}

/** Tipos de colocável sem esqueleto de concreto (campos, cavas, praças e parques): só o canteiro e as máquinas. */
const SEM_ESQUELETO = new Set(['praca', 'parque', 'parqueG', 'solar', 'pedreira', 'areal', 'mina', 'manejo', 'serraria', 'ete', 'captacao']);

/** Classe da obra pela altura do plano: casa (até 6 m), prédio baixo (até ALTO), torre, ou simples (sem esqueleto). */
export function classeDaObra(H, temEsqueleto) {
  if (!temEsqueleto) return 'simples';
  return H <= 6 ? 'casa' : H <= ALTO ? 'predio' : 'torre';
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const centi = (v) => Math.round(v * 100) / 100;

/** Ponto (i, j) da estaca k na malha nx por nz, em zigue-zague (o mesmo do vértice da perfuratriz, gPontoEstaca). */
export function pontoEstaca(k, nx) {
  const j = Math.floor(k / nx);
  let i = k - j * nx;
  if (j % 2 === 1) i = nx - 1 - i;
  return [i, j];
}

/**
 * Peças da obra de um prédio, no mundo: { caixas: [[x, y, z, giro, w, h, d, tipo, hash, param]], cascas: [...],
 * gruas: [[x, y, z, giro, modelo, hash, L, giroPega, giroLarga, raios]] }. o: { idx, x, y, z, rot, w, d, plano (ou
 * null), nivel, H (colocável sem plano: altura do modelo), esqueleto (false: campo ou cava, sem esqueleto) }. Puro: os
 * testes conferem as fases, as classes e as alturas sem o three.
 */
export function pecasDaObra(o) {
  const caixas = [];
  const cascas = [];
  const gruas = [];
  const c = Math.cos(o.rot);
  const s = Math.sin(o.rot);
  const mundo = (lx, lz) => [o.x + lx * c + lz * s, o.z - lx * s + lz * c];
  const add = (lista, lx, ly, lz, giro, w, h, d, tipo, param = 0) => {
    const [x, z] = mundo(lx, lz);
    lista.push([x, o.y + ly, z, o.rot + giro, w, h, d, tipo, h01(o.idx, lista.length), param]);
  };
  const W = o.w;
  const D = o.d;
  let vols = o.plano ? volumesDoPlano(o.plano) : [];
  let H = o.plano?.alturaTopo ?? 0;
  if (!o.plano && o.H > 0) {
    // colocável: sem plano de prédio, o volume é a pegada reduzida (o modelo é cortado pela textura de obra)
    H = o.H;
    if (o.esqueleto !== false && H >= 5) vols = [{ x: 0, z: 0, w: W * 0.7, d: D * 0.7, y0: 0, h: H, giro: 0, mat: { a: 3.4 } }];
  }
  const alto = H > ALTO;
  const classe = classeDaObra(H, vols.length > 0);
  const base = vols[0];
  // o corpo mais alto (com mais de 8 m: o casario do telhado não conta) leva o núcleo, os operários do alto, as faíscas e o
  // balancim; a bandeirola e o brilho vão na cota mais alta de todas
  const maisAlto = (lista) => lista.reduce((a, v) => (!a || v.y0 + v.h > a.y0 + a.h ? v : a), null);
  const topoV = maisAlto(vols.filter((v) => v.h > 8));
  const cimaV = maisAlto(vols);
  const pe = (v) => centi(Math.max(2.6, Math.min(6, v.mat?.a ?? 3)));
  const lp = (v, ax, az) => {
    const cg = Math.cos(v.giro ?? 0);
    const sg = Math.sin(v.giro ?? 0);
    return [v.x + ax * cg + az * sg, v.z - ax * sg + az * cg];
  };
  // tapume em volta do lote (só na frente na reforma) e a placa da obra
  const e = 0.25;
  add(caixas, 0, 0, D / 2 - e, 0, W - 2 * e, 2.2, 0.06, PECA.TAPUME, 0);
  if (!o.nivel) {
    add(caixas, 0, 0, -D / 2 + e, 0, W - 2 * e, 2.2, 0.06, PECA.TAPUME, 0);
    add(caixas, W / 2 - e, 0, 0, Math.PI / 2, D - 2 * e, 2.2, 0.06, PECA.TAPUME, 0);
    add(caixas, -W / 2 + e, 0, 0, Math.PI / 2, D - 2 * e, 2.2, 0.06, PECA.TAPUME, 0);
  }
  if (W >= 8) {
    const px = W * (h01(o.idx, 99) - 0.5) * 0.4;
    add(caixas, px, 2.3, D / 2 - e + 0.06, 0, 3.0, 2.0, 0.08, PECA.TAPUME, 1);
    for (const sx of [-1.3, 1.3]) add(caixas, px + sx, 0, D / 2 - e + 0.12, 0, 0.1, 4.3, 0.1, PECA.TAPUME, 2);
  }
  // onde ficam o contêiner e os operários: no recuo da frente (ou do fundo) quando há 3 m livres
  const z1 = vols.length ? Math.max(...vols.map((v) => v.z + v.d / 2)) : D / 4;
  const z0 = vols.length ? Math.min(...vols.map((v) => v.z - v.d / 2)) : -D / 4;
  const frente = D / 2 - e - z1;
  const fundo = z0 - (-D / 2 + e);
  const zc = frente >= 3 ? z1 + frente / 2 : fundo >= 3 ? z0 - fundo / 2 : null;
  // operários no chão: andam de um ponto a outro da trilha e param (a trilha fica no recuo, ou na frente do lote)
  const nTer = o.nivel ? 2 : { casa: 2, predio: 3, torre: 4, simples: 3 }[classe];
  for (let k = 0; k < nTer; k++) {
    const lz = clamp((zc ?? D / 2 - 1.6) + (k - (nTer - 1) / 2) * 1.2, -D / 2 + 1, D / 2 - 0.9);
    const lx = (h01(o.idx, 300 + k) - 0.5) * W * 0.45;
    add(caixas, lx, 0, lz, 0, 0.32, 1.75, 0.5, PECA.OPERARIO, clamp(W * 0.3, 3, 9));
  }
  if (!o.nivel) {
    // canteiro: contêiner e caçamba no recuo da frente (ou no fundo), pilhas de material, o caminhão betoneira na rua
    if (zc !== null && W >= 10) {
      add(caixas, -W / 2 + 3.6, 0, zc, 0, 6.0, 2.6, 2.4, PECA.CONTEINER, 0);
      add(caixas, W / 2 - 2.4, 0, zc, 0, 3.6, 1.3, 1.8, PECA.CONTEINER, 1);
      add(caixas, 0.8, 0, zc, 0.3, 2.4, 1.1, 1.2, PECA.PILHA, 0);
    } else {
      add(caixas, 0, 0, D / 2 - 1.2, 0, 1.6, 0.8, 1.0, PECA.PILHA, 1);
    }
    add(caixas, -2.4, 0, D / 2 + 3.2, Math.PI / 2, 2.5, 2.9, 2.5, PECA.BETONEIRA, 0);
    add(caixas, 1.7, 0.9, D / 2 + 3.2, Math.PI / 2, 2.5, 2.3, 5.4, PECA.BETONEIRA, 1);
    // o caminhão que leva a terra (pista de fora) e a poeira da chegada e da saída do betoneira
    add(caixas, 3.0, 0, D / 2 + 6.4, Math.PI / 2, 2.5, 2.9, 2.5, PECA.BASCULANTE, 0);
    add(caixas, -0.7, 0.9, D / 2 + 6.4, Math.PI / 2, 2.5, 1.6, 5.0, PECA.BASCULANTE, 1);
    for (let k = 0; k < 2; k++) add(caixas, -1.2 + k * 2.6, 0.5, D / 2 + 3.2, Math.PI / 2, 3.2, 1, 1, PECA.POEIRA, 1);
    if (base) {
      const bx0 = Math.max(0, base.y0);
      const ex = base.w >= 8 || base.d >= 8;
      // a malha de estacas sob os pilares, na ordem em que a perfuratriz passa
      const lim = classe === 'casa' ? 2 : classe === 'predio' ? 4 : 5;
      const nx = clamp(Math.round(base.w / 6) + 1, 2, lim);
      const nz = clamp(Math.round(base.d / 6) + 1, 2, lim);
      const sx = clamp(Math.round((base.w - 0.8) / (nx - 1)), 2, 40);
      const sz = clamp(Math.round((base.d - 0.8) / (nz - 1)), 2, 40);
      const n = nx * nz;
      for (let k = 0; k < n; k++) {
        const [i, j] = pontoEstaca(k, nx);
        const [x, z] = lp(base, -((nx - 1) * sx) / 2 + i * sx, -((nz - 1) * sz) / 2 + j * sz);
        add(caixas, x, bx0, z, base.giro ?? 0, 0.5, 1.6, 0.5, PECA.ESTACA, k + 64 * n);
      }
      if (classe !== 'casa' && ex) {
        const [rx, rz] = lp(base, -((nx - 1) * sx) / 2, -((nz - 1) * sz) / 2);
        const [x, z] = mundo(rx, rz);
        gruas.push([x, o.y + bx0, z, o.rot + (base.giro ?? 0), MODELO.PERFURATRIZ, h01(o.idx, 21), nx + 8 * nz + 64 * sx + 4096 * sz, 0, 0, 0]);
        // a esmerilhadeira que corta a armação, no pé da primeira estaca
        add(caixas, rx, bx0, rz, 0, 0.18, 1, 1, PECA.FAISCA, 1);
      }
      // a escavadeira dentro da cava, o monte de terra no alcance do despejo e a poeira da cava e do despejo
      const esc = classe === 'casa' ? 0.55 : classe === 'torre' ? 1.15 : 1;
      const eax = Math.min(base.w / 2 - 3.5 * esc, base.w * 0.28);
      const eaz = base.d * 0.05;
      const [ex0, ez0] = lp(base, eax, eaz);
      const [wx, wz] = mundo(ex0, ez0);
      gruas.push([wx, o.y + bx0, wz, o.rot + (base.giro ?? 0), MODELO.ESCAVADEIRA, h01(o.idx, 22), esc, 0, 0, 0]);
      const [mx, mz] = lp(base, eax - 2.1 * esc, eaz - 6.2 * esc);
      add(caixas, mx, bx0, mz, base.giro ?? 0, 5.2 * esc, 1.8 * esc, 4.2 * esc, PECA.MONTE, 0);
      const [dx, dz] = lp(base, eax + 4.9 * esc, eaz);
      for (let k = 0; k < 3; k++) add(caixas, dx, bx0 + 0.2, dz, 0, 3.0 * esc, 1, 1, PECA.POEIRA, 0);
      for (let k = 0; k < 2; k++) add(caixas, mx, bx0 + 1.2 * esc, mz, 0, 3.4 * esc, 1, 1, PECA.POEIRA, 2);
    }
    // esqueleto e massa (sombra) por volume: pilares numa grade de ~6 m e uma laje por andar
    for (const v of vols) {
      const y0 = Math.max(0, v.y0);
      const top = v.y0 + v.h;
      const pl = pe(v);
      const nx = Math.max(2, Math.min(6, Math.round(v.w / 6) + 1));
      const nz = Math.max(2, Math.min(6, Math.round(v.d / 6) + 1));
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
          const [lx, lz] = lp(v, -v.w / 2 + 0.4 + ((v.w - 0.8) * i) / (nx - 1) , -v.d / 2 + 0.4 + ((v.d - 0.8) * j) / (nz - 1));
          add(caixas, lx, y0, lz, v.giro ?? 0, 0.42, top - y0, 0.42, PECA.PILAR, 0);
        }
      }
      const nf = Math.min(60, Math.floor((top - y0) / pl + 1e-3));
      for (let k = 1; k <= nf; k++) add(caixas, v.x, y0 + k * pl - 0.22, v.z, v.giro ?? 0, v.w - 0.1, 0.22, v.d - 0.1, PECA.LAJE, 0);
      add(caixas, v.x, y0, v.z, v.giro ?? 0, v.w, top - y0, v.d, PECA.MASSA, 0);
    }
    if (topoV) {
      const y0 = Math.max(0, topoV.y0);
      const g = topoV.giro ?? 0;
      const pl = pe(topoV);
      // o núcleo sobe à frente das lajes; nos altos, a fôrma trepante e a plataforma sobem com ele
      const cw = clamp(topoV.w * 0.3, 5, 12);
      const cd = clamp(topoV.d * 0.3, 5, 10);
      add(caixas, topoV.x, y0, topoV.z, g, cw, topoV.y0 + topoV.h - y0, cd, PECA.NUCLEO, 0);
      if (alto) {
        add(caixas, topoV.x, y0, topoV.z, g, cw + 0.8, 3.8, cd + 0.8, PECA.FORMA, 0);
        add(caixas, topoV.x, y0, topoV.z, g, cw + 3.2, 0.16, cd + 3.2, PECA.FORMA, 1);
      }
      // operários e faíscas de solda no último andar concretado
      const nAlto = { predio: 1, torre: 3, simples: 2, casa: 0 }[classe];
      for (let k = 0; k < nAlto; k++) {
        const [x, z] = lp(topoV, (h01(o.idx, 400 + k) - 0.5) * topoV.w * 0.2, (k - (nAlto - 1) / 2) * topoV.d * 0.28);
        add(caixas, x, y0, z, g, 0.32, 1.75, 0.5, PECA.OPERARIO_ALTO, clamp(topoV.w - 3, 3, 12) + 1000 * Math.round(pl * 100));
      }
      const nFa = alto ? 2 : 1;
      for (let k = 0; k < nFa; k++) {
        const [x, z] = lp(topoV, (k ? -1 : 1) * topoV.w * 0.32, (k ? 1 : -1) * topoV.d * 0.3);
        add(caixas, x, y0, z, g, 0.18, 1, 1, PECA.FAISCA, 0 + 8 * Math.round(pl * 100));
      }
      // o balancim do acabamento, na frente do volume mais alto (fora da tela)
      if (H > 8) {
        const fz = topoV.d / 2 + 0.9;
        const [bx, bz] = lp(topoV, 0, fz);
        const [rx, rz] = lp(topoV, 0, fz + 0.45);
        add(caixas, bx, 0.2, bz, g, 4.0, 0.18, 0.9, PECA.BALANCIM, 0);
        add(caixas, rx, 0.2, rz, g, 4.0, 1.0, 0.06, PECA.BALANCIM, 1);
        for (const sx of [-1.8, 1.8]) {
          const [kx, kz] = lp(topoV, sx, fz + 0.2);
          add(caixas, kx, 0.2, kz, g, 0.04, 1, 0.04, PECA.BALANCIM, 2);
        }
      }
    }
  }
  // fecho da obra: a bandeirola no topo e o brilho de faíscas (só desenhados depois que a obra acaba)
  if (cimaV || H > 0) {
    const v = cimaV ?? { x: 0, z: 0, w: Math.min(W, 6), d: Math.min(D, 6), y0: 0, h: H, giro: 0 };
    const topo = v.y0 + v.h;
    if (!o.nivel) {
      const alt = classe === 'casa' ? 2.2 : 4.5;
      const [px, pz] = lp(v, 0, 0);
      const [fx, fz] = lp(v, 0.95, 0);
      add(caixas, px, topo, pz, v.giro ?? 0, 0.1, alt, 0.1, PECA.BANDEIRA, 0);
      add(caixas, fx, topo + alt - 1.1, fz, v.giro ?? 0, 1.8, 1.0, 0.04, PECA.BANDEIRA, 1);
    }
    for (const [ux, uz] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const [bx, bz] = lp(v, (ux * v.w) / 2 * 0.85, (uz * v.d) / 2 * 0.85);
      add(caixas, bx, topo + 0.3, bz, 0, 0.55, 1, 1, PECA.FAISCA, 2);
    }
  }
  // andaime nas obras baixas, tela nas altas (e na reforma, pela altura); a instância vai da base ao topo do volume e
  // o vértice prende a casca nessa faixa (a tela do pódio largo não sobe em volta da torre)
  for (const v of vols) {
    const folga = alto ? 0.5 : 0.9;
    const y0 = Math.max(0, v.y0);
    add(cascas, v.x, y0, v.z, v.giro ?? 0, v.w + 2 * folga, Math.max(0.5, v.y0 + v.h - y0), v.d + 2 * folga, alto ? CASCA.TELA : CASCA.ANDAIME, 0);
  }
  // gruas: a de torre ao lado do corpo principal (nos fundos, ao lado ou no poço do elevador), a móvel na rua
  const prin = base;
  if (prin && alto) {
    const L = Math.max(25, Math.min(55, Math.hypot(prin.w, prin.d) * 0.9 + 6));
    let gx = prin.x;
    let gz = prin.z - prin.d / 2 - 2.6;
    if (gz < -D / 2 + 1.2) {
      gz = prin.z;
      gx = prin.x + prin.w / 2 + 2.6;
      if (gx > W / 2 - 1.2) gx = prin.x;
    }
    // o ciclo: pega a carga no canteiro (a pilha de material) e assenta no último andar do volume mais alto
    const alvoPe = [0.8, zc ?? D / 2 - 1.2];
    const alvoTopo = topoV ? [topoV.x, topoV.z] : [prin.x, prin.z];
    const giroPara = ([tx, tz]) => Math.atan2(-(tz - gz), tx - gx);
    const raioPara = ([tx, tz]) => clamp(Math.hypot(tx - gx, tz - gz), 6, L - 3);
    const gP = giroPara(alvoPe);
    let gL = giroPara(alvoTopo);
    if (gL - gP > Math.PI) gL -= 2 * Math.PI;
    if (gL - gP < -Math.PI) gL += 2 * Math.PI;
    const raios = Math.round(raioPara(alvoPe) * 4) + 1024 * Math.round(raioPara(alvoTopo) * 4);
    const [x, z] = mundo(gx, gz);
    gruas.push([x, o.y, z, o.rot, MODELO.TORRE, h01(o.idx, 7), L, gP, gL, raios]);
  } else if (prin && !o.nivel && H > 6 && W >= 10) {
    const [x, z] = mundo(W * 0.25, D / 2 + 3.4);
    gruas.push([x, o.y, z, o.rot + Math.PI / 2, MODELO.MOVEL, h01(o.idx, 8), Math.max(14, Math.min(30, H * 1.4 + 6)), 0, 0, 0]);
  }
  return { caixas, cascas, gruas };
}

// ------------------------------------------------------------------------------------------------ fases na CPU

const [F0, F1, F2] = FASES_OBRA.map((f) => f.ate);
export const FRONTEIRAS = Object.freeze([F0, F1, F2, 1]);
/**
 * Em que fases cada peça vale (as mesmas contas do vértice, só por fase; o resto da sequência, como o instante em que
 * cada estaca aparece, é do vértice): a lista leva só as de agora e as do próximo segundo.
 */
export const VER_CAIXA = Object.freeze({
  [PECA.PILAR]: { ver: (p) => p > F1, reforma: false },
  [PECA.LAJE]: { ver: (p) => p > F1, reforma: false },
  [PECA.CONTEINER]: { ver: () => true, reforma: false },
  [PECA.PILHA]: { ver: (p) => p < F2, reforma: false },
  [PECA.BETONEIRA]: { ver: (p) => p > F0 && p < F2, reforma: false },
  [PECA.TAPUME]: { ver: () => true, reforma: true },
  [PECA.MASSA]: { ver: (p) => p > F0, reforma: false },
  [PECA.ESTACA]: { ver: (p) => p < F1, reforma: false },
  [PECA.OPERARIO]: { ver: (p) => p < 1, reforma: true },
  [PECA.OPERARIO_ALTO]: { ver: (p) => p > F1 && p < 1, reforma: false },
  [PECA.NUCLEO]: { ver: (p) => p > F1, reforma: false },
  [PECA.FORMA]: { ver: (p) => p > F1, reforma: false },
  [PECA.POEIRA]: { ver: (p) => p < F2, reforma: false },
  [PECA.FAISCA]: { ver: (p) => p < 1, reforma: false },
  [PECA.BANDEIRA]: { ver: () => false, reforma: false },
  [PECA.MONTE]: { ver: (p) => p < F1, reforma: false },
  [PECA.BASCULANTE]: { ver: (p) => p < F1, reforma: false },
  [PECA.BALANCIM]: { ver: (p) => p > F2, reforma: false },
});
export const VER_CASCA = Object.freeze({
  [CASCA.ANDAIME]: { ver: (p) => p > F1, reforma: true },
  [CASCA.TELA]: { ver: (p) => p > F2, reforma: true },
});
export const VER_GRUA = Object.freeze({
  [MODELO.TORRE]: { ver: (p) => p > F0, reforma: true },
  [MODELO.MOVEL]: { ver: (p) => p > F1 && p < 1, reforma: false },
  [MODELO.ESCAVADEIRA]: { ver: (p) => p < F1, reforma: false },
  [MODELO.PERFURATRIZ]: { ver: (p) => p < F1, reforma: false },
});

/** O brilho do fecho é uma faísca de param com o resto 2 por 8; a bandeirola só existe no fecho. */
const ehBrilho = (t) => t[7] === PECA.FAISCA && t[9] % 8 === 2;
/** A peça vale na fase p (e na reforma, se for o caso): o brilho do fecho nunca vale numa obra em andamento. */
export const caixaVale = (t, p, nivel) => {
  if (ehBrilho(t)) return false;
  const q = VER_CAIXA[t[7]];
  return nivel ? q.reforma : q.ver(p);
};
/** As peças que o fecho da obra ainda mostra: o canteiro que se desmonta, a bandeirola e o brilho. */
export const FECHO_VALE = Object.freeze({
  [PECA.TAPUME]: () => true,
  [PECA.CONTEINER]: () => true,
  [PECA.PILHA]: () => true,
  [PECA.BETONEIRA]: () => true,
  [PECA.BANDEIRA]: () => true,
  [PECA.FAISCA]: ehBrilho,
});
export const fechoVale = (t) => !!FECHO_VALE[t[7]]?.(t);

/** Máscara das condições de fase que as peças usam (VER_*): duas obras na mesma máscara valem as mesmas peças. */
export const mascaraFase = (p) => (p > F0 ? 1 : 0) | (p > F1 ? 2 : 0) | (p > F2 ? 4 : 0) | (p < F2 ? 8 : 0) | (p < 1 ? 16 : 0) | (p < F1 ? 32 : 0);
const BITS_MASCARA = 6;

/**
 * Bloco de instâncias de uma obra: as matrizes (T R S, coluna maior), o aObra e o aAux das peças que passam em
 * vale(peça), prontos para copiar na lista. grua: as peças são [x, y, z, giro, modelo, hash, L, giroPega, giroLarga,
 * raios] (escala 1); senão [x, y, z, giro, w, h, d, tipo, hash, param]. fecho: { t0 } soma o deslocamento do fecho ao
 * tipo e leva o tique em que a obra acabou no aAux.x.
 */
export function blocoDe(pecas, vale, idx, grua = false, fecho = null) {
  let n = 0;
  for (const t of pecas) if (vale(t)) n++;
  const m = new Float32Array(16 * n);
  const o = new Float32Array(4 * n);
  const x = new Float32Array(4 * n);
  let k = 0;
  for (const t of pecas) {
    if (!vale(t)) continue;
    const c = Math.cos(t[3]);
    const s = Math.sin(t[3]);
    const w = grua ? 1 : t[4];
    const h = grua ? 1 : t[5];
    const d = grua ? 1 : t[6];
    const j = 16 * k; // os zeros já estão no vetor novo
    m[j] = c * w;
    m[j + 2] = -s * w;
    m[j + 5] = h;
    m[j + 8] = s * d;
    m[j + 10] = c * d;
    m[j + 12] = t[0];
    m[j + 13] = t[1];
    m[j + 14] = t[2];
    m[j + 15] = 1;
    o[4 * k] = idx;
    o[4 * k + 1] = (grua ? t[4] : t[7]) + (fecho ? FECHO.deslocamento : 0);
    o[4 * k + 2] = grua ? t[5] : t[8];
    o[4 * k + 3] = grua ? t[6] : t[9];
    if (fecho) x[4 * k] = fecho.t0;
    if (grua) {
      x[4 * k + 1] = t[7] ?? 0;
      x[4 * k + 2] = t[8] ?? 0;
      x[4 * k + 3] = t[9] ?? 0;
    }
    k++;
  }
  return { m, o, x, n };
}

// ------------------------------------------------------------------------------------------------ domínio

/** Lista instanciada com a matriz (T R S) e o aObra por instância. */
export class ListaObra {
  constructor(geo, material, nome, cap = 256) {
    this.geo = geo;
    this.material = material;
    this.nome = nome;
    this.cap = 0;
    this.mesh = null;
    this.aoCriar = null;
    this._garantir(cap);
  }

  _garantir(n) {
    if (this.mesh && n <= this.cap) return;
    const cap = Math.max(256, 2 ** Math.ceil(Math.log2(Math.max(1, n) * 1.25)));
    const g = new THREE.BufferGeometry();
    for (const [k, a] of Object.entries(this.geo.attributes)) g.setAttribute(k, a);
    g.setIndex(this.geo.index);
    const ob = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    ob.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aObra', ob);
    const ax = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    ax.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aAux', ax);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    const m = new THREE.InstancedMesh(g, this.material, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.matrixAutoUpdate = false;
    m.count = 0;
    m.name = this.nome;
    const velha = this.mesh;
    this.mesh = m;
    this.cap = cap;
    this.aoCriar?.(m, velha);
    if (velha) {
      // o buffer de instâncias da velha (o gêmeo da sombra já foi solto) e a geometria
      velha.dispose();
      velha.geometry.dispose();
    }
  }

  /**
   * Monta a lista com os blocos das obras ({ m, o, n } de blocoDe), na ordem dada: só cópias de vetores tipados (a
   * lista é refeita a cada obra que começa, acaba ou troca de fase). Devolve quantas instâncias.
   */
  compor(blocos) {
    let n = 0;
    for (const b of blocos) n += b.n;
    this._garantir(n);
    const me = this.mesh;
    const im = me.instanceMatrix.array;
    const ob = me.geometry.attributes.aObra.array;
    const ax = me.geometry.attributes.aAux.array;
    let k = 0;
    for (const b of blocos) {
      if (!b.n) continue;
      im.set(b.m, 16 * k);
      ob.set(b.o, 4 * k);
      ax.set(b.x, 4 * k);
      k += b.n;
    }
    me.count = n;
    for (const [attr, q] of [[me.instanceMatrix, 16], [me.geometry.attributes.aObra, 4], [me.geometry.attributes.aAux, 4]]) {
      attr.clearUpdateRanges();
      if (n) attr.addUpdateRange(0, n * q);
      attr.needsUpdate = true;
    }
    return n;
  }

  descartar() {
    this.mesh?.dispose();
    this.mesh?.geometry.dispose();
    this.mesh = null;
  }
}

function criarObras(ctx) {
  const { cena, medidas } = ctx;
  // os shaders vêm sob demanda (materiais/shaders/obra.glsl.js), pedidos já na criação do render: chegam antes da
  // rodada final do aquecimento (os programas compilam na carga, D66) e ficam fora do pacote principal (A1)
  let pronto = false; // os shaders chegaram
  let fimCarga = false; // chegaram ou falharam: o aquecimento da carga não espera mais (motor/quadro.js, D66)
  let mats = {};
  let sombras = {};
  let geos = {};
  const listas = {};
  let descartado = false;
  const carregando = import('../materiais/shaders/obra.glsl.js').then((S) => {
    if (descartado) return;
    mats = { caixas: criarMaterialObra(ctx.ganchos, 'caixas', S), cascas: criarMaterialObra(ctx.ganchos, 'cascas', S), gruas: criarMaterialObra(ctx.ganchos, 'gruas', S) };
    sombras = { caixas: criarMaterialSombraObra('caixas', S), gruas: criarMaterialSombraObra('gruas', S) };
    geos = { caixas: geometriaCaixa(), cascas: geometriaCasca(), gruas: geometriaGrua() };
    for (const v of ['caixas', 'cascas', 'gruas']) {
      const L = new ListaObra(geos[v].g, mats[v], `obras:${v}`);
      L.aoCriar = (m, velha) => {
        if (velha) {
          cena.remove(velha);
          if (sombras[v]) ctx.sombra.soltar(velha);
        }
        medidas.familia(m, 'resto');
        cena.add(m);
        // a sombra: o gêmeo com o mesmo buffer (poucas instâncias, nunca compactado: o aObra acompanha a instância)
        if (sombras[v]) medidas.familia(ctx.sombra.projetor(m, { material: sombras[v], compactar: false }), 'sombra');
      };
      L.aoCriar(L.mesh, null);
      listas[v] = L;
    }
    pronto = true;
    sujo = true;
  })
    .catch((e) => console.warn('obras: os shaders não carregaram', e))
    .finally(() => (fimCarga = true));
  // A sombra do primeiro colocável (uma malha que não é instanciada) usa o material de profundidade padrão sem instâncias,
  // um programa que nenhum projetor da cidade vazia compila na carga: no jogo real ele aparecia como compilação depois de
  // pronto (MeshBasicMaterial) na primeira obra, 2,3 ms de bloqueio (Teste de desempenho, 08/10/2026). A sonda invisível
  // na cena da sombra entra em todas as rodadas do aquecimento (o compile atravessa os invisíveis) e não desenha nada.
  let sonda = null;
  if (ctx.sombra?.cena && ctx.sombra.material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    sonda = new THREE.Mesh(g, ctx.sombra.material);
    sonda.name = 'obras:sonda-sombra';
    sonda.visible = false;
    sonda.frustumCulled = false;
    sonda.matrixAutoUpdate = false;
    ctx.sombra.cena.add(sonda);
  }
  const obras = new Map(); // idx -> { caixas, cascas, gruas, nivel, chave } (null: peças a fazer no próximo refazer)
  const fechos = new Map(); // idx -> { ob, t0, blocos }: a obra que acabou e ainda mostra o fecho (FECHO.tiques)
  const chaveObra = (P, i) => `${P.flags[i] & (PREDIO.OBRA | PREDIO.OBRA_NIVEL)}:${P.obraIni[i]}:${P.obraFim[i]}:${P.x[i]}:${P.z[i]}:${P.modelo[i]}:${P.nivel[i]}:${P.semente[i]}`;
  let sujo = true;
  let msQuadro = 0; // o JS das listas refeitas neste quadro (o envio da obra; a cena bairro soma ao dos prédios)
  let proximo = Infinity; // o tique da próxima troca de fase entre as obras desenhadas
  let tRefeito = -1e9;
  const alvoRef = new THREE.Vector3(1e9, 0, 1e9);
  const alvo = new THREE.Vector3();
  const perfil = () => porPerfil(PERFIL_OBRAS, ctx.perfil);

  function obraDe(P, i) {
    if (!(i < P.n && P.viva[i] && P.flags[i] & PREDIO.OBRA)) return null;
    const pred = ctx.dominio('predios');
    const plano = P.tipo[i] === TIPO_PREDIO.ZONA ? pred?.planoObra?.(i) ?? null : null;
    // o colocável sem plano de prédio: a altura do modelo e se ele tem esqueleto (a mesma que o corte da textura usa)
    const tc = plano ? null : tipoColocavel(P.tipo[i], P.modelo[i]);
    return {
      idx: i, x: P.x[i], y: P.y[i], z: P.z[i], rot: P.rot[i], w: P.w[i], d: P.d[i], plano,
      nivel: !!(P.flags[i] & PREDIO.OBRA_NIVEL),
      H: tc ? COLOCAVEIS[tc]?.altura ?? 0 : 0,
      esqueleto: tc ? !SEM_ESQUELETO.has(tc) : true,
    };
  }

  let iniciado = false;
  function aplicar(d, esp) {
    const P = esp.predios;
    if (!P) return;
    if (!iniciado || pedeTudo(d, 'predios')) {
      iniciado = true;
      obras.clear();
      fechos.clear();
      for (let i = 0; i < P.n; i++) if (P.viva[i] && P.flags[i] & PREDIO.OBRA) obras.set(i, null);
      sujo = true;
      return;
    }
    for (const i of d.predios ?? []) {
      const em = i < P.n && P.viva[i] && P.flags[i] & PREDIO.OBRA;
      if (!em) {
        // a obra que acabou (o prédio segue vivo no mesmo lugar) mostra o fecho; demolida ou movida, some
        // (um aviso posterior do mesmo prédio, sem obra em andamento, não interrompe o fecho que já corre)
        const ob = obras.get(i);
        const f = fechos.get(i);
        const noLugar = (o) => i < P.n && P.viva[i] && o.px === P.x[i] && o.pz === P.z[i];
        if (ob && noLugar(ob)) {
          const tp = esp.tempo ?? {};
          fechos.set(i, { ob, t0: (tp.tique ?? 0) + (tp.frac ?? 0), blocos: null });
        } else if (ob || !(f && noLugar(f.ob))) fechos.delete(i);
        if (obras.delete(i)) sujo = true;
        continue;
      }
      fechos.delete(i);
      // a simulação marca o prédio por muita coisa: a obra só é refeita quando ela mesma muda
      const ch = chaveObra(P, i);
      if (obras.get(i)?.chave === ch) continue;
      obras.set(i, null);
      sujo = true;
    }
  }

  /**
   * Refaz as instâncias: as obras mais perto do alvo da câmera, até o teto do perfil, só com as peças que valem na
   * fase de agora ou na do próximo segundo (o vértice decide o resto; ao passar de fase a lista é refeita).
   */
  function refazer(tMs, novasMax = NOVAS_POR_QUADRO) {
    if (!pronto) return;
    let novas = 0;
    let faltou = false;
    const t0 = agoraMs();
    const P = ctx.sim.espelho.predios;
    const Pp = perfil();
    const tp = ctx.sim.espelho.tempo ?? {};
    const T = (tp.tique ?? 0) + (tp.frac ?? 0);
    const passo = Math.max(1, tp.mult ?? 1);
    proximo = Infinity;
    ctx.cameraApi?.alvo?.(alvo);
    const lista = [];
    for (const i of obras.keys()) {
      if (!P || i >= P.n || !P.viva[i]) continue;
      const dx = P.x[i] - alvo.x;
      const dz = P.z[i] - alvo.z;
      const dist = Math.hypot(dx, dz);
      if (dist < Pp.alcance) lista.push([dist, i]);
    }
    lista.sort((a, b) => a[0] - b[0]);
    const blocos = { caixas: [], cascas: [], gruas: [] };
    for (const [, i] of lista.slice(0, Pp.max)) {
      let ob = obras.get(i);
      if (!ob) {
        // peças novas com teto por quadro (a câmera que pula para um bairro com 200 obras não trava um quadro)
        if (novas >= novasMax) {
          faltou = true;
          continue;
        }
        novas++;
        const o = obraDe(P, i);
        if (!o) continue;
        ob = pecasDaObra(o);
        ob.nivel = o.nivel;
        ob.px = P.x[i];
        ob.pz = P.z[i];
        ob.chave = chaveObra(P, i);
        obras.set(i, ob);
      }
      const ini = P.obraIni[i];
      const fim = P.obraFim[i];
      const p = progressoObra(T, 0, ini, fim);
      const p1 = progressoObra(T + passo, 0, ini, fim);
      // a próxima troca de fase desta obra (em tiques)
      for (const f of FRONTEIRAS) if (p < f) {
        proximo = Math.min(proximo, ini + f * (fim - ini));
        break;
      }
      // os blocos prontos da obra valem enquanto a máscara das fases de agora e do próximo segundo não muda
      const chave = ob.nivel ? -1 : mascaraFase(p) | (mascaraFase(p1) << BITS_MASCARA);
      if (ob.blocos?.chave !== chave) {
        const vale = (q) => (ob.nivel ? q.reforma : q.ver(p) || q.ver(p1));
        ob.blocos = {
          chave,
          caixas: blocoDe(ob.caixas, (t) => caixaVale(t, p, ob.nivel) || caixaVale(t, p1, ob.nivel), i),
          cascas: blocoDe(ob.cascas, (t) => vale(VER_CASCA[t[7]]), i),
          gruas: blocoDe(ob.gruas, (t) => vale(VER_GRUA[t[4]]), i, true),
        };
      }
      for (const v of ['caixas', 'cascas', 'gruas']) blocos[v].push(ob.blocos[v]);
    }
    // o fecho das obras que acabaram: o canteiro que se desmonta, a bandeirola e o brilho (só nas que estão à vista)
    for (const [i, f] of fechos) {
      if (T - f.t0 > FECHO.tiques || T < f.t0 - 1) {
        fechos.delete(i);
        continue;
      }
      proximo = Math.min(proximo, f.t0 + FECHO.tiques);
      if (!P || i >= P.n || Math.hypot(P.x[i] - alvo.x, P.z[i] - alvo.z) > Pp.alcance) continue;
      f.blocos ??= blocoDe(f.ob.caixas, fechoVale, i, false, { t0: f.t0 });
      blocos.caixas.push(f.blocos);
    }
    const n = { caixas: listas.caixas.compor(blocos.caixas), cascas: listas.cascas.compor(blocos.cascas), gruas: listas.gruas.compor(blocos.gruas) };
    ctx.sombra.marcar();
    alvoRef.copy(alvo);
    tRefeito = tMs;
    sujo = faltou;
    dom.contagem = { obras: Math.min(lista.length, Pp.max), fechos: fechos.size, ...n };
    msQuadro += agoraMs() - t0;
  }

  const dom = {
    nome: 'obras',
    contagem: { obras: 0, fechos: 0, caixas: 0, cascas: 0, gruas: 0 },
    aplicar(d, esp) {
      aplicar(d, esp);
    },
    /** A promessa das peças (cenas e testes esperam por ela). */
    carregando,
    /** ms de JS das listas refeitas no último quadro (o envio delas à GPU sai no desenho). */
    msEnvio: 0,
    quadro(tMs) {
      msQuadro = 0;
      dom.msEnvio = 0;
      if (!pronto) return;
      ctx.cameraApi?.alvo?.(alvo);
      const andou = Math.hypot(alvo.x - alvoRef.x, alvo.z - alvoRef.z) > 200;
      const tp = ctx.sim.espelho.tempo ?? {};
      const fase = (tp.tique ?? 0) + (tp.frac ?? 0) >= proximo;
      if (sujo || ((andou || fase) && tMs - tRefeito > 500)) refazer(tMs);
      dom.msEnvio = +msQuadro.toFixed(3);
    },
    /** Força refazer, com todas as peças novas de uma vez (cenas e testes). */
    refazer: () => refazer(agoraMs(), Infinity),
    /** Os shaders chegaram (ou falharam): o aquecimento da carga espera por eles. */
    pronto: () => fimCarga,
    medidas() {
      if (!pronto) return { ...dom.contagem, tris: 0 };
      const t = (v) => listas[v].mesh.count * geos[v].tris;
      return { ...dom.contagem, tris: t('caixas') + t('cascas') + t('gruas') };
    },
    descartar() {
      descartado = true;
      for (const [v, L] of Object.entries(listas)) {
        cena.remove(L.mesh);
        if (sombras[v]) ctx.sombra.soltar(L.mesh);
        L.descartar();
      }
      for (const m of [...Object.values(mats), ...Object.values(sombras)]) m.dispose();
      if (sonda) {
        ctx.sombra.cena.remove(sonda);
        sonda.geometry.dispose();
      }
    },
  };
  return dom;
}

export function registrar(api) {
  api.registrarDominio('obras', criarObras);
}
