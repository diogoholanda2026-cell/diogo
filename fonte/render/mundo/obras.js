// Obras da cidade (desenho do render 12.1, 2.4, D76; R4b): as fases à CS2 andam na GPU, pelo uniforme de tique (gTique
// = tique + frac do espelho) sobre a textura de início e fim da obra (predios.js), sem envio por quadro. Aqui ficam as
// peças em volta do prédio cortado no vértice (fachada.glsl.js):
//   canteiro    tapume de chapa em volta do lote com a placa da obra, contêiner, caçamba e pilhas de material (o chão
//               de terra é do terreno, pela bandeira OBRA)
//   fundação    a laje sobe até 0,3 m e o caminhão betoneira encosta
//   estrutura   o esqueleto de concreto (pilares e lajes por andar) sobe até a altura do prédio; prédio alto (mais de
//               14 m) com grua de torre que sobe com os andares, prédio baixo com grua móvel e andaime
//   fechamento  a fachada sobe andar por andar atrás do esqueleto, com a tela de proteção entre a fachada e o topo
//   pronto      a bandeira sai e tudo some (o vértice esconde a peça no mesmo quadro)
// A reforma de subir de nível (OBRA_NIVEL) não corta o prédio: tela ou andaime em volta e a grua, se for alto.
// Três chamadas (caixas, cascas e gruas) e dois projetores na sombra própria (caixas, com a massa do prédio até a
// altura pronta, e gruas); as instâncias só mudam quando uma obra começa ou acaba (ou a câmera anda muito).
// Os shaders (materiais/shaders/obra.glsl.js) vêm sob demanda; as peças (pecasDaObra, puro) e as listas ficam aqui.
import * as THREE from 'three';
import { PREDIO, TIPO_PREDIO } from '../../contratos/flags.js';
import { FASES_OBRA, progressoObra } from '../../contratos/espelho.js';
import { porPerfil } from '../motor/perfis.js';
import { pedeTudo } from '../ponte.js';
import { uniformesEdificio } from './predios.js';

/** Tipos das caixas (aObra.y) e das cascas. */
export const PECA = Object.freeze({ PILAR: 0, LAJE: 1, CONTEINER: 2, PILHA: 3, BETONEIRA: 4, TAPUME: 5, MASSA: 6 });
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
export const PARTE_GRUA = Object.freeze({ MASTRO: 0, TOPO: 1, LANCA: 2, CABO: 3, CHASSI: 5, BRACO: 6 });
const COR = { ESTRUTURA: 0, CONCRETO: 1, CABINE: 2, CABO: 4 };

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
  // torre: mastro (y de 0 a 1), torre de topo, lança (x de 0 a 1), contra-lança, contrapeso, cabine, cabo
  caixa(-0.8, 0, -0.8, 0.8, 1, 0.8, PARTE_GRUA.MASTRO, 0, { trel: 1, meia: 0.8 });
  caixa(-0.6, 0, -0.6, 0.6, 7, 0.6, PARTE_GRUA.TOPO, 0, { trel: 1, meia: 0.6 });
  caixa(0, 0.4, -0.6, 1, 2.0, 0.6, PARTE_GRUA.LANCA, 0, { trel: 1, eixo: 'x', meia: 0.6, centro: [1.2, 0] });
  caixa(-12, 0.6, -0.6, -0.8, 1.6, 0.6, PARTE_GRUA.TOPO, 0, { trel: 1, eixo: 'x', meia: 0.5, centro: [1.1, 0] });
  caixa(-11.5, -1.2, -0.9, -8.5, 1.6, 0.9, PARTE_GRUA.TOPO, 0, { cor: COR.CONCRETO });
  caixa(0.9, -2.6, 0.8, 2.7, 0, 2.6, PARTE_GRUA.TOPO, 0, { cor: COR.CABINE });
  caixa(-0.05, -1, -0.05, 0.05, 0, 0.05, PARTE_GRUA.CABO, 0, { cor: COR.CABO });
  caixa(-0.35, -1.4, -0.35, 0.35, -1.0, 0.35, PARTE_GRUA.CABO, 0, { cor: COR.CABO });
  // móvel: chassi de 10 m com a cabine e as sapatas, braço telescópico (x de 0 a 1) em três seções
  caixa(-5, 0.6, -1.3, 5, 2.4, 1.3, PARTE_GRUA.CHASSI, 1, { cor: COR.ESTRUTURA });
  caixa(3.2, 2.4, -1.25, 5, 3.8, 1.25, PARTE_GRUA.CHASSI, 1, { cor: COR.CABINE });
  caixa(-2.8, 2.4, -1.0, 0.2, 3.6, 1.0, PARTE_GRUA.CHASSI, 1, { cor: COR.ESTRUTURA });
  for (const [x, z] of [[-4, -2.4], [-4, 2.4], [3, -2.4], [3, 2.4]]) caixa(x - 0.3, 0, z - 0.3, x + 0.3, 0.8, z + 0.3, PARTE_GRUA.CHASSI, 1, { cor: COR.CONCRETO });
  caixa(0, -0.55, -0.55, 1, 0.55, 0.55, PARTE_GRUA.BRACO, 1, { cor: COR.ESTRUTURA });
  caixa(0.55, -0.4, -0.4, 1.0, 0.4, 0.4, PARTE_GRUA.BRACO, 1, { cor: COR.CABINE });
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
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, side: casca ? THREE.DoubleSide : THREE.FrontSide, alphaToCoverage: variante !== 'caixas' });
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
    s.vertexShader = vs;
    s.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => `obra-${variante}-1`;
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

