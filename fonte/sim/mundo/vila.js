// Vila de Santa Cida e rodovia: o que já está construído no mapa no começo da partida (dona: S1a).
//
//  - Rodovia (BR, 'rodovia', flag RODOVIA): de oeste a leste, com a ponte pronta sobre o Rio Held (flag PONTE, sem
//    forma no aplainar), o acesso de 4 faixas até o nó de entrada (D52) e a junção da estrada de terra da Vila. O
//    greide sai do relevo base: média móvel, meio a meio entre corte e aterro, declive máximo de 5,5%, folga sobre a
//    várzea e vão livre sobre o rio.
//  - Vila (D52): rua principal ('rua', com calçada e redes) e ruas de 'terra' na foz, a estrada de terra até a
//    rodovia e uns 60 prédios de nível 1 e 2 (350 moradores) de frente para as ruas, em plataformas do aplainar.
//
// Os prédios da Vila são prédios de zona sem células (a S1b cria células só nas vias que pintar). O que foi criado fica
// em sim.json.mapa (refs), para as outras parcelas acharem a entrada, a Vila e a rodovia.
import { addNo, addAresta } from '../vias/grafo.js';
import { dividir as dividirBz, tabelaArco, tDoArco, ponto, direcao } from '../../comum/bezier.js';
import { alturaEm } from '../../comum/altura.js';
import { cantosRetangulo, pontoNoPoligono } from '../../comum/vetor.js';
import { atan2, clamp } from '../../comum/util.js';
import { Rng, semear } from '../../comum/rng.js';
import { refDe, idxDaRef, gerDaRef } from '../../contratos/espelho.js';
import { AGUA, ARESTA, TIPO_PREDIO } from '../../contratos/flags.js';
import { VIAS } from '../../data/vias.js';
import { PREDIOS, PREDIOS_ORDEM } from '../../data/predios.js';
import { ZONAS_ORDEM } from '../../data/zonas.js';
import { terrenoBase, densificar, trechosBezier, rioEm, costaEm, aguaEm } from './terreno.js';
import { formaDaAresta, CHAO_ABAIXO_DA_PISTA } from './aplainar.js';

// ------------------------------------------------------------------------------------------------ greide

/** Envelope de Lipschitz: `acima` só sobe (aterro), senão só desce (corte); declive g por metro. */
function envelope(y, s, g, acima) {
  const n = y.length;
  for (let i = 1; i < n; i++) {
    const lim = y[i - 1] + (acima ? -1 : 1) * g * (s[i] - s[i - 1]);
    if (acima ? y[i] < lim : y[i] > lim) y[i] = lim;
  }
  for (let i = n - 2; i >= 0; i--) {
    const lim = y[i + 1] + (acima ? -1 : 1) * g * (s[i + 1] - s[i]);
    if (acima ? y[i] < lim : y[i] > lim) y[i] = lim;
  }
  return y;
}

/**
 * Greide de uma via do mapa sobre a polilinha densa L: média móvel do relevo base, meio a meio entre o envelope de
 * aterro e o de corte, mínimos sobre a água e a várzea, e o envelope de aterro de novo para o declive valer.
 * `vao` marca os índices da ponte (tabuleiro acima do rio).
 */
