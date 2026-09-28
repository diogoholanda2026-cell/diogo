// Cidade sintética: espelho gerado PELAS APIS da simulação (addAresta do grafo, alocar() das tabelas, o substituto de
// células da S1b e o de crescimento da S2a, que põe o prédio de frente para a célula). 4 x 4 km com ruas e avenidas em
// curva, 12 mil prédios de todas as zonas e níveis em lotes geminados (cada bairro cheio do centro para a borda, com
// quintais e loteamentos por ocupar na vegetação), mata, mar, rio, lagoa e a Torre. Serve ao render e à UI antes da
// cidade de verdade existir (?sintetica=1 no navegador) e aos testes dos invariantes do espelho.
//
// No navegador:  import { gerarCidadeSintetica } from '../../ferramentas/cidade-sintetica.mjs';
//                const { sim } = gerarCidadeSintetica();            // ou gerarCidadeSintetica({ sim }) numa já criada
// No Node:       node ferramentas/cidade-sintetica.mjs [--predios 12000]   (confere os invariantes e mede)
import { criarSimulacao } from '../fonte/sim/estado.js';
import { criarSim } from '../fonte/sim/nucleo.js';
import { addNo, addAresta, removerNo, meiaDa, adjacencia, tipoDa } from '../fonte/sim/vias/grafo.js';
import { celulasDaAresta, crescerNaFrente } from '../fonte/sim/substitutos.js';
import { somarPredios } from '../fonte/sim/agregados.js';
import { conferirEspelho } from '../fonte/contratos/espelho.js';
import { AGUA, ARESTA, CELULA, ETAPA, LADRILHO, PREDIO, MAO } from '../fonte/contratos/flags.js';
import { alturaEm } from '../fonte/comum/altura.js';
import { smoothstep, clamp, cos, hipot, pot, sen } from '../fonte/comum/util.js';
import { hashCoordF } from '../fonte/comum/hash.js';
import { ponto, maisPerto, caixa as caixaBz, tabelaArco, tDoArco } from '../fonte/comum/bezier.js';
import { aEstrela } from '../fonte/comum/caminhos.js';
import { GLEBA_ENVELOPE, TORRE_POSICAO } from '../fonte/data/arcologia-plano.js';
import { PREDIOS, modelosDaZona } from '../fonte/data/predios.js';
import { ZONAS_ORDEM } from '../fonte/data/zonas.js';
import { VIAS } from '../fonte/data/vias.js';

// predios: a cidade cheia dá cerca de 12 mil (o gerador enche os bairros de ruas; o número exato sai no resumo)
export const SINTETICA = Object.freeze({ lado: 4096, predios: 12000, semente: 'sintetica-1' });

const MEIO = SINTETICA.lado / 2; // a cidade ocupa [-2048, 2048] nos dois eixos

// ------------------------------------------------------------------------------------------------ relevo

function ruido(x, z, s) {
  const i = Math.floor(x);
  const j = Math.floor(z);
  const fx = x - i;
  const fz = z - j;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hashCoordF(i, j, s);
  const b = hashCoordF(i + 1, j, s);
  const c = hashCoordF(i, j + 1, s);
  const d = hashCoordF(i + 1, j + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, z, s, oitavas = 4) {
  let t = 0;
  let amp = 0.5;
  let f = 1;
  for (let k = 0; k < oitavas; k++) {
    t += amp * ruido(x * f, z * f, s + k * 17);
    amp *= 0.5;
    f *= 2.03;
  }
  return t;
}

// costa: baía ao sul e a leste
const costaSul = (x) => 1790 + 110 * sen(x / 640 + 0.7) + 50 * sen(x / 230);
const costaLeste = (z) => 1900 + 90 * sen(z / 520 + 1.3);
// rio Held: dos morros a noroeste até a baía
const RIO = [
  [-3000, -3000], [-2300, -2000], [-1850, -1350], [-1480, -650], [-1200, 150], [-980, 850], [-800, 1400], [-700, 2100],
];
const LARGURA_RIO = 70;
const FAIXA_RIO = LARGURA_RIO / 2 + 60;
const LAGOA = { x: -1560, z: 1300, r: 240, nivel: 1 };

function distRio(x, z) {
  let m = Infinity;
  for (let k = 0; k + 1 < RIO.length; k++) {
    const [ax, az] = RIO[k];
    const [bx, bz] = RIO[k + 1];
    if (x < Math.min(ax, bx) - m || x > Math.max(ax, bx) + m || z < Math.min(az, bz) - m || z > Math.max(az, bz) + m) continue;
    const vx = bx - ax;
    const vz = bz - az;
    let t = ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz);
    t = clamp(t, 0, 1);
    m = Math.min(m, hipot(x - ax - vx * t, z - az - vz * t));
  }
  return m;
}

const [GX0, GZ0, GX1, GZ1] = GLEBA_ENVELOPE.caixa;
const naGleba = (x, z, folga = 0) => x >= GX0 - folga && x <= GX1 + folga && z >= GZ0 - folga && z <= GZ1 + folga;

/** Altura e água do relevo sintético num ponto. */
function relevo(x, z, s) {
  let h = 8 + 7 * (fbm(x / 900, z / 900, s, 3) - 0.5);
  const norte = smoothstep(-1650, -2900, z);
  const oeste = smoothstep(-1850, -2900, x);
  if (norte > 0) h += 260 * norte * (0.55 + 0.6 * fbm(x / 500, z / 500, s + 5, 3));
  if (oeste > 0) h += 200 * oeste * (0.5 + 0.6 * fbm(x / 450, z / 450, s + 9, 3));
  // platô da gleba
  const dg = Math.max(GX0 - x, x - GX1, GZ0 - z, z - GZ1, 0);
  if (dg < 120) h += (GLEBA_ENVELOPE.cota - h) * (1 - smoothstep(0, 120, dg));
  let agua = AGUA.TERRA;
  // mar
  const mar = Math.max(z - costaSul(x), x - costaLeste(z));
  if (mar > -120) h = h + (-(mar > 0 ? 3 + mar * 0.03 : 0) - h) * smoothstep(-120, 40, mar);
  if (mar > 0) agua = AGUA.MAR;
  // rio
  if (x < -560) {
    const dr = distRio(x, z);
    if (dr < FAIXA_RIO) {
      h = h + (-1.5 - h) * (1 - smoothstep(LARGURA_RIO / 2, FAIXA_RIO, dr));
      if (dr < LARGURA_RIO / 2 && agua === AGUA.TERRA) agua = AGUA.RIO;
    }
  }
  // lagoa
  const dl = hipot(x - LAGOA.x, z - LAGOA.z);
  if (dl < LAGOA.r + 80) {
    h = h + (LAGOA.nivel - 1.2 - h) * (1 - smoothstep(LAGOA.r, LAGOA.r + 80, dl));
    if (dl < LAGOA.r && agua === AGUA.TERRA) agua = AGUA.LAGOA;
  }
  return [h, agua];
}

