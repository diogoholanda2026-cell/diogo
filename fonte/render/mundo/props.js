// Objetos da rua (desenho do render 4.4, 9.1): postes (urbano, duplo no canteiro, rural de concreto), árvores de rua
// (copa de oiti ou sibipiruna, palmeira-imperial no canteiro da avenida) e semáforos nos cruzamentos de avenida.
// As posições saem do setor de vias (cruzamento.js, na oficina) e chegam por ctx.dominio('vias').setoresPerto(); aqui
// ficam só os modelos (poucos triângulos, medidas reais) e as listas de instâncias compactadas com os setores perto
// (instancias.js): uma chamada por modelo e LOD. As árvores de perto projetam na sombra própria (D43); os postes, a
// lâmpada acende à noite (e a poça de luz no chão sai do mapa de luz da rua, luzRua.js); o semáforo acende o foco da
// fase (ciclo de 40 s por cruzamento, a mesma conta do tráfego).
import * as THREE from 'three';
import { ListaCompactada } from './instancias.js';
import { OBJETOS } from '../geracao/cruzamento.js';
import * as SH from '../materiais/shaders/via.glsl.js';

/** Alcance dos objetos por perfil (m do setor) e a troca de LOD das árvores. */
export const PERFIL_PROPS = Object.freeze({
  ultra: { postes: 900, arvores: 900, lod0: 260 },
  alta: { postes: 600, arvores: 650, lod0: 190 },
  media: { postes: 380, arvores: 420, lod0: 140 },
  leve: { postes: 200, arvores: 220, lod0: 70 },
});

/** Partes dos objetos (aParte; via.glsl.js OBJ_*). */
const P = Object.freeze({ METAL: 0, CONCRETO: 1, LAMPADA: 2, VERMELHO: 3, AMARELO: 4, VERDE: 5, CAIXA: 6 });

// ------------------------------------------------------------------------------------------------ modelos