export function greide(base, L, { declive, sobreVarzea = 0, vaoLivre = 0, vao = null, janela = 110 }) {
  const n = L.n;
  const hb = new Float64Array(n);
  for (let i = 0; i < n; i++) hb[i] = alturaEm(base, L.x[i], L.z[i]);
  // média móvel pelo arco (somas acumuladas)
  const acum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) acum[i + 1] = acum[i] + hb[i];
  const y = new Float64Array(n);
  let a = 0;
  let b = 0;
  for (let i = 0; i < n; i++) {
    while (L.s[i] - L.s[a] > janela) a++;
    while (b + 1 < n && L.s[b + 1] - L.s[i] <= janela) b++;
    y[i] = (acum[b + 1] - acum[a]) / (b + 1 - a);
  }
  const yA = envelope(Float64Array.from(y), L.s, declive, true);
  const yC = envelope(Float64Array.from(y), L.s, declive, false);
  for (let i = 0; i < n; i++) {
    let v = (yA[i] + yC[i]) / 2;
    const r = rioEm(base, L.x[i], L.z[i]);
    if (r.a < r.hw + r.varzea + 60 && v < r.nivel + sobreVarzea) v = r.nivel + sobreVarzea;
    if (vao && vao[i] && v < r.nivel + vaoLivre) v = r.nivel + vaoLivre;
    if (costaEm(base, L.x[i], L.z[i]) < 60 && v < 3) v = 3;
    y[i] = v;
  }
  return envelope(y, L.s, declive, true);
}

// ------------------------------------------------------------------------------------------------ vias do mapa

/** Divide cada trecho de Bézier em partes de até `maximo` metros (a curva não muda). */
function partes(p, maximo) {
  const comp = tabelaArco(p)[16];
  const k = Math.max(1, Math.ceil(comp / maximo));
  const out = [];
  let resto = p;
  for (let i = 0; i < k - 1; i++) {
    const [a, b] = dividirBz(resto, 1 / (k - i));
    out.push(a);
    resto = b;
  }
  out.push(resto);
  return out;
}

/**
 * Traça uma via do mapa pelos pontos (Catmull-Rom): nós nas pontas de cada parte, com a cota do greide (ou do chão).
 * `nos` reaproveita nós pela chave "x,z" (junções). Devolve { arestas, nosIdx (um por ponto dado) }.
 */
function tracar(sim, { pontos, tipo, flags = 0, maximo = 240, cota, nos, ponteEm = -1 }) {
  const G = sim.grafo;
  const trechos = trechosBezier(pontos.map((p) => [p[0], p[1]]));
  const arestas = [];
  const nosIdx = [];
  const noDe = (x, z) => {
    const chave = `${x},${z}`;
    let i = nos.get(chave);
    if (i === undefined) {
      i = addNo(G, x, z, cota(x, z));
      if (i < 0) throw new Error('mapa: teto de nós');
      nos.set(chave, i);
    }
    return i;
  };
  nosIdx.push(noDe(pontos[0][0], pontos[0][1]));
  for (let t = 0; t < trechos.length; t++) {
    const ehPonte = t === ponteEm;
    const lista = ehPonte ? [trechos[t]] : partes(trechos[t], maximo);
    for (const p of lista) {
      const a = noDe(p[0], p[1]);
      const b = noDe(p[6], p[7]);
      const e = addAresta(G, a, b, tipo, [p[2], p[3]], [p[4], p[5]], { flags: flags | (ehPonte ? ARESTA.PONTE : 0), idade: 0 });
      if (e < 0) throw new Error(`mapa: aresta recusada (${tipo})`);
      arestas.push(e);
    }
    nosIdx.push(noDe(pontos[t + 1][0], pontos[t + 1][1]));
  }
  return { arestas, nosIdx };
}

/** Cota de um ponto pelo greide da polilinha densa (ponto mais perto). */
function cotaNoGreide(L, y) {
  return (x, z) => {
    let m = Infinity;
    let v = y[0];
    for (let i = 0; i < L.n; i++) {
      const dx = L.x[i] - x;
      const dz = L.z[i] - z;
      const d = dx * dx + dz * dz;
      if (d < m) {
        m = d;
        v = y[i];
      }
    }
    return Math.round(v * 100) / 100;
  };
}