function gerarTerreno(sim, s) {
  const n = 1025;
  const passo = 8;
  const origem = [-4096, -4096];
  const altura = new Float32Array(n * n);
  const agua = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) {
    const z = origem[1] + j * passo;
    for (let i = 0; i < n; i++) {
      const [h, a] = relevo(origem[0] + i * passo, z, s);
      altura[j * n + i] = h;
      agua[j * n + i] = a;
    }
  }
  const rios = [{ id: 'held', pontos: Float64Array.from(RIO.flatMap(([x, z]) => [x, z, -0.5, LARGURA_RIO])) }];
  const lagoas = [];
  const cont = [];
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2;
    cont.push(LAGOA.x + cos(a) * LAGOA.r, LAGOA.z + sen(a) * LAGOA.r);
  }
  lagoas.push({ id: 'lagoa', nivel: LAGOA.nivel, contorno: Float64Array.from(cont) });
  sim.espelho.terreno = { n, passo, origem, altura, agua, rios, lagoas };
  sim.mudancas.tudo('terreno');
  return sim.espelho.terreno;
}

function aguaEm(t, x, z) {
  const i = Math.round((x - t.origem[0]) / t.passo);
  const j = Math.round((z - t.origem[1]) / t.passo);
  if (i < 0 || j < 0 || i >= t.n || j >= t.n) return AGUA.MAR;
  return t.agua[j * t.n + i];
}

// ------------------------------------------------------------------------------------------------ malha viária

// torção suave que curva as ruas sem cruzar (amplitude x 2 pi / comprimento de onda bem abaixo de 1); `ondula` dá
// curvas de verdade dentro de cada trecho (bairros-jardim)
function torcer(x, z, ondula = 0) {
  let tx = x + 16 * sen(z / 610 + 0.4) + 7 * sen((x + z) / 330);
  let tz = z + 16 * sen(x / 700 + 1.1) + 7 * sen((x - z) / 390);
  if (ondula) {
    tx += ondula * sen(z / 40 + 0.7);
    tz += ondula * sen(x / 44 + 2.1);
  }
  return [tx, tz];
}

// bairros: centro, rotação, passo da grade e mistura de zonas
// [resBaixa, resMedia, resAlta, comBaixa, comAlta, escritorio, industria]. Cada bairro fica com a sua célula de Voronoi
// (menos uma faixa de 50 m na divisa, onde correm as avenidas grandes). Os `vazio` não têm ruas (a várzea do rio, a
// lagoa e o pé dos morros): cerca de 12 mil prédios enchem os seis bairros de ruas em vez de espalhar em nove. Com um
// teto de prédios menor (--predios), `cresce` abaixo de 1 adianta o bairro na ordem de crescimento.
const BAIRROS = [
  { nome: 'Centro', c: [-230, -470], rot: 0, passo: [224, 128], mistura: [0, 2, 3, 1, 3, 3, 0], cresce: 0.5 },
  { nome: 'Norte', ondula: 8, c: [700, -1300], rot: 0.18, passo: [88, 88], mistura: [5, 2, 0, 3, 0, 0, 0] },
  { nome: 'Noroeste', vazio: true, c: [-700, -1450], rot: -0.09, passo: [88, 88], mistura: [5, 2, 0, 3, 0, 0, 0] },
  { nome: 'Leste', c: [1400, -350], rot: -0.12, passo: [128, 208], mistura: [0, 1, 0, 1, 0, 0, 5] },
  { nome: 'Sudeste', c: [1250, 520], rot: 0.03, passo: [88, 88], mistura: [2, 3, 1, 3, 1, 1, 0] },
  { nome: 'Orla', c: [1050, 1400], rot: 0.34, passo: [208, 128], mistura: [0, 2, 4, 1, 2, 1, 0], cresce: 0.6 },
  { nome: 'Sudoeste', vazio: true, ondula: 8, c: [-620, 780], rot: 0.05, passo: [88, 88], mistura: [5, 2, 0, 3, 0, 0, 0] },
  { nome: 'Poente', c: [-1650, -620], rot: -0.2, passo: [88, 88], mistura: [5, 1, 0, 3, 0, 0, 1] },
  { nome: 'Lagoa', vazio: true, ondula: 8, c: [-1700, 500], rot: 0.12, passo: [88, 88], mistura: [5, 2, 0, 2, 0, 0, 0] },
];
const FAIXA_DIVISA = 40;

// raster de ocupação das vias (4 m) para os bairros não se sobreporem
class Raster {
  constructor() {
    this.passo = 4;
    this.lado = Math.ceil(SINTETICA.lado / this.passo) + 64;
    this.o = -MEIO - 128;
    this.d = new Uint8Array(this.lado * this.lado);
  }
  _ij(x, z) {
    return [Math.floor((x - this.o) / this.passo), Math.floor((z - this.o) / this.passo)];
  }
  carimbar(x, z, r, v) {
    const [ci, cj] = this._ij(x, z);
    const k = Math.ceil(r / this.passo);
    for (let j = cj - k; j <= cj + k; j++) {
      for (let i = ci - k; i <= ci + k; i++) {
        if (i < 0 || j < 0 || i >= this.lado || j >= this.lado) continue;
        const dx = this.o + (i + 0.5) * this.passo - x;
        const dz = this.o + (j + 0.5) * this.passo - z;
        if (dx * dx + dz * dz <= r * r) this.d[j * this.lado + i] = v;
      }
    }
  }
  /** true se há via de outro dono (v diferente de `dono`) no disco. */
  outro(x, z, r, dono) {
    const [ci, cj] = this._ij(x, z);
    const k = Math.ceil(r / this.passo);
    for (let j = cj - k; j <= cj + k; j++) {
      for (let i = ci - k; i <= ci + k; i++) {
        if (i < 0 || j < 0 || i >= this.lado || j >= this.lado) continue;
        const v = this.d[j * this.lado + i];
        if (!v || v === dono) continue;
        const dx = this.o + (i + 0.5) * this.passo - x;
        const dz = this.o + (j + 0.5) * this.passo - z;
        if (dx * dx + dz * dz <= r * r) return true;
      }
    }
    return false;
  }
}

function amostrasDaCurva(p, passo) {
  const tab = tabelaArco(p);
  const total = tab[16];
  const n = Math.max(2, Math.ceil(total / passo));
  const pts = [];
  const q = [0, 0];
  for (let i = 0; i <= n; i++) {
    const s = (total * i) / n;
    ponto(p, tDoArco(tab, s), q);
    pts.push([q[0], q[1], s, total]);
  }
  return pts;
}

// a curva de uma aresta de grade: controles a um terço e a dois terços, torcidos
function curvaTorcida(ax, az, bx, bz, ondula = 0) {
  const [x0, z0] = torcer(ax, az, ondula);
  const [x3, z3] = torcer(bx, bz, ondula);
  const [x1, z1] = torcer(ax + (bx - ax) / 3, az + (bz - az) / 3, ondula);
  const [x2, z2] = torcer(ax + (2 * (bx - ax)) / 3, az + (2 * (bz - az)) / 3, ondula);
  return [x0, z0, x1, z1, x2, z2, x3, z3];
}

