// Estrutura das pontes e dos viadutos (D53, D106; dona: PONT2): sob o tabuleiro que a malha da via já desenha (render/
// geracao/malhaVia.js, greide linear nas cotas das pontas), esta peça acrescenta a viga caixão de concreto protendido
// (soleira e laterais inclinadas), o guarda-corpo de concreto nas duas bordas e os pilares com travessa (pórtico em T,
// duas colunas nos tabuleiros largos). Tudo numa malha só, uma chamada de desenho, refeita quando a rede de pontes
// muda. Os pilares vêm da mesma conta da simulação (comum/viaduto.js, pilaresDaPeca), com as mesmas vias no chão como
// obstáculo, então onde a prévia aprovou um pilar ele aparece.
//
// geometriaDaEstrutura() é pura (sem three): recebe as peças e devolve os arrays. criarViaduto(ctx, rede) liga ao
// domínio `vias` (render/mundo/vias.js).
import * as THREE from 'three';
import { tabelaArco, maisPerto } from '../../comum/bezier.js';
import { alturaEm as chaoDe } from '../../comum/altura.js';
import { ESPESSURA_TABULEIRO, pilaresDaPeca, chavePilar } from '../../comum/viaduto.js';
import { estacao } from '../geracao/malhaVia.js';
import { perfilVia } from '../geracao/perfilVia.js';
import { criarMaterial } from '../materiais/biblioteca.js';

/** Passo das estações da viga (m). */
const PASSO_VIGA = 8;
/** Medidas do guarda-corpo, do pilar e da travessa (m). */
const MEDIDAS = Object.freeze({ guardaAltura: 0.95, guardaLargura: 0.32, raioColuna: 0.85, travessaAltura: 1.1, travessaProf: 2.4, sapata: 0.6 });

/** Construtor de malha com normal plana por face. */
class Malha {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.idx = [];
  }

  /** Quadrilátero a, b, c, d (sentido anti-horário visto de fora); a normal sai do produto vetorial. */
  quad(a, b, c, d) {
    const n = normal(a, b, c);
    const k = this.pos.length / 3;
    for (const v of [a, b, c, d]) {
      this.pos.push(v[0], v[1], v[2]);
      this.nor.push(n[0], n[1], n[2]);
    }
    this.idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }

  tri(a, b, c) {
    const n = normal(a, b, c);
    const k = this.pos.length / 3;
    for (const v of [a, b, c]) {
      this.pos.push(v[0], v[1], v[2]);
      this.nor.push(n[0], n[1], n[2]);
    }
    this.idx.push(k, k + 1, k + 2);
  }

  get triangulos() {
    return this.idx.length / 3;
  }
}

function normal(a, b, c) {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const x = uy * vz - uz * vy;
  const y = uz * vx - ux * vz;
  const z = ux * vy - uy * vx;
  const L = Math.hypot(x, y, z) || 1;
  return [x / L, y / L, z / L];
}

/** Caixa alinhada ao eixo (tx, tz) com largura lateral `larg` e profundidade `prof` ao longo dele, de y0 a y1. */
function caixa(M, cx, cz, tx, tz, larg, prof, y0, y1) {
  const rx = -tz;
  const rz = tx;
  const p = (a, b, y) => [cx + rx * a * larg * 0.5 + tx * b * prof * 0.5, y, cz + rz * a * larg * 0.5 + tz * b * prof * 0.5];
  const b = [p(-1, -1, y0), p(1, -1, y0), p(1, 1, y0), p(-1, 1, y0)];
  const t = [p(-1, -1, y1), p(1, -1, y1), p(1, 1, y1), p(-1, 1, y1)];
  M.quad(t[0], t[3], t[2], t[1]); // topo
  M.quad(b[0], b[1], b[2], b[3]); // base
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    M.quad(b[i], b[j], t[j], t[i]);
  }
}

/** Coluna de oito lados de y0 a y1, com o raio dado. */
function coluna(M, cx, cz, raio, y0, y1) {
  const N = 8;
  const ang = (k) => (k / N) * Math.PI * 2;
  for (let k = 0; k < N; k++) {
    const a0 = ang(k);
    const a1 = ang(k + 1);
    const x0 = cx + Math.cos(a0) * raio;
    const z0 = cz + Math.sin(a0) * raio;
    const x1 = cx + Math.cos(a1) * raio;
    const z1 = cz + Math.sin(a1) * raio;
    M.quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0]);
    M.tri([cx, y1, cz], [x0, y1, z0], [x1, y1, z1]);
  }
}

/**
 * Geometria de uma peça de tabuleiro: viga caixão, guarda-corpos e pilares.
 * @param {Malha} M
 * @param {{ p: ArrayLike<number>, cotas: number[], meia: number }} peca
 * @param {{ chao: (x: number, z: number) => number, bloqueia?: ((x: number, z: number) => boolean) | null, vistos: Set<string> }} op
 */