function construirRodovia(sim, mapa, base, nos) {
  const R = mapa.rodovia;
  const pontos = R.pontos;
  const L = densificar(pontos.map((p) => [p[0], p[1]]), 8);
  // índices da ponte: o trecho que começa no ponto marcado 'ponte'
  const iPonte = pontos.findIndex((p) => p[2] === 'ponte');
  const vao = new Uint8Array(L.n);
  if (iPonte >= 0) for (let i = L.ini[iPonte]; i <= (L.ini[iPonte + 1] ?? L.n - 1); i++) vao[i] = 1;
  const y = greide(base, L, { declive: R.declive, sobreVarzea: R.sobreVarzea, vaoLivre: R.vaoLivre, vao });
  const cota = cotaNoGreide(L, y);
  const { arestas, nosIdx } = tracar(sim, { pontos, tipo: 'rodovia', flags: ARESTA.RODOVIA, cota, nos, ponteEm: iPonte });
  const iJ = pontos.findIndex((p) => p[2] === 'juncao');
  const iV = pontos.findIndex((p) => p[2] === 'vila');
  const ponte = arestas.find((e) => sim.tabelas.arestas.flags[e] & ARESTA.PONTE) ?? -1;
  // acesso até o nó de entrada: começa na junção, com a cota dela
  const La = densificar(R.acesso, 8);
  const ya = greide(base, La, { declive: R.declive });
  // começa na cota da junção e segue o greide sem passar do declive (corte ou aterro onde precisar)
  ya[0] = sim.tabelas.nos.y[nosIdx[iJ]];
  for (let i = 1; i < La.n; i++) {
    const g = R.declive * (La.s[i] - La.s[i - 1]);
    ya[i] = clamp(ya[i], ya[i - 1] - g, ya[i - 1] + g);
  }
  const acesso = tracar(sim, { pontos: R.acesso, tipo: 'rodovia', flags: ARESTA.RODOVIA, cota: cotaNoGreide(La, ya), nos });
  return {
    arestas,
    acesso: acesso.arestas,
    juncao: nosIdx[iJ],
    vila: nosIdx[iV],
    entrada: acesso.nosIdx[acesso.nosIdx.length - 1],
    ponte,
  };
}

/** Declive máximo das ruas da Vila (a regra da rua é 12%; a de terra fica abaixo, com folga). */
export const DECLIVE_RUAS_VILA = 0.1;

/**
 * Cota dos nós de uma rua da Vila: a pista 0,15 m acima do chão, mas os nós que já existem (a junção na rodovia, que
 * pode estar no aterro da cabeceira da ponte) puxam a rua em rampa de até 10%, em vez de um degrau na última aresta.
 */
function cotaDaRua(sim, base, pontos, nos) {
  const pista = (x, z) => alturaEm(base, x, z) + CHAO_ABAIXO_DA_PISTA;
  const L = densificar(pontos.map((p) => [p[0], p[1]]), 8);
  const y0 = new Float64Array(L.n);
  for (let i = 0; i < L.n; i++) y0[i] = pista(L.x[i], L.z[i]);
  const y = Float64Array.from(y0);
  const Y = sim.tabelas.nos.y;
  pontos.forEach((p, t) => {
    const no = nos.get(`${p[0]},${p[1]}`);
    if (no !== undefined) y[t < pontos.length - 1 ? L.ini[t] : L.n - 1] = Y[no];
  });
  envelope(y, L.s, DECLIVE_RUAS_VILA, true);
  const acima = cotaNoGreide(L, y);
  const chao = cotaNoGreide(L, y0);
  // fora das rampas a cota é a pista no próprio ponto (a nearest do greide só entra com o que ele levanta)
  return (x, z) => Math.round((pista(x, z) + Math.max(0, acima(x, z) - chao(x, z))) * 100) / 100;
}

function construirRuasDaVila(sim, mapa, base, nos) {
  const ruas = [];
  for (const rua of mapa.vila.ruas) {
    const cota = cotaDaRua(sim, base, rua.pontos, nos);
    const r = tracar(sim, { pontos: rua.pontos, tipo: rua.tipo, maximo: rua.tipo === 'terra' ? 120 : 160, cota, nos });
    ruas.push({ id: rua.id, tipo: rua.tipo, arestas: r.arestas });
  }
  return ruas;
}