function trechoValido(T, p, tipo, { agua = false, folgaPontas = 0 } = {}) {
  const pts = amostrasDaCurva(p, 8);
  const decl = VIAS[tipo].declive;
  let hAnt = null;
  let sAnt = 0;
  for (const [x, z, s, total] of pts) {
    if (Math.abs(x) > MEIO + 1400 || Math.abs(z) > MEIO + 1400) return false;
    if (s < folgaPontas || s > total - folgaPontas) {
      hAnt = alturaEm(T, x, z);
      sAnt = s;
      continue;
    }
    if (!agua && aguaEm(T, x, z) !== AGUA.TERRA) return false;
    if (naGleba(x, z, 24)) return false;
    const h = alturaEm(T, x, z);
    if (hAnt !== null && s > sAnt && Math.abs(h - hAnt) / (s - sAnt) > decl) return false;
    hAnt = h;
    sAnt = s;
  }
  return true;
}

function livreDeOutros(R, p, tipo, dono, folga, folgaPontas = 0) {
  const meia = VIAS[tipo].largura / 2;
  for (const [x, z, s, total] of amostrasDaCurva(p, 6)) {
    if (s < folgaPontas || s > total - folgaPontas) continue;
    if (R.outro(x, z, meia + folga, dono)) return false;
  }
  return true;
}

function carimbarVia(R, p, tipo, dono) {
  const meia = VIAS[tipo].largura / 2;
  for (const [x, z] of amostrasDaCurva(p, 4)) R.carimbar(x, z, meia + 2, dono);
}

function arestaComCurva(G, a, b, tipo, p, op) {
  return addAresta(G, a, b, tipo, [p[2], p[3]], [p[4], p[5]], op);
}

function gerarVias(sim, T, rng) {
  const G = sim.grafo;
  const R = new Raster();
  let dono = 1;
  // rodovia pelo norte, com a ponte pronta sobre o rio
  const rod = [[-4000, -1550], [-2650, -1420], [-1500, -1260], [-420, -1600], [900, -1660], [2300, -1560], [4000, -1350]];
  const nosRod = rod.map(([x, z]) => addNo(G, x, z, Math.max(2, alturaEm(T, x, z))));
  for (let k = 0; k + 1 < rod.length; k++) {
    const [ax, az] = rod[k];
    const [bx, bz] = rod[k + 1];
    const mx = (ax + bx) / 2 + (bz - az) * 0.08;
    const mz = (az + bz) / 2 - (bx - ax) * 0.08;
    const p = [ax, az, ax + (mx - ax) * 0.9, az + (mz - az) * 0.9, bx + (mx - bx) * 0.9, bz + (mz - bz) * 0.9, bx, bz];
    const ponte = amostrasDaCurva(p, 8).some(([x, z]) => aguaEm(T, x, z) !== AGUA.TERRA);
    arestaComCurva(G, nosRod[k], nosRod[k + 1], 'rodovia', p, { flags: ARESTA.RODOVIA | (ponte ? ARESTA.PONTE : 0) });
    carimbarVia(R, p, 'rodovia', dono);
  }
  dono++;
  // bairros em grade torcida, cada um na sua célula de Voronoi
  const bairros = [];
  const dono0 = (x, z, b) => {
    const d = hipot(x - b.c[0], z - b.c[1]);
    for (const o of BAIRROS) if (o !== b && hipot(x - o.c[0], z - o.c[1]) - d < FAIXA_DIVISA) return false;
    return true;
  };
  for (const b of BAIRROS) {
    const d = dono++;
    if (b.vazio) {
      bairros.push({ ...b, dono: d, nos: [], arestas: [] });
      continue;
    }
    const c = cos(b.rot);
    const s = sen(b.rot);
    const [px, pz] = b.passo;
    const K = Math.ceil(3200 / Math.min(px, pz));
    const idx = new Map();
    const pos = (i, j) => [b.c[0] + c * i * px - s * j * pz, b.c[1] + s * i * px + c * j * pz];
    for (let j = -K; j <= K; j++) {
      for (let i = -K; i <= K; i++) {
        const [x0, z0] = pos(i, j);
        if (Math.abs(x0) > MEIO + 200 || Math.abs(z0) > MEIO + 200) continue;
        const [x, z] = torcer(x0, z0, b.ondula ?? 0);
        if (Math.abs(x) > MEIO - 30 || Math.abs(z) > MEIO - 30) continue;
        if (!dono0(x0, z0, b)) continue;
        if (aguaEm(T, x, z) !== AGUA.TERRA || naGleba(x, z, 30)) continue;
        if (R.outro(x, z, 40, d)) continue;
        idx.set(`${i},${j}`, addNo(G, x, z));
      }
    }
    const arestas = [];
    const tipoDaLinha = (vertical, k) => {
      if (k % 5 === 0) return 'avenida';
      return hashCoordF(k, vertical ? 1 : 2, d) < 0.12 ? 'ruaMao' : 'rua';
    };
    for (let j = -K; j <= K; j++) {
      for (let i = -K; i <= K; i++) {
        const a = idx.get(`${i},${j}`);
        if (a === undefined) continue;
        for (const [di, dj] of [[1, 0], [0, 1]]) {
          const bb = idx.get(`${i + di},${j + dj}`);
          if (bb === undefined) continue;
          const vertical = di === 0;
          const tipo = tipoDaLinha(vertical, vertical ? i : j);
          const [ax, az] = pos(i, j);
          const [bx, bz] = pos(i + di, j + dj);
          const p = curvaTorcida(ax, az, bx, bz, b.ondula ?? 0);
          if (!trechoValido(T, p, tipo) || !livreDeOutros(R, p, tipo, d, 34)) continue;
          const mao = tipo === 'ruaMao' ? (((vertical ? i : j) % 2) + 2) % 2 ? MAO.AB : MAO.BA : MAO.DUPLA;
          const e = arestaComCurva(G, a, bb, tipo, p, { mao });
          if (e >= 0) {
            arestas.push(e);
            carimbarVia(R, p, tipo, d);
          }
        }
      }
    }
    bairros.push({ ...b, dono: d, nos: [...idx.values()], arestas });
  }
  // avenidas grandes em curva ligando os bairros (e um bairro à rodovia)
  const ligacoes = [];
  const bordas = (b) => b.nos.filter((n) => G.nos.viva[n] && G.nos.grau[n] > 0 && G.nos.grau[n] < 4);
  const pares = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 6], [0, 7], [1, 2], [1, 3], [3, 4], [4, 5], [6, 8], [7, 8], [2, 7]];
  for (const [ia, ib] of pares) {
    const A = bordas(bairros[ia]);
    const B = bordas(bairros[ib]);
    const cand = [];
    for (const a of A) {
      for (const b of B) {
        const dd = hipot(G.nos.x[a] - G.nos.x[b], G.nos.z[a] - G.nos.z[b]);
        if (dd > 90 && dd < 900) cand.push([dd, a, b]);
      }
    }
    cand.sort((u, v) => u[0] - v[0] || u[1] - v[1] || u[2] - v[2]);
    let feitas = 0;
    for (const [, a, b] of cand) {
      if (feitas >= 2) break;
      const ax = G.nos.x[a];
      const az = G.nos.z[a];
      const bx = G.nos.x[b];
      const bz = G.nos.z[b];
      const curva = (rng.f() - 0.5) * 0.5;
      const mx = (ax + bx) / 2 + (bz - az) * curva;
      const mz = (az + bz) / 2 - (bx - ax) * curva;
      const p = [ax, az, ax + ((mx - ax) * 2) / 3, az + ((mz - az) * 2) / 3, bx + ((mx - bx) * 2) / 3, bz + ((mz - bz) * 2) / 3, bx, bz];
      if (!trechoValido(T, p, 'avenidaG', { folgaPontas: 20 }) || !livreDeOutros(R, p, 'avenidaG', 250, 14, 40)) continue;
      const e = arestaComCurva(G, a, b, 'avenidaG', p);
      if (e >= 0) {
        carimbarVia(R, p, 'avenidaG', 250);
        ligacoes.push(e);
        feitas++;
      }
    }
  }
  // acesso da rodovia ao Centro
  {
    const A = bordas(bairros[0]).sort((u, v) => G.nos.z[u] - G.nos.z[v] || u - v);
    const r = nosRod[3];
    for (const a of A.slice(0, 6)) {
      const p = [G.nos.x[r], G.nos.z[r], 0, 0, 0, 0, G.nos.x[a], G.nos.z[a]];
      p[2] = p[0] + (p[6] - p[0]) / 3 + 40;
      p[3] = p[1] + (p[7] - p[1]) / 3;
      p[4] = p[0] + ((p[6] - p[0]) * 2) / 3;
      p[5] = p[1] + ((p[7] - p[1]) * 2) / 3 - 30;
      if (!trechoValido(T, p, 'avenidaG', { folgaPontas: 20 }) || !livreDeOutros(R, p, 'avenidaG', 250, 12, 60)) continue;
      const e = arestaComCurva(G, r, a, 'avenidaG', p);
      if (e >= 0) {
        carimbarVia(R, p, 'avenidaG', 250);
        ligacoes.push(e);
        break;
      }
    }
  }
  // vias internas da Arcologia: anel em volta da Torre
  const anel = [];
  const cx = TORRE_POSICAO.x;
  const cz = TORRE_POSICAO.z - 40;
  const raio = 200;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    anel.push(addNo(G, cx + cos(a) * raio, cz + sen(a) * raio, GLEBA_ENVELOPE.cota));
  }
  const kappa = 0.5523 * raio;
  for (let k = 0; k < 4; k++) {
    const a0 = (k / 4) * Math.PI * 2;
    const a1 = ((k + 1) / 4) * Math.PI * 2;
    const p1 = [cx + cos(a0) * raio - sen(a0) * kappa, cz + sen(a0) * raio + cos(a0) * kappa];
    const p2 = [cx + cos(a1) * raio + sen(a1) * kappa, cz + sen(a1) * raio - cos(a1) * kappa];
    addAresta(G, anel[k], anel[(k + 1) % 4], 'avenida', p1, p2, { flags: ARESTA.ARCOLOGIA });
  }
  // ruas de terra de uma vila na foz do rio (só onde não bate em outra via)
  const vila = [];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) vila.push(addNo(G, -600 + i * 70, 1560 + j * 60));
  const terra = (a, b) => {
    const p = [G.nos.x[a], G.nos.z[a], 0, 0, 0, 0, G.nos.x[b], G.nos.z[b]];
    p[2] = p[0] + (p[6] - p[0]) / 3;
    p[3] = p[1] + (p[7] - p[1]) / 3;
    p[4] = p[0] + ((p[6] - p[0]) * 2) / 3;
    p[5] = p[1] + ((p[7] - p[1]) * 2) / 3;
    if (!trechoValido(T, p, 'terra') || !livreDeOutros(R, p, 'terra', 251, 20)) return;
    if (addAresta(G, a, b, 'terra') >= 0) carimbarVia(R, p, 'terra', 251);
  };
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) terra(vila[j * 4 + i], vila[j * 4 + i + 1]);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i += 3) terra(vila[j * 4 + i], vila[(j + 1) * 4 + i]);
  // nós que ficaram sem aresta
  for (let n = 0; n < G.nos.n; n++) if (G.nos.viva[n] && G.nos.grau[n] === 0) removerNo(G, n);
  return { bairros, ligacoes };
}