class Geo {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.parte = [];
    this.cor = [];
    this.folha = [];
    this.idx = [];
  }

  get nv() {
    return this.pos.length / 3;
  }

  /** Um vértice; folha = [1 + posição ao longo da folha (0 a 1), 0 na raque a 1 na borda] (0, 0 fora das folhas). */
  v(x, y, z, nx, ny, nz, parte, cor = [1, 1, 1], folha = null) {
    this.pos.push(x, y, z);
    const c = Math.hypot(nx, ny, nz) || 1;
    this.nor.push(nx / c, ny / c, nz / c);
    this.parte.push(parte);
    this.cor.push(...cor);
    this.folha.push(folha?.[0] ?? 0, folha?.[1] ?? 0);
    return this.nv - 1;
  }

  /** Quadrilátero plano (anti-horário visto de fora); folhas: a coordenada da folha de cada canto (ou nada). */
  quad(a, b, c, d, parte, cor, folhas = null) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const i = [a, b, c, d].map((p, k) => this.v(p[0], p[1], p[2], n[0], n[1], n[2], parte, cor, folhas?.[k]));
    this.idx.push(i[0], i[1], i[2], i[0], i[2], i[3]);
  }

  /** Caixa de x0..x1, y0..y1, z0..z1 (sem o fundo, a não ser com fundo). */
  caixa(x0, y0, z0, x1, y1, z1, parte, { fundo = false, parteFundo = parte, cor } = {}) {
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], parte, cor);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], parte, cor);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], parte, cor);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], parte, cor);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], parte, cor);
    if (fundo) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], parteFundo, cor);
  }

  /** Tronco de cone de n lados no eixo y (sem tampas), normais suaves. */
  cone(x, z, y0, y1, r0, r1, n, parte, cor) {
    const base = this.nv;
    for (let k = 0; k <= n; k++) {
      const a = (2 * Math.PI * k) / n;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const inc = (r0 - r1) / (y1 - y0);
      this.v(x + c * r0, y0, z + s * r0, c, inc, s, parte, cor);
      this.v(x + c * r1, y1, z + s * r1, c, inc, s, parte, cor);
    }
    for (let k = 0; k < n; k++) {
      const a = base + 2 * k;
      this.idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }

  /** Icosaedro (esfera de 20 faces) com os vértices mexidos pela semente e normais do centro (copa macia). */
  bola(cx, cy, cz, rx, ry, rz, parte, cor, semente = 1) {
    const t = (1 + Math.sqrt(5)) / 2;
    const V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
    const F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    const base = this.nv;
    V.forEach(([x, y, z], k) => {
      const c = Math.hypot(x, y, z);
      const h = 0.85 + 0.3 * (((Math.imul(k + 1, 2654435761) ^ Math.imul(semente, 40503)) >>> 0) / 4294967296);
      const nx = x / c;
      const ny = y / c;
      const nz = z / c;
      // sombra própria da copa: mais escura embaixo
      const k2 = 0.7 + 0.3 * (ny * 0.5 + 0.5);
      this.v(cx + nx * rx * h, cy + ny * ry * h, cz + nz * rz * h, nx, ny + 0.3, nz, parte, cor.map((q) => q * k2));
    });
    for (const [a, b, c] of F) this.idx.push(base + a, base + c, base + b);
  }

  geometria() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aParte', new THREE.Float32BufferAttribute(this.parte, 1));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.cor, 3));
    g.setAttribute('aFolha', new THREE.Float32BufferAttribute(this.folha, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return { g, tris: this.idx.length / 3 };
  }
}

/** Poste urbano de 10 m (a instância escala a altura) com o braço de 2 m para +z e a luminária. */
function modeloPoste({ duplo = false, rural = false } = {}) {
  const G = new Geo();
  const h = 10;
  if (rural) {
    G.caixa(-0.1, 0, -0.1, 0.1, h, 0.1, P.CONCRETO);
    G.caixa(-0.03, h - 1.2, 0, 0.03, h - 1.12, 1.6, P.METAL);
    G.caixa(-0.12, h - 1.3, 1.4, 0.12, h - 1.12, 2.0, P.METAL, { fundo: true, parteFundo: P.LAMPADA });
    return G.geometria();
  }
  G.cone(0, 0, 0, h, 0.13, 0.065, 6, P.METAL);
  const lados = duplo ? [1, -1] : [1];
  for (const s of lados) {
    // braço que sobe um pouco e a luminária de LED (cabeça achatada) na ponta
    G.quad([-0.04, h - 0.25, 0], [0.04, h - 0.25, 0], [0.04, h + 0.1, s * 2], [-0.04, h + 0.1, s * 2], P.METAL);
    G.quad([0.04, h - 0.35, 0], [-0.04, h - 0.35, 0], [-0.04, h + 0.02, s * 2], [0.04, h + 0.02, s * 2], P.METAL);
    const z0 = s > 0 ? 1.55 : -2.25;
    G.caixa(-0.2, h - 0.02, z0, 0.2, h + 0.12, z0 + 0.7, P.METAL, { fundo: true, parteFundo: P.LAMPADA });
  }
  return G.geometria();
}

/** Semáforo: coluna de 5,4 m, braço projetado de 4,5 m para +z sobre as faixas e o grupo focal virado para +x. */
function modeloSemaforo() {
  const G = new Geo();
  G.cone(0, 0, 0, 5.6, 0.1, 0.08, 6, P.METAL);
  G.caixa(-0.05, 5.3, 0, 0.05, 5.42, 4.5, P.METAL);
  const cabeca = (z, y) => {
    G.caixa(-0.16, y, z - 0.18, 0.16, y + 1.05, z + 0.18, P.CAIXA);
    // focos: vermelho em cima, amarelo, verde embaixo (virados para +x, quem chega)
    const f = (yy, parte) => G.quad([0.165, yy, z + 0.12], [0.165, yy, z - 0.12], [0.165, yy + 0.24, z - 0.12], [0.165, yy + 0.24, z + 0.12], parte);
    f(y + 0.75, P.VERMELHO);
    f(y + 0.42, P.AMARELO);
    f(y + 0.09, P.VERDE);
  };
  cabeca(3.4, 4.2);
  cabeca(0, 2.4);
  return G.geometria();
}

const TRONCO = [0.2, 0.15, 0.11];
const FOLHA = [0.055, 0.085, 0.035];
const PALMITO = [0.07, 0.13, 0.05];

/** Copa (oiti, sibipiruna): tronco e três lóbulos; LOD1 com um lóbulo. Altura ~8 m (a instância escala). */
function modeloCopa(lod) {
  const G = new Geo();
  if (lod) {
    G.cone(0, 0, 0, 2.6, 0.18, 0.14, 3, P.METAL, TRONCO);
    G.bola(0, 5.2, 0, 3.4, 2.8, 3.4, P.LAMPADA, FOLHA, 3);
    return G.geometria();
  }
  G.cone(0, 0, 0, 3.2, 0.2, 0.14, 5, P.METAL, TRONCO);
  G.cone(0, 0, 3.0, 4.2, 0.14, 0.05, 4, P.METAL, TRONCO);
  G.bola(0.3, 5.6, 0.2, 2.8, 2.2, 2.7, P.LAMPADA, FOLHA, 1);
  G.bola(-1.3, 5.0, -0.6, 2.1, 1.8, 2.2, P.LAMPADA, FOLHA.map((c) => c * 1.08), 2);
  G.bola(1.2, 4.9, -1.1, 2.0, 1.7, 2.0, P.LAMPADA, FOLHA.map((c) => c * 0.95), 5);
  return G.geometria();
}

/** Palmeira-imperial: estipe liso cinza de 18 m, palmito verde e as folhas em arco. LOD1: estipe e 4 folhas. */
function modeloPalmeira(lod) {
  const G = new Geo();
  const h = 17;
  // estipe cinza-claro (albedo real ~0,2 linear), 45 cm na base, afinando até o palmito
  G.cone(0, 0, 0, h * 0.45, 0.23, 0.2, lod ? 3 : 6, P.CONCRETO, [0.2, 0.19, 0.17]);
  G.cone(0, 0, h * 0.45, h, 0.2, 0.17, lod ? 3 : 6, P.CONCRETO, [0.22, 0.21, 0.19]);
  if (!lod) G.cone(0, 0, h, h + 2, 0.2, 0.17, 6, P.LAMPADA, PALMITO);
  // folhas pinadas em arco: a raque sobe e cai, os folíolos pendem dos dois lados em V (uma face só: o material é de
  // dois lados), e a coroa fica com ~8 m de largura, como a da palmeira-imperial; os folíolos são recortados no shader
  // (aFolha: posição ao longo da folha e distância da raque), então a folha não é uma lâmina verde cheia
  const n = lod ? 6 : 12;
  for (let k = 0; k < n; k++) {
    const a = (2 * Math.PI * k) / n + (k % 2) * 0.25;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const px = -dz;
    const pz = dx;
    const seg = lod ? 1 : 3;
    const comp = 4.2;
    const sobe = k % 3 === 0 ? 0.9 : 0.4;
    const claro = FOLHA.map((c) => c * (1.05 + 0.1 * (k % 2)));
    let prev = null;
    for (let j = 0; j <= seg; j++) {
      const t = j / seg;
      const r = comp * t;
      const y = h + 2 + sobe * r * (1 - t) * 1.2 - 1.6 * t * t;
      const w = 0.9 * (1 - 0.55 * t) + 0.08;
      const cx = dx * r;
      const cz = dz * r;
      const cai = 0.45 * w;
      const cur = [[cx + px * w, y - cai, cz + pz * w], [cx, y, cz], [cx - px * w, y - cai, cz - pz * w]];
      if (prev) {
        const a0 = 1 + (j - 1) / seg;
        const a1 = 1 + t;
        G.quad(prev[1], prev[0], cur[0], cur[1], P.LAMPADA, claro, [[a0, 0], [a0, 1], [a1, 1], [a1, 0]]);
        G.quad(prev[2], prev[1], cur[1], cur[2], P.LAMPADA, claro, [[a0, 1], [a0, 0], [a1, 0], [a1, 1]]);
      }
      prev = cur;
    }
  }
  return G.geometria();
}

// ------------------------------------------------------------------------------------------------ materiais

function trocar(src, alvo, novo, nome) {
  if (!src.includes(alvo)) throw new Error(`${nome}: shader sem '${alvo}'`);
  return src.replace(alvo, novo);
}

/** Material dos postes e semáforos (partes e focos no shader). */
export function criarMaterialObjetos(ganchos, U) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0 });
  m.name = 'obj-rua';
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    let vs = s.vertexShader;
    vs = trocar(vs, '#include <common>', `#include <common>\n${SH.OBJ_VERTICE_PARS}`, 'obj');
    vs = trocar(vs, '#include <begin_vertex>', `#include <begin_vertex>\n${SH.OBJ_VERTICE_MAIN}`, 'obj');
    let fs = s.fragmentShader;
    fs = trocar(fs, '#include <common>', `#include <common>\n${SH.OBJ_FRAGMENTO_PARS}`, 'obj');
    fs = trocar(fs, '#include <color_fragment>', SH.OBJ_FRAGMENTO_COR, 'obj');
    fs = trocar(fs, '#include <roughnessmap_fragment>', SH.OBJ_FRAGMENTO_RUGOSIDADE, 'obj');
    fs = trocar(fs, '#include <metalnessmap_fragment>', SH.OBJ_FRAGMENTO_METAL, 'obj');
    fs = trocar(fs, '#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${SH.OBJ_FRAGMENTO_EMISSIVO}`, 'obj');
    s.vertexShader = vs;
    s.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => 'obj-rua-1';
  return ganchos.aplicar(m, ganchos.nomes().filter((n) => n !== 'camada'));
}