/**
 * Peças da obra de um prédio, no mundo: { caixas: [[x, y, z, giro, w, h, d, tipo, hash, param]], cascas: [...],
 * gruas: [[x, y, z, giro, modelo, hash, L]] }. o: { idx, x, y, z, rot, w, d, plano (ou null), nivel, alto }. Puro:
 * os testes conferem as fases e as alturas sem o three.
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
  const vols = o.plano ? volumesDoPlano(o.plano) : [];
  const H = o.plano?.alturaTopo ?? 0;
  const alto = H > ALTO;
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
  if (!o.nivel) {
    // canteiro: contêiner e caçamba no recuo da frente (ou no fundo), pilhas de material, o caminhão betoneira na rua
    const z1 = vols.length ? Math.max(...vols.map((v) => v.z + v.d / 2)) : D / 4;
    const z0 = vols.length ? Math.min(...vols.map((v) => v.z - v.d / 2)) : -D / 4;
    const frente = D / 2 - e - z1;
    const fundo = z0 - (-D / 2 + e);
    const zc = frente >= 3 ? z1 + frente / 2 : fundo >= 3 ? z0 - fundo / 2 : null;
    if (zc !== null && W >= 10) {
      add(caixas, -W / 2 + 3.6, 0, zc, 0, 6.0, 2.6, 2.4, PECA.CONTEINER, 0);
      add(caixas, W / 2 - 2.4, 0, zc, 0, 3.6, 1.3, 1.8, PECA.CONTEINER, 1);
      add(caixas, 0.8, 0, zc, 0.3, 2.4, 1.1, 1.2, PECA.PILHA, 0);
    } else {
      add(caixas, 0, 0, D / 2 - 1.2, 0, 1.6, 0.8, 1.0, PECA.PILHA, 1);
    }
    add(caixas, -2.4, 0, D / 2 + 3.2, Math.PI / 2, 2.5, 2.9, 2.5, PECA.BETONEIRA, 0);
    add(caixas, 1.7, 0.9, D / 2 + 3.2, Math.PI / 2, 2.5, 2.3, 5.4, PECA.BETONEIRA, 1);
    // esqueleto e massa (sombra) por volume: pilares numa grade de ~6 m e uma laje por andar
    for (const v of vols) {
      const y0 = Math.max(0, v.y0);
      const top = v.y0 + v.h;
      const pe = Math.max(2.6, Math.min(6, v.mat?.a ?? 3));
      const nx = Math.max(2, Math.min(6, Math.round(v.w / 6) + 1));
      const nz = Math.max(2, Math.min(6, Math.round(v.d / 6) + 1));
      const cg = Math.cos(v.giro ?? 0);
      const sg = Math.sin(v.giro ?? 0);
      const lp = (ax, az) => [v.x + ax * cg + az * sg, v.z - ax * sg + az * cg];
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
          const [lx, lz] = lp(-v.w / 2 + 0.4 + ((v.w - 0.8) * i) / (nx - 1), -v.d / 2 + 0.4 + ((v.d - 0.8) * j) / (nz - 1));
          add(caixas, lx, y0, lz, v.giro ?? 0, 0.42, top - y0, 0.42, PECA.PILAR, 0);
        }
      }
      const nf = Math.min(60, Math.floor((top - y0) / pe + 1e-3));
      for (let k = 1; k <= nf; k++) add(caixas, v.x, y0 + k * pe - 0.22, v.z, v.giro ?? 0, v.w - 0.1, 0.22, v.d - 0.1, PECA.LAJE, 0);
      add(caixas, v.x, y0, v.z, v.giro ?? 0, v.w, top - y0, v.d, PECA.MASSA, 0);
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
  const prin = vols[0];
  if (prin && alto) {
    const L = Math.max(25, Math.min(55, Math.hypot(prin.w, prin.d) * 0.9 + 6));
    let gx = prin.x;
    let gz = prin.z - prin.d / 2 - 2.6;
    if (gz < -D / 2 + 1.2) {
      gz = prin.z;
      gx = prin.x + prin.w / 2 + 2.6;
      if (gx > W / 2 - 1.2) gx = prin.x;
    }
    const [x, z] = mundo(gx, gz);
    gruas.push([x, o.y, z, o.rot, 0, h01(o.idx, 7), L]);
  } else if (prin && !o.nivel && H > 6 && W >= 10) {
    const [x, z] = mundo(W * 0.25, D / 2 + 3.4);
    gruas.push([x, o.y, z, o.rot + Math.PI / 2, 1, h01(o.idx, 8), Math.max(14, Math.min(30, H * 1.4 + 6))]);
  }
  return { caixas, cascas, gruas };
}

// ------------------------------------------------------------------------------------------------ fases na CPU

const [F0, F1, F2] = FASES_OBRA.map((f) => f.ate);
export const FRONTEIRAS = Object.freeze([F0, F1, F2, 1]);
/** Em que fases cada peça vale (as mesmas contas do vértice): a lista leva só as de agora e as do próximo segundo. */
export const VER_CAIXA = Object.freeze({
  [PECA.PILAR]: { ver: (p) => p > F1, reforma: false },
  [PECA.LAJE]: { ver: (p) => p > F1, reforma: false },
  [PECA.CONTEINER]: { ver: () => true, reforma: false },
  [PECA.PILHA]: { ver: (p) => p < F2, reforma: false },
  [PECA.BETONEIRA]: { ver: (p) => p > F0 && p < F2, reforma: false },
  [PECA.TAPUME]: { ver: () => true, reforma: true },
  [PECA.MASSA]: { ver: (p) => p > F0, reforma: false },
});
export const VER_CASCA = Object.freeze({
  [CASCA.ANDAIME]: { ver: (p) => p > F1, reforma: true },
  [CASCA.TELA]: { ver: (p) => p > F2, reforma: true },
});
export const VER_GRUA = Object.freeze({
  0: { ver: (p) => p > F0, reforma: true },
  1: { ver: (p) => p > F1 && p < 1, reforma: false },
});