// ------------------------------------------------------------------------------------------------ células e prédios

function gerarCelulas(sim, T) {
  const G = sim.grafo;
  const A = G.arestas;
  const C = sim.tabelas.celulas;
  const mp = { t: 0, d: 0, x: 0, z: 0 };
  const caixas = new Float64Array(A.n * 4);
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e]) continue;
    const c = caixaBz(A.p, 8 * e, meiaDa(G, e) + 4);
    caixas.set(c, 4 * e);
  }
  const blocos = [];
  const valida = (e) => (x, z) => {
    if (Math.abs(x) > MEIO - 4 || Math.abs(z) > MEIO - 4) return false;
    if (naGleba(x, z, 8)) return false;
    for (const [dx, dz] of [[0, 0], [-4, -4], [4, -4], [-4, 4], [4, 4]]) if (aguaEm(T, x + dx, z + dz) !== AGUA.TERRA) return false;
    let hmin = Infinity;
    let hmax = -Infinity;
    for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
      const h = alturaEm(T, x + dx, z + dz);
      hmin = Math.min(hmin, h);
      hmax = Math.max(hmax, h);
    }
    if (hmax - hmin > 4) return false;
    const ids = G.gradeArestas.consultar(x - 40, z - 40, x + 40, z + 40);
    for (let k = 0; k < ids.length; k++) {
      const o = ids[k];
      if (o === e || !A.viva[o]) continue;
      const c = 4 * o;
      if (x < caixas[c] || x > caixas[c + 2] || z < caixas[c + 1] || z > caixas[c + 3]) continue;
      maisPerto(A.p, x, z, 8 * o, mp);
      if (mp.d < meiaDa(G, o) + 4) return false;
    }
    return true;
  };
  const nArestas = A.n;
  for (let e = 0; e < nArestas; e++) {
    if (!A.viva[e]) continue;
    const tipo = tipoDa(G, e);
    if (!tipo.zona || A.flags[e] & (ARESTA.ARCOLOGIA | ARESTA.RODOVIA)) continue;
    const { lados } = celulasDaAresta(sim, e, { valida: valida(e) });
    for (const lado of [1, -1]) if (lados[lado].length) blocos.push({ e, lado, colunas: lados[lado] });
  }
  // esquinas: duas células de blocos diferentes a menos de 7 m, fica a de linha menor (empate: bloco mais antigo)
  const ordem = [];
  for (let c = 0; c < C.n; c++) if (C.viva[c] && C.estado[c] === CELULA.LIVRE) ordem.push(c);
  ordem.sort((a, b) => C.linha[a] - C.linha[b] || C.aresta[a] - C.aresta[b] || C.lado[a] - C.lado[b] || a - b);
  const balde = new Map();
  const chave = (i, j) => i * 100003 + j;
  let invalidas = 0;
  for (const c of ordem) {
    const x = C.x[c];
    const z = C.z[c];
    const bi = Math.floor(x / 8);
    const bj = Math.floor(z / 8);
    let perto = false;
    for (let dj = -1; dj <= 1 && !perto; dj++) {
      for (let di = -1; di <= 1 && !perto; di++) {
        for (const o of balde.get(chave(bi + di, bj + dj)) ?? []) {
          if (C.aresta[o] === C.aresta[c] && C.lado[o] === C.lado[c]) continue;
          if (hipot(C.x[o] - x, C.z[o] - z) < 7) {
            perto = true;
            break;
          }
        }
      }
    }
    if (perto) {
      C.estado[c] = CELULA.INVALIDA;
      C.marcar(c);
      invalidas++;
      continue;
    }
    const k = chave(bi, bj);
    const l = balde.get(k);
    if (l) l.push(c);
    else balde.set(k, [c]);
  }
  return { blocos, invalidasEsquina: invalidas };
}