/** Material das árvores de rua: cor por vértice (tronco, folha, palmito) e a variação da instância. */
export function criarMaterialArvore(ganchos, { duplo = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.82, metalness: 0, side: duplo ? THREE.DoubleSide : THREE.FrontSide });
  m.name = duplo ? 'arvore-rua-palma' : 'arvore-rua';
  m.onBeforeCompile = (s) => {
    s.vertexShader = trocar(s.vertexShader, '#include <common>', '#include <common>\nattribute vec4 aObj;\nattribute float aParte;\nattribute vec2 aFolha;\nvarying vec2 vFolha;', 'arvore');
    s.vertexShader = trocar(s.vertexShader, '#include <begin_vertex>', '#include <begin_vertex>\nvFolha = aFolha;', 'arvore');
    // folíolos da palmeira: faixas oblíquas a partir da raque, recortadas; de longe (faixa menor que o pixel) a folha
    // fica cheia, sem cintilar
    s.fragmentShader = trocar(s.fragmentShader, '#include <common>', '#include <common>\nvarying vec2 vFolha;', 'arvore');
    s.fragmentShader = trocar(s.fragmentShader, '#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if ( vFolha.x > 0.5 ) {
  float fT = vFolha.x - 1.0;
  float fS = ( fT * 4.2 - vFolha.y * ( 0.98 - 0.5 * fT ) * 0.8 ) / 0.13;
  float fPerto = 1.0 - smoothstep( 0.18, 0.45, fwidth( fS ) );
  if ( vFolha.y > 0.06 && ( fract( fS ) > 1.0 - 0.5 * fPerto || vFolha.y > 0.97 - 0.25 * fT * fPerto * fract( fS * 0.37 ) ) ) discard;
}`, 'arvore');
    // variação da copa por instância (tom e secura), sem mexer no tronco
    s.vertexShader = trocar(s.vertexShader, '#include <color_vertex>', `#include <color_vertex>
if ( aParte > 1.5 ) vColor.rgb *= vec3( 0.85 + 0.3 * aObj.x / 255.0, 0.88 + 0.2 * aObj.y / 255.0, 0.9 );`, 'arvore');
  };
  m.customProgramCacheKey = () => `arvore-rua-${duplo ? 'p' : 'c'}`;
  return ganchos.aplicar(m, ganchos.nomes().filter((n) => n !== 'camada'));
}

// ------------------------------------------------------------------------------------------------ domínio

function criarProps(ctx) {
  const { cena, medidas } = ctx;
  const U = {
    gObjNoite: { value: 0 },
    gObjTempo: { value: 0 },
    gObjLuz: { value: new THREE.Color(1.0, 0.8, 0.58) },
  };
  const matObj = criarMaterialObjetos(ctx.ganchos, U);
  const matCopa = criarMaterialArvore(ctx.ganchos);
  const matPalma = criarMaterialArvore(ctx.ganchos, { duplo: true });
  // modelo, material, família e LOD de cada tipo de objeto (e as árvores em dois LODs)
  const defs = [
    { tipo: 'posteSimples', geo: modeloPoste(), mat: matObj, fam: 'resto', alc: 'postes' },
    { tipo: 'posteDuplo', geo: modeloPoste({ duplo: true }), mat: matObj, fam: 'resto', alc: 'postes' },
    { tipo: 'posteRural', geo: modeloPoste({ rural: true }), mat: matObj, fam: 'resto', alc: 'postes' },
    { tipo: 'semaforo', geo: modeloSemaforo(), mat: matObj, fam: 'resto', alc: 'postes' },
    { tipo: 'copa', geo: modeloCopa(0), mat: matCopa, fam: 'arvores', alc: 'arvores', lod: 0, sombra: true },
    { tipo: 'copa', geo: modeloCopa(1), mat: matCopa, fam: 'arvores', alc: 'arvores', lod: 1 },
    { tipo: 'palmeira', geo: modeloPalmeira(0), mat: matPalma, fam: 'arvores', alc: 'arvores', lod: 0, sombra: true },
    { tipo: 'palmeira', geo: modeloPalmeira(1), mat: matPalma, fam: 'arvores', alc: 'arvores', lod: 1 },
  ];
  const listas = defs.map((d) => {
    const L = new ListaCompactada({ geometria: d.geo.g, material: d.mat, nome: `props:${d.tipo}${d.lod ?? ''}`, bytes: ['aObj'], cap: 256 });
    L.aoCriar = (m, velha) => {
      if (velha) {
        cena.remove(velha);
        if (d.sombra) ctx.sombra.soltar(velha);
      }
      m.castShadow = false;
      medidas.familia(m, d.fam);
      cena.add(m);
      if (d.sombra) medidas.familia(ctx.sombra.projetor(m), 'sombra');
    };
    L.aoCriar(L.malha, null);
    return { ...d, L, tris: d.geo.tris };
  });
  let chave = -1;
  let tempo = 0;
  let tAnt = null;

  function compactar(vias) {
    const Pp = PERFIL_PROPS[ctx.perfil.id] ?? PERFIL_PROPS.media;
    let h = Math.imul(vias.versaoObjetos + 1, 0x01000193);
    const perto = [];
    for (const st of vias.setoresPerto(Math.max(Pp.postes, Pp.arvores))) {
      const lod = st.dist < Pp.lod0 ? 0 : 1;
      const pp = st.dist < Pp.postes ? 1 : 0;
      const aa = st.dist < Pp.arvores ? 1 : 0;
      perto.push({ st, lod, pp, aa });
      h = Math.imul(h ^ (st.s * 8 + lod * 4 + pp * 2 + aa), 0x01000193);
    }
    if (h === chave) return;
    chave = h;
    let n = 0;
    for (const d of listas) {
      const pedacos = [];
      for (const { st, lod, pp, aa } of perto) {
        if ((d.alc === 'postes' && !pp) || (d.alc === 'arvores' && !aa)) continue;
        if (d.lod !== undefined && d.lod !== lod) continue;
        const l = st.objetos?.[d.tipo];
        if (l?.n) pedacos.push(l);
      }
      n += d.L.compactar(pedacos);
      d.L.malha.visible = d.L.count > 0;
    }
    ctx.sombra.marcar();
    dom.instancias = n;
  }

  const dom = {
    nome: 'props',
    instancias: 0,
    quadro(tMs, c) {
      const vias = c.dominio('vias');
      if (!vias?.setoresPerto) return;
      compactar(vias);
      const dia = c.sol?.dia ?? 1;
      U.gObjNoite.value = Math.min(1, Math.max(0, 1 - dia * 1.4));
      // o relógio dos semáforos anda com o jogo (parado na pausa), o mesmo do tráfego
      const vel = c.sim.espelho.tempo?.velocidade ?? 1;
      if (tAnt !== null) tempo += (Math.min(100, tMs - tAnt) / 1000) * (vel > 0 ? c.sim.espelho.tempo?.mult ?? 1 : 0);
      tAnt = tMs;
      U.gObjTempo.value = c.relogioRua ?? tempo;
    },
    medidas() {
      const out = {};
      for (const d of listas) out[`${d.tipo}${d.lod ?? ''}`] = { n: d.L.count, tris: d.L.count * d.tris };
      return out;
    },
    descartar() {
      for (const d of listas) {
        cena.remove(d.L.malha);
        if (d.sombra) ctx.sombra.soltar(d.L.malha);
        d.L.descartar();
      }
      matObj.dispose();
      matCopa.dispose();
      matPalma.dispose();
    },
  };
  return dom;
}

/** Tipos de objeto que o setor devolve e este domínio desenha (a conferência dos testes). */
export const TIPOS_DESENHADOS = Object.freeze([...new Set(OBJETOS)]);

/** Modelos (para os testes: triângulos por modelo). */
export const MODELOS_PROPS = Object.freeze({
  posteSimples: () => modeloPoste(),
  posteDuplo: () => modeloPoste({ duplo: true }),
  posteRural: () => modeloPoste({ rural: true }),
  semaforo: () => modeloSemaforo(),
  copa0: () => modeloCopa(0),
  copa1: () => modeloCopa(1),
  palmeira0: () => modeloPalmeira(0),
  palmeira1: () => modeloPalmeira(1),
});

export function registrar(api) {
  api.registrarDominio('props', criarProps);
}