// ------------------------------------------------------------------------------------------------ prédios da Vila

// modelos por rua: [id do modelo, peso]
// (só plantas de 16 m ou mais: as quatro amostras do chão em volta do centro caem na plataforma, e a cota do prédio é
// a do chão no centro, invariante do espelho)
const MISTURA = {
  principal: [['sobrado', 5], ['casa', 2], ['loja', 3], ['lojaDupla', 1], ['mercado', 1]],
  praia: [['sobrado', 7], ['casa', 3], ['casaFundo', 1], ['loja', 1]],
  outras: [['sobrado', 10], ['casa', 3], ['casaFundo', 1]],
};
/** Comércio na Vila: a venda, o mercadinho e umas lojas. */
const MAX_COMERCIO = 6;

/** Ocupação em células de 2 m sobre a caixa da Vila: vias (com folga) e prédios já postos. */
class Ocupacao {
  constructor(x0, z0, x1, z1) {
    this.p = 2;
    this.x0 = x0;
    this.z0 = z0;
    this.nx = Math.ceil((x1 - x0) / this.p) + 1;
    this.nz = Math.ceil((z1 - z0) / this.p) + 1;
    this.c = new Uint8Array(this.nx * this.nz);
  }
  _idx(x, z) {
    const i = Math.floor((x - this.x0) / this.p);
    const j = Math.floor((z - this.z0) / this.p);
    return i < 0 || j < 0 || i >= this.nx || j >= this.nz ? -1 : j * this.nx + i;
  }
  /** Marca (ou confere) o retângulo girado com folga em metros. */
  retangulo(cx, cz, rot, w, d, folga, marcar) {
    const c = cantosRetangulo(cx, cz, rot, w + 2 * folga, d + 2 * folga);
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    for (let k = 0; k < 4; k++) {
      x0 = Math.min(x0, c[2 * k]);
      x1 = Math.max(x1, c[2 * k]);
      z0 = Math.min(z0, c[2 * k + 1]);
      z1 = Math.max(z1, c[2 * k + 1]);
    }
    for (let z = z0; z <= z1; z += this.p / 2) {
      for (let x = x0; x <= x1; x += this.p / 2) {
        if (!pontoNoPoligono(x, z, c)) continue;
        const k = this._idx(x, z);
        if (k < 0) {
          if (!marcar) return false;
          continue;
        }
        if (marcar) this.c[k] = 1;
        else if (this.c[k]) return false;
      }
    }
    return true;
  }
  /** Marca a faixa de uma aresta (meia largura mais folga). */
  aresta(p, meia) {
    const tab = tabelaArco(p);
    const comp = tab[16];
    const q = [0, 0];
    const m = Math.ceil(comp / 1);
    for (let s = 0; s <= m; s++) {
      ponto(p, tDoArco(tab, (comp * s) / m), q);
      for (let dz = -meia; dz <= meia; dz += 1) {
        for (let dx = -meia; dx <= meia; dx += 1) {
          if (dx * dx + dz * dz > meia * meia) continue;
          const k = this._idx(q[0] + dx, q[1] + dz);
          if (k >= 0) this.c[k] = 1;
        }
      }
    }
  }
}

function sortear(rng, lista) {
  const i = rng.escolher(lista.map((m) => m[1]));
  return lista[i][0];
}