const ZONA_IDX = (id) => ZONAS_ORDEM.indexOf(id);
const ZONAS_MISTURA = ['resBaixa', 'resMedia', 'resAlta', 'comBaixa', 'comAlta', 'escritorio', 'industria'];

// uma zona cabe no bloco quando algum modelo dela cabe no fundo das colunas mais fundas (o quartil de cima) e no
// comprimento do bloco; a coluna rasa demais para a zona recebe um prédio da zona de baixo (RECUO_ZONA)
function zonaCabe(zonaId, fundo, ncol) {
  return modelosDaZona(zonaId).some((m) => PREDIOS[m].planta[1] <= fundo && PREDIOS[m].planta[0] <= ncol);
}

function zonear(sim, blocos, bairros, rng) {
  const G = sim.grafo;
  const C = sim.tabelas.celulas;
  const donoDaAresta = new Map();
  for (const b of bairros) for (const e of b.arestas) donoDaAresta.set(e, b);
  for (const bl of blocos) {
    const b = donoDaAresta.get(bl.e);
    const tipo = tipoDa(G, bl.e);
    let pesos = !b || tipo === VIAS.avenidaG ? [0, 1, 3, 1, 3, 3, 0] : b.mistura;
    if (tipo === VIAS.avenida && rng.chance(0.4)) pesos = rng.chance(0.5) ? [0, 0, 0, 1, 0, 0, 0] : [0, 0, 0, 0, 1, 0, 0];
    if (rng.chance(0.02)) continue; // quadras sem zona
    // fundo livre típico do bloco: a zona sorteada tem de caber nele (torre em quadra rasa deixava a quadra vazia)
    const fundos = bl.colunas.map((col) => {
      let r = 0;
      while (r < col.length && C.estado[col[r]] === CELULA.LIVRE) r++;
      return r;
    }).sort((u, v) => u - v);
    const fundo = fundos[Math.floor(fundos.length * 0.75)] ?? 0;
    const cabe = ZONAS_MISTURA.map((z) => zonaCabe(z, fundo, bl.colunas.length));
    let p = pesos.map((w, i) => (cabe[i] ? w : 0));
    if (!p.some((w) => w > 0)) p = [3, 1, 0, 2, 0, 0, 0].map((w, i) => (cabe[i] ? w : 0));
    if (!p.some((w) => w > 0)) continue;
    const zi = ZONA_IDX(ZONAS_MISTURA[rng.escolher(p)]);
    for (const col of bl.colunas) {
      for (const c of col) {
        if (C.estado[c] !== CELULA.LIVRE) continue;
        C.zona[c] = zi;
        C.marcar(c);
      }
    }
    bl.zona = zi;
  }
}

const RECUO_ZONA = { resAlta: 'resMedia', resMedia: 'resBaixa', comAlta: 'comBaixa', escritorio: 'comAlta', industria: 'comBaixa' };

// Cresce as quadras como numa cidade brasileira: lotes geminados, um encostado no outro, e cada prédio com a
// profundidade que a quadra dá (o fundo do lote é quintal, não gramado de maquete). Numa coluna, entre os modelos que
// cabem, ficam os que chegam a até uma linha do fundo livre; entre eles, o sorteio pende para os estreitos.
function crescer(sim, blocos, alvo, rng) {
  const C = sim.tabelas.celulas;
  let feitos = 0;
  const tique = sim.tique;
  const pesosNivel = [30, 25, 20, 15, 10];
  for (const bl of blocos) {
    if (feitos >= alvo) break;
    if (!bl.zona) continue;
    const zonaId = ZONAS_ORDEM[bl.zona];
    const modelos = modelosDaZona(zonaId);
    const cols = bl.colunas;
    // fundo livre de cada coluna: células livres da zona desde a rua
    const fundo = cols.map((col) => {
      let r = 0;
      while (r < col.length && col[r] !== undefined && C.estado[col[r]] === CELULA.LIVRE && C.zona[col[r]] === bl.zona) r++;
      return r;
    });
    let c = 0;
    while (c < cols.length && feitos < alvo) {
      if (!fundo[c]) {
        c++;
        continue;
      }
      const cabe = (m) => {
        const [w, d] = PREDIOS[m].planta;
        if (c + w > cols.length) return false;
        for (let i = c; i < c + w; i++) if (fundo[i] < d) return false;
        return true;
      };
      let zonaAqui = zonaId;
      let cabem = modelos.filter(cabe);
      while (!cabem.length && RECUO_ZONA[zonaAqui]) {
        zonaAqui = RECUO_ZONA[zonaAqui];
        cabem = modelosDaZona(zonaAqui).filter(cabe);
      }
      const dMax = cabem.reduce((a, m) => Math.max(a, PREDIOS[m].planta[1]), 0);
      const ordem = cabem
        .map((m) => [m, pot(rng.f(), PREDIOS[m].planta[0] / 4) + (PREDIOS[m].planta[1] >= dMax - 1 ? 2 : 0)])
        .sort((u, v) => v[1] - u[1])
        .map((u) => u[0]);
      let feito = -1;
      let largura = 1;
      for (const m of ordem) {
        const [w, d] = PREDIOS[m].planta;
        const lista = [];
        for (let i = c; i < c + w; i++) for (let r = 0; r < d; r++) lista.push(cols[i][r]);
        if (zonaAqui !== zonaId) {
          for (const cel of lista) {
            C.zona[cel] = ZONA_IDX(zonaAqui);
            C.marcar(cel);
          }
        }
        const nivel = rng.escolher(pesosNivel) + 1;
        const r = rng.f();
        let flags = 0;
        let obraIni = 0;
        let obraFim = 0;
        if (r < 0.03) {
          flags = PREDIO.OBRA;
          obraIni = Math.max(0, tique - rng.int(0, 300));
          obraFim = tique + rng.int(60, 600);
        } else if (r < 0.04) {
          flags = PREDIO.ABANDONADO;
        }
        feito = crescerNaFrente(sim, lista, {
          modelo: m, nivel, estilo: rng.int(0, 3), semente: rng.u32(), flags, obraIni, obraFim, cor: rng.chance(0.05) ? rng.int(1, 6) : 0,
        });
        if (feito >= 0) {
          largura = w;
          break;
        }
        if (zonaAqui !== zonaId) for (const cel of lista) C.zona[cel] = bl.zona;
      }
      if (feito >= 0) {
        feitos++;
        c += largura;
      } else {
        c++;
      }
    }
  }
  return feitos;
}

