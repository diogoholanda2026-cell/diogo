// Objetos da rua (desenho do render 4.4, 9.1): postes (urbano, duplo no canteiro, rural de concreto) e semáforos nos
// cruzamentos de avenida. As posições saem do setor de vias (cruzamento.js, na oficina) e chegam por
// ctx.dominio('vias').setoresPerto(); aqui ficam só os modelos (poucos triângulos, medidas reais) e as listas de
// instâncias compactadas com os setores perto (instancias.js): uma chamada por modelo. A lâmpada dos postes acende à
// noite (e a poça de luz no chão sai do mapa de luz da rua, luzRua.js); o semáforo acende o foco da fase (ciclo de 40 s
// por cruzamento, a mesma conta do tráfego).
// As árvores de rua do setor (listas 'copa' e 'palmeira') não são desenhadas aqui (VIS1b): o domínio 'vegetacao' as
// planta com as espécies da R2b (oiti na calçada e no canteiro, palmeira-imperial no canteiro da avenida), em LOD0,
// LOD1 e impostor, no mesmo espaçamento (mundo/vegetacao.js, arvoresDaRua). A copa facetada de icosaedros saiu.
import * as THREE from 'three';
import { ListaCompactada } from './instancias.js';
import { OBJETOS } from '../geracao/cruzamento.js';
import * as SH from '../materiais/shaders/via.glsl.js';
import { porPerfil } from '../motor/perfis.js';

/** Alcance dos postes e semáforos por perfil (m do setor). As árvores de rua seguem o PERFIL_VEGETACAO. */
export const PERFIL_PROPS = Object.freeze({
  ultra: { postes: 900 },
  alta: { postes: 600 },
  media: { postes: 380 },
  leve: { postes: 200 },
});
/** Listas do setor de vias que o domínio 'vegetacao' desenha (as árvores de rua), e não este. */
export const ARVORES_DA_RUA = Object.freeze(['copa', 'palmeira']);

/** Partes dos objetos (aParte; via.glsl.js OBJ_*). */
const P = Object.freeze({ METAL: 0, CONCRETO: 1, LAMPADA: 2, VERMELHO: 3, AMARELO: 4, VERDE: 5, CAIXA: 6 });

// ------------------------------------------------------------------------------------------------ modelos

class Geo {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.parte = [];
    this.idx = [];
  }

  get nv() {
    return this.pos.length / 3;
  }

  v(x, y, z, nx, ny, nz, parte) {
    this.pos.push(x, y, z);
    const c = Math.hypot(nx, ny, nz) || 1;
    this.nor.push(nx / c, ny / c, nz / c);
    this.parte.push(parte);
    return this.nv - 1;
  }

  /** Quadrilátero plano (anti-horário visto de fora). */
  quad(a, b, c, d, parte) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const i = [a, b, c, d].map((p) => this.v(p[0], p[1], p[2], n[0], n[1], n[2], parte));
    this.idx.push(i[0], i[1], i[2], i[0], i[2], i[3]);
  }

  /** Caixa de x0..x1, y0..y1, z0..z1 (sem o fundo, a não ser com fundo). */
  caixa(x0, y0, z0, x1, y1, z1, parte, { fundo = false, parteFundo = parte } = {}) {
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], parte);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], parte);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], parte);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], parte);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], parte);
    if (fundo) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], parteFundo);
  }

  /** Tronco de cone de n lados no eixo y (sem tampas), normais suaves. */
  cone(x, z, y0, y1, r0, r1, n, parte) {
    const base = this.nv;
    const inc = (r0 - r1) / (y1 - y0);
    for (let k = 0; k <= n; k++) {
      const a = (2 * Math.PI * k) / n;
      const c = Math.cos(a);
      const s = Math.sin(a);
      this.v(x + c * r0, y0, z + s * r0, c, inc, s, parte);
      this.v(x + c * r1, y1, z + s * r1, c, inc, s, parte);
    }
    for (let k = 0; k < n; k++) {
      const a = base + 2 * k;
      this.idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }

  geometria() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aParte', new THREE.Float32BufferAttribute(this.parte, 1));
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

// ------------------------------------------------------------------------------------------------ domínio

function criarProps(ctx) {
  const { cena, medidas } = ctx;
  const U = {
    gObjNoite: { value: 0 },
    gObjTempo: { value: 0 },
    gObjLuz: { value: new THREE.Color(1.0, 0.8, 0.58) },
  };
  const matObj = criarMaterialObjetos(ctx.ganchos, U);
  // modelo de cada tipo de objeto (um material e uma chamada por modelo)
  const defs = [
    { tipo: 'posteSimples', geo: modeloPoste() },
    { tipo: 'posteDuplo', geo: modeloPoste({ duplo: true }) },
    { tipo: 'posteRural', geo: modeloPoste({ rural: true }) },
    { tipo: 'semaforo', geo: modeloSemaforo() },
  ];
  const listas = defs.map((d) => {
    const L = new ListaCompactada({ geometria: d.geo.g, material: matObj, nome: `props:${d.tipo}`, bytes: ['aObj'], cap: 256 });
    L.aoCriar = (m, velha) => {
      if (velha) cena.remove(velha);
      m.castShadow = false;
      medidas.familia(m, 'resto');
      cena.add(m);
    };
    L.aoCriar(L.malha, null);
    return { ...d, L, tris: d.geo.tris };
  });
  let chave = -1;
  let tempo = 0;
  let tAnt = null;

  function compactar(vias) {
    const Pp = porPerfil(PERFIL_PROPS, ctx.perfil);
    let h = Math.imul(vias.versaoObjetos + 1, 0x01000193);
    // setoresPerto é um gerador: vira lista (a chave e as listas passam duas vezes por ela)
    const perto = [...vias.setoresPerto(Pp.postes)];
    for (const st of perto) h = Math.imul(h ^ st.s, 0x01000193);
    if (h === chave) return;
    chave = h;
    let n = 0;
    for (const d of listas) {
      const pedacos = [];
      for (const st of perto) {
        const l = st.objetos?.[d.tipo];
        if (l?.n) pedacos.push(l);
      }
      n += d.L.compactar(pedacos);
      d.L.malha.visible = d.L.count > 0;
    }
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
      for (const d of listas) out[d.tipo] = { n: d.L.count, tris: d.L.count * d.tris };
      return out;
    },
    descartar() {
      for (const d of listas) {
        cena.remove(d.L.malha);
        d.L.descartar();
      }
      matObj.dispose();
    },
  };
  return dom;
}

/** Tipos de objeto que o setor devolve e este domínio desenha (a conferência dos testes); as árvores vão à vegetação. */
export const TIPOS_DESENHADOS = Object.freeze([...new Set(OBJETOS)].filter((t) => !ARVORES_DA_RUA.includes(t)));

/** Modelos (para os testes: triângulos por modelo). */
export const MODELOS_PROPS = Object.freeze({
  posteSimples: () => modeloPoste(),
  posteDuplo: () => modeloPoste({ duplo: true }),
  posteRural: () => modeloPoste({ rural: true }),
  semaforo: () => modeloSemaforo(),
});

export function registrar(api) {
  api.registrarDominio('props', criarProps);
}