function construirPredios(sim, mapa, base, ruas) {
  const G = sim.grafo;
  const A = G.arestas;
  const P = sim.tabelas.predios;
  const V = mapa.vila;
  const rng = new Rng(semear(mapa.semente, 'vila'));
  const area = V.area.flat();
  let ax0 = Infinity;
  let az0 = Infinity;
  let ax1 = -Infinity;
  let az1 = -Infinity;
  for (let k = 0; k < area.length; k += 2) {
    ax0 = Math.min(ax0, area[k]);
    ax1 = Math.max(ax1, area[k]);
    az0 = Math.min(az0, area[k + 1]);
    az1 = Math.max(az1, area[k + 1]);
  }
  const oc = new Ocupacao(ax0 - 40, az0 - 40, ax1 + 40, az1 + 40);
  for (const rua of ruas) for (const e of rua.arestas) oc.aresta(A.p.subarray(8 * e, 8 * e + 8), VIAS[rua.tipo].largura / 2 + 1.5);
  const feitos = [];
  let moradores = 0;
  let comercio = 0;
  const q = [0, 0];
  const d = [0, 0];
  const ordem = ['principal', 'deCima', 'travessaNorte', 'travessaSul', 'praia', 'beiraRio', 'estrada'];
  for (let volta = 0; volta < 3 && moradores < V.moradores; volta++) {
    for (const id of ordem) {
      const rua = ruas.find((r) => r.id === id);
      if (!rua) continue;
      const mistura = MISTURA[id] ?? MISTURA.outras;
      const meia = VIAS[rua.tipo].largura / 2;
      for (const e of rua.arestas) {
        const p = A.p.subarray(8 * e, 8 * e + 8);
        const tab = tabelaArco(p);
        const comp = tab[16];
        for (const lado of [1, -1]) {
          let s = 6 + rng.entre(0, 6);
          while (s < comp - 6 && moradores < V.moradores) {
            let modelo = sortear(rng, mistura);
            if (PREDIOS[modelo].zona !== 'resBaixa' && comercio >= MAX_COMERCIO) modelo = 'sobrado';
            const def = PREDIOS[modelo];
            const w = def.planta[0] * 8;
            const dd = def.planta[1] * 8;
            if (s + w > comp - 4) break;
            const t = tDoArco(tab, s + w / 2);
            ponto(p, t, q);
            direcao(p, t, d);
            const lx = -d[1] * lado;
            const lz = d[0] * lado;
            const recuo = 1.5 + rng.entre(0, 2.5);
            const off = meia + recuo + dd / 2;
            const cx = q[0] + lx * off;
            const cz = q[1] + lz * off;
            const rot = atan2(-lx, -lz); // a frente olha para a via
            if (cabe(base, oc, area, cx, cz, rot, w, dd)) {
              const nivel = rng.chance(0.5) ? 2 : 1;
              const i = criarPredio(sim, { modelo, nivel, cx, cz, rot, w, d: dd, base, rng });
              oc.retangulo(cx, cz, rot, w, dd, 1, true);
              feitos.push(i);
              moradores += P.moradores[i];
              if (def.zona !== 'resBaixa') comercio++;
              s += w + rng.entre(0, 5);
            } else {
              s += 4 + rng.entre(0, 4);
            }
          }
        }
      }
    }
  }
  return { predios: feitos, moradores };
}

/** A planta inteira dentro da área da Vila, em terra firme acima da água, com até 2,5 m de desnível e sem ocupação. */
function cabe(base, oc, area, cx, cz, rot, w, d) {
  if (!pontoNoPoligono(cx, cz, area)) return false;
  const c = cantosRetangulo(cx, cz, rot, w, d);
  let hmin = Infinity;
  let hmax = -Infinity;
  for (let k = 0; k <= 4; k++) {
    const x = k < 4 ? c[2 * k] : cx;
    const z = k < 4 ? c[2 * k + 1] : cz;
    if (k < 4 && !pontoNoPoligono(x, z, area)) return false;
    if (aguaEm(base, x, z) !== AGUA.TERRA) return false;
    const h = alturaEm(base, x, z);
    if (h < 1.3) return false;
    hmin = Math.min(hmin, h);
    hmax = Math.max(hmax, h);
  }
  if (hmax - hmin > 2.5) return false;
  return oc.retangulo(cx, cz, rot, w, d, 1, false);
}