// Ordem de crescimento: cada bairro cresce do seu centro para a borda, na mesma fração (quem não cabe no teto de
// prédios fica na borda de todos, como loteamento ainda por ocupar, e não espalhado em quadras vazias pelo meio).
function ordenarBlocos(sim, blocos, bairros, rng) {
  const C = sim.tabelas.celulas;
  const donoDaAresta = new Map();
  for (const b of bairros) for (const e of b.arestas) donoDaAresta.set(e, b);
  const grupos = new Map();
  for (const bl of blocos) {
    const col = bl.colunas[Math.floor(bl.colunas.length / 2)];
    const x = C.x[col[0]];
    const z = C.z[col[0]];
    let b = donoDaAresta.get(bl.e);
    if (!b) b = bairros.filter((o) => !o.vazio).reduce((m, o) => (hipot(x - o.c[0], z - o.c[1]) < hipot(x - m.c[0], z - m.c[1]) ? o : m), bairros[0]);
    const l = grupos.get(b) ?? [];
    l.push([hipot(x - b.c[0], z - b.c[1]), bl]);
    grupos.set(b, l);
  }
  const chaves = [];
  for (const [b, l] of grupos) {
    l.sort((u, v) => u[0] - v[0]);
    const k = b.cresce ?? 1;
    l.forEach(([, bl], i) => chaves.push([(i / l.length) * k + 0.06 * rng.f(), bl]));
  }
  return chaves.sort((u, v) => u[0] - v[0]).map((u) => u[1]);
}

// Depois do crescimento: a quadra que ficou sem prédio perde a zona (loteamento por ocupar) e o fundo livre dos lotes
// também (quintal); as duas ganham vegetação em gerarFloresta, em vez de gramado liso ou terra batida de maquete.
function soltarSobras(sim, blocos) {
  const C = sim.tabelas.celulas;
  let quadras = 0;
  let quintais = 0;
  for (const bl of blocos) {
    if (!bl.zona) continue;
    const vazia = !bl.colunas.some((col) => col.some((c) => C.estado[c] === CELULA.OCUPADA));
    for (const col of bl.colunas) {
      for (const c of col) {
        if (C.estado[c] !== CELULA.LIVRE || !C.zona[c]) continue;
        C.zona[c] = 0;
        C.marcar(c);
        if (!vazia) quintais++;
      }
    }
    if (vazia) {
      bl.vazia = true;
      quadras++;
    }
  }
  return { quadras, quintais };
}

// ------------------------------------------------------------------------------------------------ o resto do espelho

function gerarFloresta(sim, T, s) {
  const n = 1024;
  const passo = 8;
  const origem = [-4096, -4096];
  const dens = new Uint8Array(n * n);
  const ocupado = new Uint8Array(n * n);
  const G = sim.grafo;
  const A = G.arestas;
  const marca = (x, z, r) => {
    const i0 = Math.floor((x - r - origem[0]) / passo);
    const i1 = Math.floor((x + r - origem[0]) / passo);
    const j0 = Math.floor((z - r - origem[1]) / passo);
    const j1 = Math.floor((z + r - origem[1]) / passo);
    for (let j = Math.max(0, j0); j <= Math.min(n - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(n - 1, i1); i++) ocupado[j * n + i] = 1;
  };
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e]) continue;
    const p = A.p.subarray(8 * e, 8 * e + 8);
    for (const [x, z] of amostrasDaCurva(p, 8)) marca(x, z, meiaDa(G, e) + 6);
  }
  const C = sim.tabelas.celulas;
  for (let c = 0; c < C.n; c++) if (C.viva[c] && (C.zona[c] || C.estado[c] === CELULA.OCUPADA)) marca(C.x[c], C.z[c], 6);
  // quintais e quadras por ocupar (células livres sem zona): árvores de quintal e capoeira, sem virar mata fechada
  const base = new Uint8Array(n * n);
  for (let c = 0; c < C.n; c++) {
    if (!C.viva[c] || C.zona[c] || C.estado[c] !== CELULA.LIVRE) continue;
    const i = Math.floor((C.x[c] - origem[0]) / passo);
    const j = Math.floor((C.z[c] - origem[1]) / passo);
    if (i < 0 || j < 0 || i >= n || j >= n) continue;
    const f = fbm(C.x[c] / 60, C.z[c] / 60, s + 53, 3);
    base[j * n + i] = Math.round(clamp(0.18 + 0.12 * C.linha[c] + (f - 0.5) * 0.9, 0, 0.62) * 255);
  }
  for (let j = 0; j < n; j++) {
    const z = origem[1] + (j + 0.5) * passo;
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      if (ocupado[k]) continue;
      const x = origem[0] + (i + 0.5) * passo;
      if (aguaEm(T, x, z) !== AGUA.TERRA || naGleba(x, z, 20)) continue;
      const h = alturaEm(T, x, z);
      const f = fbm(x / 300, z / 300, s + 31);
      const v = clamp((h - 18) / 50, 0, 1) * 0.8 + (f > 0.58 ? (f - 0.58) * 3 : 0);
      dens[k] = Math.max(base[k], Math.round(clamp(v, 0, 1) * 255));
    }
  }
  sim.espelho.floresta = { n, passo, origem, dens };
  sim.mudancas.tudo('floresta');
}