/** Máscara das condições de fase que as peças usam (VER_*): duas obras na mesma máscara valem as mesmas peças. */
export const mascaraFase = (p) => (p > F0 ? 1 : 0) | (p > F1 ? 2 : 0) | (p > F2 ? 4 : 0) | (p < F2 ? 8 : 0) | (p < 1 ? 16 : 0);

/**
 * Bloco de instâncias de uma obra: as matrizes (T R S, coluna maior) e o aObra das peças que passam em vale(peça),
 * prontos para copiar na lista. grua: as peças são [x, y, z, giro, modelo, hash, L] (escala 1); senão [x, y, z, giro,
 * w, h, d, tipo, hash, param].
 */
export function blocoDe(pecas, vale, idx, grua = false) {
  let n = 0;
  for (const t of pecas) if (vale(t)) n++;
  const m = new Float32Array(16 * n);
  const o = new Float32Array(4 * n);
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
    o[4 * k + 1] = grua ? t[4] : t[7];
    o[4 * k + 2] = grua ? t[5] : t[8];
    o[4 * k + 3] = grua ? t[6] : t[9];
    k++;
  }
  return { m, o, n };
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
    let k = 0;
    for (const b of blocos) {
      if (!b.n) continue;
      im.set(b.m, 16 * k);
      ob.set(b.o, 4 * k);
      k += b.n;
    }
    me.count = n;
    for (const [attr, q] of [[me.instanceMatrix, 16], [me.geometry.attributes.aObra, 4]]) {
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
  const obras = new Map(); // idx -> { caixas, cascas, gruas, nivel, chave } (null: peças a fazer no próximo refazer)
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
    return {
      idx: i, x: P.x[i], y: P.y[i], z: P.z[i], rot: P.rot[i], w: P.w[i], d: P.d[i], plano,
      nivel: !!(P.flags[i] & PREDIO.OBRA_NIVEL),
    };
  }

  let iniciado = false;
  function aplicar(d, esp) {
    const P = esp.predios;
    if (!P) return;
    if (!iniciado || pedeTudo(d, 'predios')) {
      iniciado = true;
      obras.clear();
      for (let i = 0; i < P.n; i++) if (P.viva[i] && P.flags[i] & PREDIO.OBRA) obras.set(i, null);
      sujo = true;
      return;
    }
    for (const i of d.predios ?? []) {
      const em = i < P.n && P.viva[i] && P.flags[i] & PREDIO.OBRA;
      if (!em) {
        if (obras.delete(i)) sujo = true;
        continue;
      }
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
      const chave = ob.nivel ? -1 : mascaraFase(p) | (mascaraFase(p1) << 5);
      if (ob.blocos?.chave !== chave) {
        const vale = (q) => (ob.nivel ? q.reforma : q.ver(p) || q.ver(p1));
        ob.blocos = {
          chave,
          caixas: blocoDe(ob.caixas, (t) => vale(VER_CAIXA[t[7]]), i),
          cascas: blocoDe(ob.cascas, (t) => vale(VER_CASCA[t[7]]), i),
          gruas: blocoDe(ob.gruas, (t) => vale(VER_GRUA[t[4]]), i, true),
        };
      }
      for (const v of ['caixas', 'cascas', 'gruas']) blocos[v].push(ob.blocos[v]);
    }
    const n = { caixas: listas.caixas.compor(blocos.caixas), cascas: listas.cascas.compor(blocos.cascas), gruas: listas.gruas.compor(blocos.gruas) };
    ctx.sombra.marcar();
    alvoRef.copy(alvo);
    tRefeito = tMs;
    sujo = faltou;
    dom.contagem = { obras: Math.min(lista.length, Pp.max), ...n };
    msQuadro += agoraMs() - t0;
  }

  const dom = {
    nome: 'obras',
    contagem: { obras: 0, caixas: 0, cascas: 0, gruas: 0 },
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
    },
  };
  return dom;
}

export function registrar(api) {
  api.registrarDominio('obras', criarObras);
}