function criarPredio(sim, { modelo, nivel, cx, cz, rot, w, d, base, rng }) {
  const P = sim.tabelas.predios;
  const i = P.alocar();
  if (i < 0) throw new Error('mapa: teto de prédios');
  const def = PREDIOS[modelo];
  const nv = def.niveis[nivel - 1];
  const cota = Math.round(alturaEm(base, cx, cz) * 100) / 100;
  P.tipo[i] = TIPO_PREDIO.ZONA;
  P.modelo[i] = PREDIOS_ORDEM.indexOf(modelo);
  P.zona[i] = ZONAS_ORDEM.indexOf(def.zona);
  P.x[i] = cx;
  P.z[i] = cz;
  P.y[i] = cota;
  P.rot[i] = rot;
  P.w[i] = w;
  P.d[i] = d;
  P.nivel[i] = nivel;
  P.estilo[i] = rng.int(0, 3);
  P.semente[i] = rng.u32();
  P.flags[i] = 0;
  P.obraIni[i] = 0;
  P.obraFim[i] = 0;
  P.cor[i] = 0;
  P.moradores[i] = nv.moradores;
  P.empregos[i] = nv.empregos.reduce((a, b) => a + b, 0);
  P.marcar(i);
  sim.formas.registrar({ tipo: 'plataforma', ref: refDe(i, P.ger[i]), contorno: cantosRetangulo(cx, cz, rot, w, d), cota: P.y[i] });
  return i;
}

// ------------------------------------------------------------------------------------------------ registro

/** Refs do que o mapa pôs no começo (sim.json.mapa), para quem precisa achar a entrada, a Vila e a rodovia. */
export const MAPA_JSON = Object.freeze({
  entrada: -1, juncao: -1, juncaoVila: -1, ponte: -1, rodovia: [], acesso: [], ruas: {}, predios: [], moradores: 0,
});

export function registrar(sim) {
  const tb = terrenoBase(sim);
  const json = sim.registrarJson('mapa', MAPA_JSON);
  if (!tb || !sim.grafo) return;
  const { mapa, base } = tb;
  const G = sim.grafo;
  const nos = new Map();
  const rod = construirRodovia(sim, mapa, base, nos);
  const ruas = construirRuasDaVila(sim, mapa, base, nos);
  // formas das vias do mapa (a ponte fica no alto, sem forma)
  const todas = [...rod.arestas, ...rod.acesso, ...ruas.flatMap((r) => r.arestas)];
  for (const e of todas) {
    if (G.arestas.flags[e] & ARESTA.PONTE) continue;
    sim.formas.registrar(formaDaAresta(G, e));
  }
  const vila = construirPredios(sim, mapa, base, ruas);
  const refA = (e) => refDe(e, G.arestas.ger[e]);
  const refN = (n) => refDe(n, G.nos.ger[n]);
  json.entrada = refN(rod.entrada);
  json.juncao = refN(rod.juncao);
  json.juncaoVila = refN(rod.vila);
  json.ponte = rod.ponte >= 0 ? refA(rod.ponte) : -1;
  json.rodovia = rod.arestas.map(refA);
  json.acesso = rod.acesso.map(refA);
  json.ruas = Object.fromEntries(ruas.map((r) => [r.id, r.arestas.map(refA)]));
  json.predios = vila.predios.map((i) => refDe(i, sim.tabelas.predios.ger[i]));
  json.moradores = vila.moradores;
}

/** Idx do nó de entrada (D52), ou -1. */
export function noDeEntrada(sim) {
  const r = sim.json.mapa?.entrada ?? -1;
  if (r < 0) return -1;
  const i = idxDaRef(r);
  const N = sim.tabelas.nos;
  return N.viva[i] && N.ger[i] === gerDaRef(r) ? i : -1;
}