function gerarRecursos(sim, T, s) {
  const n = 256;
  const passo = 32;
  const origem = [-4096, -4096];
  const g = () => new Uint8Array(n * n);
  const r = { n, passo, origem, rocha: g(), areia: g(), argila: g(), calcario: g(), fertil: g(), subterranea: g() };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = origem[0] + (i + 0.5) * passo;
      const z = origem[1] + (j + 0.5) * passo;
      const k = j * n + i;
      if (aguaEm(T, x, z) !== AGUA.TERRA) continue;
      const h = alturaEm(T, x, z);
      const dr = distRio(x, z);
      r.rocha[k] = Math.round(clamp((h - 30) / 80, 0, 1) * 255);
      r.areia[k] = Math.round(clamp(1 - (dr - 40) / 200, 0, 1) * 220);
      r.argila[k] = Math.round(clamp(1 - (dr - 100) / 500, 0, 1) * clamp((20 - h) / 15, 0, 1) * 230);
      r.calcario[k] = Math.round(clamp(fbm(x / 600, z / 600, s + 41) * 2 - 1.1, 0, 1) * 255 * (x < -1500 && z < -500 ? 1 : 0));
      r.fertil[k] = Math.round(clamp((25 - h) / 20, 0, 1) * 200);
      r.subterranea[k] = Math.round(clamp(fbm(x / 800, z / 800, s + 43), 0, 1) * 180);
    }
  }
  sim.espelho.recursos = r;
}

function gerarGrades(sim, T, bairros) {
  const valor = new Float32Array(256 * 256);
  for (let j = 0; j < 256; j++) {
    for (let i = 0; i < 256; i++) {
      const x = -4096 + (i + 0.5) * 32;
      const z = -4096 + (j + 0.5) * 32;
      const centro = 1 - clamp(hipot(x + 230, z + 430) / 3000, 0, 1);
      const orla = 1 - clamp(Math.abs(z - costaSul(x)) / 700, 0, 1);
      valor[j * 256 + i] = aguaEm(T, x, z) ? 0 : 150 + 450 * centro + 300 * orla;
    }
  }
  const ar = new Uint8Array(128 * 128);
  const ruido = new Uint8Array(128 * 128);
  const leste = BAIRROS.find((b) => b.nome === 'Leste');
  for (let j = 0; j < 128; j++) {
    for (let i = 0; i < 128; i++) {
      const x = -4096 + (i + 0.5) * 64;
      const z = -4096 + (j + 0.5) * 64;
      const di = hipot(x - leste.c[0], z - leste.c[1]);
      ar[j * 128 + i] = Math.round(clamp(1 - di / 900, 0, 1) * 200);
      ruido[j * 128 + i] = Math.round(clamp(1 - di / 1200, 0, 1) * 150 + clamp(1 - Math.abs(z + 1560) / 250, 0, 1) * 100);
    }
  }
  sim.espelho.grades = {
    valor: { n: 256, passo: 32, origem: [-4096, -4096], dados: valor },
    ar: { n: 128, passo: 64, origem: [-4096, -4096], dados: ar },
    ruido: { n: 128, passo: 64, origem: [-4096, -4096], dados: ruido },
  };
  for (const g of ['valor', 'ar', 'ruido']) sim.mudancas.marcar(g);
}

function gerarVidaEArcologia(sim, rng) {
  const G = sim.grafo;
  const A = G.arestas;
  // ladrilhos: os 8 x 8 da cidade sintética da Holding, vizinhos compráveis
  const estado = new Uint8Array(256);
  const preco = new Float64Array(256);
  for (let j = 4; j <= 11; j++) for (let i = 4; i <= 11; i++) estado[j * 16 + i] = LADRILHO.HOLDING;
  for (let j = 0; j < 16; j++) {
    for (let i = 0; i < 16; i++) {
      if (estado[j * 16 + i]) continue;
      if ((i === 3 || i === 12) && j >= 4 && j <= 11) estado[j * 16 + i] = LADRILHO.COMPRAVEL;
      if ((j === 3 || j === 12) && i >= 4 && i <= 11) estado[j * 16 + i] = LADRILHO.COMPRAVEL;
      if (estado[j * 16 + i]) preco[j * 16 + i] = 40000;
    }
  }
  sim.espelho.ladrilhos = { n: 16, estado, preco };
  sim.mudancas.marcar('ladrilhos');
  sim.espelho.areas = [
    { id: 'gleba', nome: 'Gleba da Arcologia', contorno: Float64Array.from(GLEBA_ENVELOPE.contorno) },
    { id: 'orla', nome: 'Orla', contorno: Float64Array.from([200, 1300, 1800, 1100, 1800, 1500, 200, 1700]) },
    { id: 'vila', nome: 'Vila de Santa Cida', contorno: Float64Array.from([-620, 1380, -300, 1380, -300, 1580, -620, 1580]) },
    { id: 'varzea', nome: 'Várzea', contorno: Float64Array.from([-1300, -200, -900, -200, -900, 900, -1300, 900]) },
    { id: 'morros', nome: 'Morros', contorno: Float64Array.from([-2048, -2048, 2048, -2048, 2048, -1700, -2048, -1700]) },
  ];
  // Arcologia: plano provisório com a Torre pronta
  sim.espelho.arcologia = {
    plano: 'A',
    etapas: ['lago.e1', 'torre.e1', 'torre.e2', 'torre.e3', 'torre.e4'].map((id) => ({
      id, parte: id.split('.')[0], estado: ETAPA.PRONTA, fase: 3, progresso: 1,
    })),
  };
  sim.mudancas.marcar('arcologia');
  // fluxos sintéticos por aresta
  const ida = new Float32Array(A.cap);
  const volta = new Float32Array(A.cap);
  const vel = new Float32Array(A.cap);
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e]) continue;
    const t = tipoDa(G, e);
    const cap = t.capFaixa * t.faixas[0];
    ida[e] = cap * rng.entre(0.1, 0.9);
    volta[e] = t.faixas[1] ? t.capFaixa * t.faixas[1] * rng.entre(0.1, 0.9) : 0;
    vel[e] = clamp(1.1 - ida[e] / Math.max(1, cap), 0.2, 1);
  }
  sim.espelho.fluxos = { versao: 1, ida, volta, vel };
  sim.mudancas.marcar('fluxos');
  // entregas: caminhões pelo caminho A* entre nós distantes
  const g = adjacencia(G);
  const vivos = [];
  for (let n = 0; n < G.nos.n; n++) if (G.nos.viva[n] && G.nos.grau[n] > 0) vivos.push(n);
  const entregas = [];
  for (let k = 0; entregas.length < 4 && k < 40; k++) {
    const a = vivos[rng.int(0, vivos.length - 1)];
    const b = vivos[rng.int(0, vivos.length - 1)];
    if (a === b) continue;
    const r = aEstrela(g, a, b, { x: G.nos.x, z: G.nos.z, fator: 1 });
    if (!r || r.refs.length < 4) continue;
    entregas.push({ id: entregas.length + 1, item: 'concreto', n: 10, caminho: r.refs, tIni: sim.tique, tFim: sim.tique + Math.round(r.custo / 12.5), visual: false });
  }
  sim.espelho.entregas = entregas;
  sim.mudancas.marcar('entregas');
}

// ------------------------------------------------------------------------------------------------ gerador