function pecaDeTabuleiro(M, peca, op) {
  const { p, cotas, meia } = peca;
  const tab = tabelaArco(p);
  const L = tab[16];
  const largViga = meia * 2 - 0.4;
  const topo = 0; // a pista é a cota; a viga fica logo abaixo
  const n = Math.max(1, Math.ceil(L / PASSO_VIGA));
  const est = { x: 0, z: 0, tx: 1, tz: 0, t: 0 };
  // seção da viga caixão: laterais inclinadas, soleira a 60% da largura
  const secao = [];
  for (let i = 0; i <= n; i++) {
    const s = (L * i) / n;
    estacao(p, tab, s, est);
    const y = cotas[0] + (cotas[1] - cotas[0]) * (L > 0 ? s / L : 0);
    const rx = -est.tz;
    const rz = est.tx;
    const lado = (u, dy) => [est.x + rx * u, y + dy, est.z + rz * u];
    secao.push({
      topoE: lado(-largViga / 2, topo - 0.05), topoD: lado(largViga / 2, topo - 0.05),
      baseE: lado(-largViga * 0.3, topo - ESPESSURA_TABULEIRO), baseD: lado(largViga * 0.3, topo - ESPESSURA_TABULEIRO),
      guardaE: lado(-(meia - 0.16), 0), guardaD: lado(meia - 0.16, 0), y, tx: est.tx, tz: est.tz, rx, rz,
    });
  }
  for (let i = 0; i < n; i++) {
    const a = secao[i];
    const b = secao[i + 1];
    M.quad(a.baseE, b.baseE, b.baseD, a.baseD); // soleira
    M.quad(a.topoE, b.topoE, b.baseE, a.baseE); // lateral esquerda
    M.quad(a.baseD, b.baseD, b.topoD, a.topoD); // lateral direita
    // guarda-corpo: bloco de concreto nas duas bordas, com a face de dentro, o topo e a de fora
    for (const lado of [-1, 1]) {
      const g = lado < 0 ? 'guardaE' : 'guardaD';
      const ga = a[g];
      const gb = b[g];
      const w = MEDIDAS.guardaLargura / 2;
      const h = MEDIDAS.guardaAltura;
      const d = (q, k, y) => [q[0] + a.rx * lado * w * k, q[1] + y, q[2] + a.rz * lado * w * k];
      const dB = (q, k, y) => [q[0] + b.rx * lado * w * k, q[1] + y, q[2] + b.rz * lado * w * k];
      const ordem = lado < 0 ? 1 : -1;
      // topo
      if (ordem > 0) M.quad(d(ga, -1, h), dB(gb, -1, h), dB(gb, 1, h), d(ga, 1, h));
      else M.quad(d(ga, 1, h), dB(gb, 1, h), dB(gb, -1, h), d(ga, -1, h));
      // faces de dentro e de fora
      if (ordem > 0) {
        M.quad(d(ga, -1, -0.2), dB(gb, -1, -0.2), dB(gb, -1, h), d(ga, -1, h));
        M.quad(d(ga, 1, h), dB(gb, 1, h), dB(gb, 1, -0.2), d(ga, 1, -0.2));
      } else {
        M.quad(d(ga, 1, h), dB(gb, 1, h), dB(gb, 1, -0.2), d(ga, 1, -0.2));
        M.quad(d(ga, -1, -0.2), dB(gb, -1, -0.2), dB(gb, -1, h), d(ga, -1, h));
      }
    }
  }
  // tampas da viga nas pontas (a soleira e as laterais se fecham)
  for (const [s, sinal] of [[secao[0], -1], [secao[n], 1]]) {
    const q = [s.topoE, s.topoD, s.baseD, s.baseE];
    if (sinal > 0) M.quad(q[3], q[2], q[1], q[0]);
    else M.quad(q[0], q[1], q[2], q[3]);
  }
  // pilares: pórtico em T (uma coluna) ou duas colunas nos tabuleiros largos
  for (const pl of pilaresDaPeca(p, cotas, op.chao, op.bloqueia)) {
    const chave = chavePilar(pl.x, pl.z);
    if (op.vistos.has(chave)) continue;
    op.vistos.add(chave);
    const tx = pl.dx;
    const tz = pl.dz;
    const rx = -tz;
    const rz = tx;
    const yTopoTravessa = pl.topo;
    const yBaseTravessa = pl.topo - MEDIDAS.travessaAltura;
    const base = pl.base - MEDIDAS.sapata;
    const largT = Math.min(largViga * 0.72, meia * 2 - 2);
    caixa(M, pl.x, pl.z, tx, tz, largT, MEDIDAS.travessaProf, yBaseTravessa, yTopoTravessa);
    const duas = meia >= 10;
    const offs = duas ? [-largT * 0.28, largT * 0.28] : [0];
    for (const u of offs) {
      const cx = pl.x + rx * u;
      const cz = pl.z + rz * u;
      coluna(M, cx, cz, MEDIDAS.raioColuna * (duas ? 0.9 : 1.05), base, yBaseTravessa);
    }
  }
}

/**
 * Geometria da estrutura de todas as peças de tabuleiro.
 * @param {{ p: ArrayLike<number>, cotas: number[], meia: number }[]} pecas
 * @returns {{ pos: Float32Array, nor: Float32Array, idx: Uint32Array, triangulos: number }}
 */
export function geometriaDaEstrutura(pecas, op) {
  const M = new Malha();
  const vistos = new Set();
  for (const peca of pecas) pecaDeTabuleiro(M, peca, { chao: op.chao, bloqueia: op.bloqueia ?? null, vistos });
  return { pos: Float32Array.from(M.pos), nor: Float32Array.from(M.nor), idx: Uint32Array.from(M.idx), triangulos: M.triangulos };
}

// ------------------------------------------------------------------------------------------------ domínio

/** Função "há via no chão aqui" sobre a rede do render (as arestas que não são tabuleiro), folga de 2 m. */
function viaNoChaoDaRede(rede) {
  const caixas = new Map();
  const lista = [];
  for (const ar of rede.arestas.values()) {
    if (ar.ponte) continue;
    const m = perfilVia(ar.tipo).meia + 2;
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    for (let k = 0; k < 8; k += 2) {
      x0 = Math.min(x0, ar.p[k]);
      x1 = Math.max(x1, ar.p[k]);
      z0 = Math.min(z0, ar.p[k + 1]);
      z1 = Math.max(z1, ar.p[k + 1]);
    }
    caixas.set(ar, [x0 - m, z0 - m, x1 + m, z1 + m, m]);
    lista.push(ar);
  }
  return (x, z) => {
    for (const ar of lista) {
      const c = caixas.get(ar);
      if (x < c[0] || x > c[2] || z < c[1] || z > c[3]) continue;
      if (maisPerto(ar.p, x, z).d < c[4]) return true;
    }
    return false;
  };
}

/**
 * Liga a estrutura das pontes ao domínio `vias`: lê as arestas de tabuleiro da rede e mantém uma malha só na cena.
 * @returns {{ quadro: (tMs: number) => void, descartar: () => void, malha: THREE.Mesh, estado: () => object }}
 */
export function criarViaduto(ctx, rede) {
  const material = criarMaterial({ superficie: 'concreto', side: THREE.DoubleSide });
  const geo = new THREE.BufferGeometry();
  const malha = new THREE.Mesh(geo, material);
  malha.name = 'vias:viaduto';
  malha.castShadow = true;
  malha.receiveShadow = true;
  malha.frustumCulled = false;
  malha.visible = false;
  ctx.cena.add(malha);
  let versao = -1;
  let assinatura = '';
  let triangulos = 0;
  let pecas = 0;

  function refazer() {
    const T = ctx.sim.espelho.terreno;
    const lista = [];
    for (const ar of rede.arestas.values()) if (ar.ponte) lista.push({ p: ar.p, cotas: ar.cotas, meia: perfilVia(ar.tipo).meia, e: ar.e });
    lista.sort((a, b) => a.e - b.e);
    const sig = lista.map((l) => `${l.e}:${l.cotas[0].toFixed(2)},${l.cotas[1].toFixed(2)}:${Array.from(l.p, (v) => v.toFixed(1)).join(',')}:${l.meia}`).join('|');
    if (sig === assinatura) return;
    assinatura = sig;
    pecas = lista.length;
    if (!lista.length) {
      malha.visible = false;
      triangulos = 0;
      return;
    }
    const chao = (x, z) => ctx.sim.alturaEm?.(x, z) ?? 0;
    geo.dispose(); // solta os buffers antigos da GPU antes de trocar os atributos
    const g = geometriaDaEstrutura(lista, { chao: T ? (x, z) => chaoDe(T, x, z) : chao, bloqueia: viaNoChaoDaRede(rede) });
    geo.setAttribute('position', new THREE.BufferAttribute(g.pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(g.nor, 3));
    geo.setIndex(new THREE.BufferAttribute(g.idx, 1));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    triangulos = g.triangulos;
    malha.visible = true;
  }

  return {
    malha,
    quadro() {
      if (rede.versao === versao) return;
      versao = rede.versao;
      refazer();
    },
    estado: () => ({ pecas, triangulos, visivel: malha.visible }),
    descartar() {
      ctx.cena.remove(malha);
      geo.dispose();
      material.dispose();
    },
  };
}