/**
 * Gera a cidade sintética. Sem `sim`, cria uma simulação só da F0 (sem os domínios, que não devem mexer nela); com
 * `sim` (criada por criarSimulacao), escreve nela: prefira { dominios: false } se ela for rodar tiques.
 * @param {{ semente?: string, predios?: number, sim?: object, cronometro?: () => number }} op  predios: teto (padrão:
 *   encher os bairros, cerca de SINTETICA.predios)
 * @returns {{ sim: object, resumo: object }}
 */
export function gerarCidadeSintetica({ semente = SINTETICA.semente, predios = Infinity, sim = null, cronometro = null } = {}) {
  const agora = cronometro ?? (() => 0);
  const t0 = agora();
  sim = sim ?? criarSimulacao({ semente, dominios: false });
  if (!sim.grafo || !sim.tabelas.celulas) throw new Error('cidade sintética: a simulação precisa do grafo e das tabelas (criarSimulacao)');
  const s = 1234;
  const rng = sim.rng('sintetica');
  const T = gerarTerreno(sim, s);
  const tTerreno = agora();
  const { bairros, ligacoes } = gerarVias(sim, T, rng);
  const tVias = agora();
  const { blocos, invalidasEsquina } = gerarCelulas(sim, T);
  zonear(sim, blocos, bairros, rng);
  const tCelulas = agora();
  // cada bairro cresce do centro para a borda: o teto de prédios não deixa quadras vazias pelo meio
  const feitos = crescer(sim, ordenarBlocos(sim, blocos, bairros, rng), predios, rng);
  const sobras = soltarSobras(sim, blocos);
  const tPredios = agora();
  gerarFloresta(sim, T, s);
  gerarRecursos(sim, T, s);
  gerarGrades(sim, T, bairros);
  gerarVidaEArcologia(sim, rng);
  somarPredios(sim);
  const tFim = agora();
  const P = sim.tabelas.predios;
  const C = sim.tabelas.celulas;
  const A = sim.tabelas.arestas;
  const porZona = {};
  const porNivel = [0, 0, 0, 0, 0];
  for (let i = 0; i < P.n; i++) {
    if (!P.viva[i]) continue;
    const z = ZONAS_ORDEM[P.zona[i]];
    porZona[z] = (porZona[z] ?? 0) + 1;
    porNivel[P.nivel[i] - 1]++;
  }
  let validas = 0;
  let zoneadas = 0;
  let ocupadas = 0;
  for (let c = 0; c < C.n; c++) {
    if (!C.viva[c]) continue;
    if (C.estado[c] !== CELULA.INVALIDA) validas++;
    if (C.zona[c]) zoneadas++;
    if (C.estado[c] === CELULA.OCUPADA) ocupadas++;
  }
  const porTipo = {};
  for (let e = 0; e < A.n; e++) if (A.viva[e]) porTipo[tipoDa(sim.grafo, e).nome] = (porTipo[tipoDa(sim.grafo, e).nome] ?? 0) + 1;
  const resumo = {
    predios: feitos,
    porZona,
    porNivel,
    nos: sim.tabelas.nos.vivos,
    arestas: A.vivos,
    porTipo,
    ligacoes: ligacoes.length,
    celulas: { total: C.vivos, validas, zoneadas, ocupadas, invalidasEsquina, quadrasPorOcupar: sobras.quadras, quintais: sobras.quintais },
    populacao: sim.agregados.populacao,
    ms: cronometro
      ? {
          terreno: +(tTerreno - t0).toFixed(1),
          vias: +(tVias - tTerreno).toFixed(1),
          celulas: +(tCelulas - tVias).toFixed(1),
          predios: +(tPredios - tCelulas).toFixed(1),
          resto: +(tFim - tPredios).toFixed(1),
          total: +(tFim - t0).toFixed(1),
        }
      : null,
  };
  return { sim, resumo };
}

/** Invariantes do espelho na cidade sintética (contratos/espelho.js). */
export function conferirSintetica(sim) {
  return conferirEspelho(sim.espelho, { alturaEm: (x, z) => sim.alturaEm(x, z) });
}

// ------------------------------------------------------------------------------------------------ linha de comando

function medir(fn, rep) {
  fn();
  const t = performance.now();
  for (let i = 0; i < rep; i++) fn();
  return (performance.now() - t) / rep;
}

async function principal() {
  const arg = (nome, padrao) => {
    const i = process.argv.indexOf(nome);
    return i > 0 ? Number(process.argv[i + 1]) : padrao;
  };
  const alvo = arg('--predios', Infinity);
  const { sim, resumo } = gerarCidadeSintetica({ predios: alvo, cronometro: () => performance.now() });
  console.log('cidade sintética:', JSON.stringify(resumo, null, 1));
  const erros = conferirSintetica(sim);
  console.log(`invariantes do espelho: ${erros.length ? `${erros.length} erro(s)` : 'ok'}`);
  for (const e of erros.slice(0, 10)) console.log('  ', e);
  const validar = sim.validar();
  console.log(`validar: ${validar.length ? JSON.stringify(validar.slice(0, 5)) : 'ok'}`);
  // medidas (seção 4.5: tique vazio, q.barra, desde)
  const vazio = criarSim({ semente: 'vazio' });
  const msVazio = medir(() => vazio.rodar(1), 20000);
  const msTique = medir(() => sim.rodar(1), 2000);
  const msBarra = medir(() => sim.q.barra(), 2000);
  const v0 = sim.mudancas.desde(-1).versao;
  const msDesdeTudo = medir(() => sim.mudancas.desde(-1), 50);
  const msDesdeNada = medir(() => sim.mudancas.desde(sim.mudancas.versao), 2000);
  const P = sim.tabelas.predios;
  const v1 = sim.mudancas.versao;
  for (let i = 0, k = 0; i < P.n && k < 1000; i++) if (P.viva[i]) (P.marcar(i), k++);
  const msDesde1000 = medir(() => sim.mudancas.desde(v1), 200);
  const msHash = medir(() => sim.q.hash(), 5);
  console.log(
    'medidas (ms):',
    JSON.stringify({
      tiqueVazio: +msVazio.toFixed(5),
      tiqueSintetica: +msTique.toFixed(4),
      barra: +msBarra.toFixed(4),
      desdeTudo: +msDesdeTudo.toFixed(3),
      desdeSemMudanca: +msDesdeNada.toFixed(5),
      desde1000Predios: +msDesde1000.toFixed(4),
      hash: +msHash.toFixed(1),
      versao: v0,
    }),
  );
  const ok = !erros.length && !validar.length && (alvo === Infinity ? Math.abs(resumo.predios - SINTETICA.predios) <= 0.1 * SINTETICA.predios : resumo.predios === alvo);
  if (!ok) console.log('cidade sintética: FALHOU');
  process.exit(ok ? 0 : 1);
}

if (typeof process !== 'undefined' && /cidade-sintetica\.mjs$/.test(process.argv?.[1] ?? '')) principal();
