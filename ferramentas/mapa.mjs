// Mapa de Heldópolis sem navegador (dona: S1a): PNG do relevo, da água, dos recursos, das áreas e das sugestões, e as
// conferências do mapa autoral:
//  - a área inicial de 4 x 4 ladrilhos é um componente só de terra firme (D53: o rio fica na borda, não a corta);
//  - rocha, areia e argila dentro da área inicial; calcário só fora dela (D3); a orla nobre fora dela;
//  - a Vila com uns 60 prédios e 350 moradores, inteira na área inicial; a rodovia ligada ao nó de entrada; sem erro.
//
// Uso: node ferramentas/mapa.mjs [--saida pasta] [--semente s] [--so-conferir] [--vista]
//      (padrão: a pasta heldopolis-mapa no temporário do sistema). Sai com código 1 se uma conferência falhar.
//      --vista acrescenta três vistas oblíquas de helicóptero em software (baía, cidade, praia; uns 20 s cada).
//      --conferir-assado assa de novo na memória e confere com o módulo gravado.
//      node ferramentas/mapa.mjs --assar: roda a erosão dos maciços (mundo/erosao.js, alguns segundos) e grava
//      fonte/sim/mundo/relevo-assado.js. Rode sempre que mudar serras, morros, planaltos, costa, rio, lagoas, córregos,
//      planície ou rodovia em data/mapa-heldopolis.js, ou a conta da planície, do rio ou da erosão no código (com a
//      VERSAO_ASSADO de mundo/relevo.js); o teste do mundo acusa pelo hash dos controles e assando de novo.
// Importável: conferirMapa(sim) devolve { ok, falhas, medidas }; desenharMapa(sim, pasta) grava os PNG;
// assar() devolve o texto do módulo do relevo assado e as medidas.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { criarSimulacao } from '../fonte/sim/estado.js';
import { AGUA, ARESTA, LADRILHO } from '../fonte/contratos/flags.js';
import { alturaEm } from '../fonte/comum/altura.js';
import { ponto, tabelaArco, tDoArco } from '../fonte/comum/bezier.js';
import { cantosRetangulo, pontoNoPoligono } from '../fonte/comum/vetor.js';
import { fnv1aTipado, hexHash } from '../fonte/comum/hash.js';
import { VIAS, VIAS_ORDEM } from '../fonte/data/vias.js';
import { terrenoBase, camposDoMapa, FERRAMENTAS, rioEm } from '../fonte/sim/mundo/terreno.js';
import { assarRelevo, PARAMETROS } from '../fonte/sim/mundo/erosao.js';
import { MAPA_HELDOPOLIS } from '../fonte/data/mapa-heldopolis.js';
import { RECURSOS } from '../fonte/sim/mundo/recursos.js';
import { GLEBA_ENVELOPE } from '../fonte/data/arcologia-plano.js';

// ------------------------------------------------------------------------------------------------ PNG

const CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c >>> 0;
}
function crc(b) {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function bloco(tipo, dados) {
  const b = Buffer.alloc(12 + dados.length);
  b.writeUInt32BE(dados.length, 0);
  b.write(tipo, 4, 'ascii');
  dados.copy(b, 8);
  b.writeUInt32BE(crc(b.subarray(4, 8 + dados.length)), 8 + dados.length);
  return b;
}
/** Grava um PNG RGB 8 bits. */
export function gravarPng(caminho, img) {
  const { w, h, rgb } = img;
  const cru = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(cru, y * (w * 3 + 1) + 1);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  writeFileSync(caminho, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloco('IHDR', ihdr), bloco('IDAT', deflateSync(cru)), bloco('IEND', Buffer.alloc(0))]));
}

// ------------------------------------------------------------------------------------------------ imagem

class Imagem {
  /** Janela do mundo [x0, z0] de `lado` metros em w x w pixels. */
  constructor(w, x0, z0, lado) {
    this.w = w;
    this.h = w;
    this.x0 = x0;
    this.z0 = z0;
    this.m = lado / w; // metros por pixel
    this.rgb = new Uint8Array(w * w * 3);
  }
  px(x) {
    return (x - this.x0) / this.m;
  }
  pz(z) {
    return (z - this.z0) / this.m;
  }
  pintar(i, j, c, a = 1) {
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return;
    const k = (j * this.w + i) * 3;
    for (let q = 0; q < 3; q++) {
      const v = Math.round(this.rgb[k + q] * (1 - a) + c[q] * a);
      this.rgb[k + q] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  /** Disco no ponto do mundo, raio em metros (mínimo meio pixel). */
  disco(x, z, r, c, a = 1) {
    const cx = this.px(x);
    const cz = this.pz(z);
    const rp = Math.max(0.6, r / this.m);
    for (let j = Math.floor(cz - rp); j <= Math.ceil(cz + rp); j++) {
      for (let i = Math.floor(cx - rp); i <= Math.ceil(cx + rp); i++) {
        const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cz);
        if (d <= rp) this.pintar(i, j, c, a);
      }
    }
  }
  /** Linha grossa (largura em metros) por uma polilinha [[x, z]]. */
  linha(pts, larg, c, a = 1, tracejo = 0) {
    let acum = 0;
    for (let k = 0; k + 1 < pts.length; k++) {
      const [x0, z0] = pts[k];
      const [x1, z1] = pts[k + 1];
      const L = Math.hypot(x1 - x0, z1 - z0);
      const passos = Math.max(1, Math.ceil(L / (this.m * 0.5)));
      for (let s = 0; s <= passos; s++) {
        const d = acum + (L * s) / passos;
        if (tracejo && Math.floor(d / tracejo) % 2) continue;
        this.disco(x0 + ((x1 - x0) * s) / passos, z0 + ((z1 - z0) * s) / passos, larg / 2, c, a);
      }
      acum += L;
    }
  }
  /** Polígono cheio (pares x, z). */
  poligono(pts, c, a = 1) {
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    for (let k = 0; k < pts.length; k += 2) {
      x0 = Math.min(x0, pts[k]);
      x1 = Math.max(x1, pts[k]);
      z0 = Math.min(z0, pts[k + 1]);
      z1 = Math.max(z1, pts[k + 1]);
    }
    for (let j = Math.floor(this.pz(z0)); j <= Math.ceil(this.pz(z1)); j++) {
      for (let i = Math.floor(this.px(x0)); i <= Math.ceil(this.px(x1)); i++) {
        const x = this.x0 + (i + 0.5) * this.m;
        const z = this.z0 + (j + 0.5) * this.m;
        if (pontoNoPoligono(x, z, pts)) this.pintar(i, j, c, a);
      }
    }
  }
  contorno(pts, larg, c, a = 1, tracejo = 0) {
    const l = [];
    for (let k = 0; k < pts.length; k += 2) l.push([pts[k], pts[k + 1]]);
    l.push(l[0]);
    this.linha(l, larg, c, a, tracejo);
  }
}

const mistura = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Sombra de relevo (luz do noroeste, 45 graus) e o declive num ponto. */
function sombra(T, x, z, e = 8) {
  const hx = (alturaEm(T, x + e, z) - alturaEm(T, x - e, z)) / (2 * e);
  const hz = (alturaEm(T, x, z + e) - alturaEm(T, x, z - e)) / (2 * e);
  const l = Math.hypot(hx, hz, 1);
  const s = (hx * 0.62 + hz * 0.62 + 0.9) / (l * Math.hypot(0.62, 0.62, 0.9));
  return { s: cl(s), decl: Math.hypot(hx, hz) };
}

const COR = {
  marRaso: [96, 168, 170],
  marFundo: [26, 70, 98],
  rio: [92, 108, 82],
  lagoa: [70, 120, 118],
  areia: [214, 200, 164],
  capim: [156, 150, 102],
  pasto: [118, 132, 78],
  mata: [42, 74, 44],
  pedra: [128, 124, 116],
  alto: [110, 118, 96],
  rodovia: [60, 60, 64],
  rua: [236, 232, 220],
  terra: [168, 126, 84],
  predio: [226, 110, 72],
  inicio: [255, 236, 120],
  ladrilho: [255, 255, 255],
  sugestao: [255, 140, 30],
};

/** Cor "vista do alto" de um ponto: água pela profundidade, chão pela mata, areia, pedra e altura, com o relevo. */
function corNatural(sim, x, z) {
  const T = sim.espelho.terreno;
  const F = sim.espelho.floresta;
  const tb = terrenoBase(sim);
  const i = Math.round((x - T.origem[0]) / T.passo);
  const j = Math.round((z - T.origem[1]) / T.passo);
  const a = i >= 0 && j >= 0 && i < T.n && j < T.n ? T.agua[j * T.n + i] : AGUA.MAR;
  const h = alturaEm(T, x, z);
  const { s, decl } = sombra(T, x, z);
  if (a === AGUA.MAR) return mistura(COR.marRaso, COR.marFundo, cl(-h / 14));
  if (a === AGUA.RIO) return COR.rio;
  if (a === AGUA.LAGOA) return mistura(COR.lagoa, COR.marFundo, cl((tb.mapa.lagoa.nivel - h) / 8));
  const fi = Math.floor((x - F.origem[0]) / F.passo);
  const fj = Math.floor((z - F.origem[1]) / F.passo);
  const d = fi >= 0 && fj >= 0 && fi < F.n && fj < F.n ? F.dens[fj * F.n + fi] / 255 : 0;
  let c = mistura(COR.pasto, COR.capim, cl((h - 4) / 30));
  if (h < 3.2 && decl < 0.08) c = mistura(COR.areia, c, cl((h - 2) / 1.2));
  c = mistura(c, COR.alto, cl((h - 120) / 250));
  c = mistura(c, COR.mata, cl(d * 1.1));
  c = mistura(c, COR.pedra, cl((decl - 0.9) / 0.5) * (1 - d * 0.6));
  const luz = 0.55 + 0.75 * s;
  return [c[0] * luz, c[1] * luz, c[2] * luz];
}

function fundoNatural(sim, img) {
  for (let j = 0; j < img.h; j++) {
    for (let i = 0; i < img.w; i++) {
      const c = corNatural(sim, img.x0 + (i + 0.5) * img.m, img.z0 + (j + 0.5) * img.m);
      img.pintar(i, j, c);
    }
  }
}

function amostrasAresta(A, e, passo) {
  const p = A.p.subarray(8 * e, 8 * e + 8);
  const tab = tabelaArco(p);
  const comp = tab[16];
  const n = Math.max(1, Math.ceil(comp / passo));
  const out = [];
  const q = [0, 0];
  for (let k = 0; k <= n; k++) {
    ponto(p, tDoArco(tab, (comp * k) / n), q);
    out.push([q[0], q[1]]);
  }
  return out;
}

function desenharVias(sim, img) {
  const A = sim.tabelas.arestas;
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e]) continue;
    const tipo = VIAS_ORDEM[A.tipo[e]];
    const larg = Math.max(VIAS[tipo].largura, img.m * 1.6);
    const cor = tipo === 'rodovia' ? COR.rodovia : tipo === 'terra' ? COR.terra : COR.rua;
    img.linha(amostrasAresta(A, e, 6), larg, A.flags[e] & ARESTA.PONTE ? [200, 200, 200] : cor);
  }
}

function desenharPredios(sim, img) {
  const P = sim.tabelas.predios;
  for (let i = 0; i < P.n; i++) {
    if (!P.viva[i]) continue;
    img.poligono(cantosRetangulo(P.x[i], P.z[i], P.rot[i], P.w[i], P.d[i]), COR.predio);
  }
}

function desenharInicio(sim, img, larg) {
  const tb = terrenoBase(sim);
  const { mapa } = tb;
  const [[i0, j0], [i1, j1]] = mapa.inicio;
  const x0 = mapa.origem[0] + i0 * mapa.ladrilho;
  const z0 = mapa.origem[1] + j0 * mapa.ladrilho;
  const x1 = mapa.origem[0] + (i1 + 1) * mapa.ladrilho;
  const z1 = mapa.origem[1] + (j1 + 1) * mapa.ladrilho;
  img.contorno([x0, z0, x1, z0, x1, z1, x0, z1], larg, COR.inicio, 0.9);
}

function desenharLadrilhos(sim, img) {
  const L = sim.espelho.ladrilhos;
  const tb = terrenoBase(sim);
  const { mapa } = tb;
  for (let j = 0; j < L.n; j++) {
    for (let i = 0; i < L.n; i++) {
      const x0 = mapa.origem[0] + i * mapa.ladrilho;
      const z0 = mapa.origem[1] + j * mapa.ladrilho;
      const e = L.estado[j * L.n + i];
      const a = e === LADRILHO.COMPRAVEL ? 0.35 : 0.12;
      img.contorno([x0, z0, x0 + mapa.ladrilho, z0, x0 + mapa.ladrilho, z0 + mapa.ladrilho, x0, z0 + mapa.ladrilho], img.m, COR.ladrilho, a);
    }
  }
}

function desenharSugestoes(sim, img) {
  for (const s of sim.q.sugestoes()) {
    if (s.tipo === 'via') img.linha(s.pontos, Math.max(24, img.m * 2), COR.sugestao, 0.85, 28);
    else if (s.tipo === 'zona') img.contorno(s.pontos.flat(), Math.max(3, img.m), s.zona.startsWith('res') ? [25, 158, 112] : [57, 135, 229], 0.9, 12);
    else if (s.tipo === 'no') img.disco(s.x, s.z, Math.max(22, img.m * 4), [255, 230, 60]);
    else img.disco(s.x, s.z, Math.max(14, img.m * 3), COR.sugestao);
  }
}

/** Grava os PNG do mapa na pasta. Devolve os caminhos. */
export function desenharMapa(sim, pasta) {
  mkdirSync(pasta, { recursive: true });
  const T = sim.espelho.terreno;
  const lado = (T.n - 1) * T.passo;
  const [ox, oz] = T.origem;
  const arquivos = [];
  const salvar = (nome, img) => {
    const c = join(pasta, nome);
    gravarPng(c, img);
    arquivos.push(c);
  };
  // 1. mapa inteiro, vista natural com vias, Vila, área inicial e ladrilhos
  const geral = new Imagem(1024, ox, oz, lado);
  fundoNatural(sim, geral);
  desenharVias(sim, geral);
  desenharPredios(sim, geral);
  desenharLadrilhos(sim, geral);
  desenharInicio(sim, geral, 16);
  salvar('mapa.png', geral);
  // 2. área inicial ampliada (uns 2 m por pixel, com 128 m de margem), com as sugestões
  const tb = terrenoBase(sim);
  const { mapa } = tb;
  const ix0 = mapa.origem[0] + mapa.inicio[0][0] * mapa.ladrilho;
  const iz0 = mapa.origem[1] + mapa.inicio[0][1] * mapa.ladrilho;
  const ladoInicio = (mapa.inicio[1][0] - mapa.inicio[0][0] + 1) * mapa.ladrilho;
  const perto = new Imagem(1024, ix0 - 128, iz0 - 128, ladoInicio + 256);
  fundoNatural(sim, perto);
  desenharVias(sim, perto);
  desenharPredios(sim, perto);
  perto.contorno(Float64Array.from(GLEBA_ENVELOPE.contorno), 3, [255, 255, 255], 0.8, 16);
  desenharSugestoes(sim, perto);
  desenharInicio(sim, perto, 4);
  salvar('inicio.png', perto);
  // 3. relevo puro (sombra e cor pela altura) com a água
  const relevo = new Imagem(1024, ox, oz, lado);
  for (let j = 0; j < relevo.h; j++) {
    for (let i = 0; i < relevo.w; i++) {
      const x = ox + (i + 0.5) * relevo.m;
      const z = oz + (j + 0.5) * relevo.m;
      const h = alturaEm(T, x, z);
      const { s } = sombra(T, x, z);
      const a = T.agua[Math.round((z - oz) / T.passo) * T.n + Math.round((x - ox) / T.passo)];
      let c;
      if (a) c = a === AGUA.MAR ? mistura(COR.marRaso, COR.marFundo, cl(-h / 20)) : [60, 110, 150];
      else {
        const t = cl(h / 450);
        c = mistura(mistura([120, 150, 90], [190, 170, 110], cl(t * 2)), [240, 235, 228], cl(t * 2 - 1));
        c = c.map((v) => v * (0.45 + 0.8 * s));
      }
      relevo.pintar(i, j, c);
    }
  }
  salvar('relevo.png', relevo);
  // 4. água (categorias)
  const agua = new Imagem(1024, ox, oz, lado);
  const CA = [[236, 230, 214], [40, 90, 150], [70, 150, 190], [60, 170, 160]];
  for (let j = 0; j < agua.h; j++) {
    for (let i = 0; i < agua.w; i++) {
      const k = Math.round(j * (T.n - 1) / (agua.h - 1)) * T.n + Math.round(i * (T.n - 1) / (agua.w - 1));
      agua.pintar(i, j, CA[T.agua[k]]);
    }
  }
  desenharInicio(sim, agua, 16);
  salvar('agua.png', agua);
  // 5. recursos: o que domina, com a intensidade, sobre o relevo em cinza
  const rec = new Imagem(1024, ox, oz, lado);
  const E = sim.espelho.recursos;
  const CR = { rocha: [150, 150, 160], areia: [240, 210, 120], argila: [200, 90, 50], calcario: [245, 245, 245], fertil: [90, 170, 60], subterranea: [70, 140, 230] };
  const cam = sim.q.camada('recursos');
  for (let j = 0; j < rec.h; j++) {
    for (let i = 0; i < rec.w; i++) {
      const x = ox + (i + 0.5) * rec.m;
      const z = oz + (j + 0.5) * rec.m;
      const { s } = sombra(T, x, z);
      const g = 60 + 120 * s;
      let c = [g, g, g];
      const ci = Math.floor((x - E.origem[0]) / E.passo);
      const cj = Math.floor((z - E.origem[1]) / E.passo);
      const kc = cj * E.n + ci;
      const cat = cam.categoria[kc];
      if (cat) c = mistura(c, CR[RECURSOS[cat - 1]], 0.3 + 0.7 * cam.dados[kc]);
      rec.pintar(i, j, c);
    }
  }
  desenharInicio(sim, rec, 16);
  salvar('recursos.png', rec);
  // 6. áreas nomeadas e sugestões sobre o mapa natural claro
  const areas = new Imagem(1024, -2048, -2048, 4096);
  fundoNatural(sim, areas);
  const CAREA = { vila: [230, 120, 60], gleba: [240, 220, 120], orla: [80, 170, 230], varzea: [150, 110, 70], morros: [120, 200, 120] };
  for (const a of sim.espelho.areas) {
    areas.poligono(a.contorno, CAREA[a.id] ?? [255, 255, 255], 0.35);
    areas.contorno(a.contorno, 6, CAREA[a.id] ?? [255, 255, 255], 0.9);
  }
  desenharVias(sim, areas);
  desenharSugestoes(sim, areas);
  desenharInicio(sim, areas, 8);
  salvar('areas.png', areas);
  return arquivos;
}

// ------------------------------------------------------------------------------------------------ vista oblíqua

/** Câmeras da vista de helicóptero: [nome, x, z, altura, guinada (0 = norte, 90 = leste), inclinação, abertura]. */
export const VISTAS = Object.freeze([
  ['vista-baia', 200, 3300, 420, 0, 11, 55],
  ['vista-cidade', 0, 600, 300, 352, 9, 60],
  ['vista-praia', -300, 1900, 160, 340, 8, 60],
]);

/**
 * Vista oblíqua em software (sem navegador), para julgar o relevo como de um helicóptero: um raio por pixel sobre a
 * grade (passos largos onde o raio passa alto sobre o máximo de cada bloco de 64 m), sol da tarde a noroeste com
 * sombra projetada, mata pela densidade, pedra pelo declive, água pela profundidade e perspectiva aérea. Não é o
 * render do jogo: é a régua do mapa.
 */
export function desenharVista(sim, arquivo, [, cx, cz, ch, guin, incl, abertura], w = 960) {
  const T = sim.espelho.terreno;
  const F = sim.espelho.floresta;
  const tb = terrenoBase(sim);
  const { n, passo } = T;
  const [ox, oz] = T.origem;
  const lado = (n - 1) * passo;
  const h = Math.round((w * 9) / 16);
  // máximo por bloco de 64 m, já com os vizinhos (andar até 64 m na horizontal não sai do máximo)
  const nb = Math.ceil(lado / 64) + 1;
  const bloco = new Float32Array(nb * nb).fill(-50);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = ((j * passo) >> 6) * nb + ((i * passo) >> 6);
    const v = T.altura[j * n + i];
    if (v > bloco[k]) bloco[k] = v;
  }
  const maxi = new Float32Array(nb * nb).fill(-50);
  for (let j = 0; j < nb; j++) for (let i = 0; i < nb; i++) {
    let m = -50;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const a = i + di;
      const b = j + dj;
      if (a >= 0 && b >= 0 && a < nb && b < nb && bloco[b * nb + a] > m) m = bloco[b * nb + a];
    }
    maxi[j * nb + i] = m;
  }
  const dentro = (x, z) => x >= ox && z >= oz && x <= ox + lado && z <= oz + lado;
  const aguaAt = (x, z) => T.agua[Math.round((z - oz) / passo) * n + Math.round((x - ox) / passo)];
  const nivelAt = (x, z, a) => (a === AGUA.MAR ? 0 : a === AGUA.LAGOA ? tb.mapa.lagoa.nivel : rioEm(tb.base, x, z).nivel);
  const chao = (x, z) => {
    const a = aguaAt(x, z);
    const g = alturaEm(T, x, z);
    return a ? Math.max(g, nivelAt(x, z, a)) : g;
  };
  const densAt = (x, z) => {
    const i = Math.floor((x - F.origem[0]) / F.passo);
    const j = Math.floor((z - F.origem[1]) / F.passo);
    return i < 0 || j < 0 || i >= F.n || j >= F.n ? 0 : F.dens[j * F.n + i] / 255;
  };
  const rad = Math.PI / 180;
  const sol = [Math.sin(305 * rad) * Math.cos(28 * rad), Math.sin(28 * rad), -Math.cos(305 * rad) * Math.cos(28 * rad)];
  const g = guin * rad;
  const p = incl * rad;
  const fw = [Math.sin(g) * Math.cos(p), -Math.sin(p), -Math.cos(g) * Math.cos(p)];
  const rt = [Math.cos(g), 0, Math.sin(g)];
  const up = [rt[1] * fw[2] - rt[2] * fw[1], rt[2] * fw[0] - rt[0] * fw[2], rt[0] * fw[1] - rt[1] * fw[0]];
  const tanF = Math.tan((abertura / 2) * rad);
  const ruidoCor = (x, z) => {
    let q = Math.imul(Math.floor(x) * 374761393 + Math.floor(z) * 668265263, 1274126177);
    q = Math.imul(q ^ (q >>> 13), 1274126177);
    return ((q ^ (q >>> 16)) >>> 0) / 4294967296;
  };
  const C = {
    ceuZ: [118, 160, 214], ceuH: [206, 220, 232], neb: [186, 204, 222], mata: [34, 58, 30], mata2: [52, 78, 38],
    pasto: [128, 138, 78], capim: [168, 158, 104], areia: [222, 208, 172], pedra: [122, 118, 108], pedra2: [168, 160, 146],
    mar: [22, 78, 104], marRaso: [60, 150, 150], lagoa: [44, 88, 84], rio: [104, 100, 74],
  };
  const img = { w, h, rgb: new Uint8Array(w * h * 3) };
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const sx = (((px + 0.5) / w) * 2 - 1) * tanF;
      const sy = (1 - ((py + 0.5) / h) * 2) * tanF * (h / w);
      const rd = [fw[0] + rt[0] * sx + up[0] * sy, fw[1] + rt[1] * sx + up[1] * sy, fw[2] + rt[2] * sx + up[2] * sy];
      const l = Math.hypot(rd[0], rd[1], rd[2]);
      rd[0] /= l;
      rd[1] /= l;
      rd[2] /= l;
      let t = 5;
      let t0 = 0;
      let bateu = false;
      let x = cx;
      let z = cz;
      while (t < 40000) {
        x = cx + rd[0] * t;
        z = cz + rd[2] * t;
        const y = ch + rd[1] * t;
        if (!dentro(x, z)) {
          if (y <= 0) {
            bateu = true;
            break;
          }
          t0 = t;
          t += Math.max(4, t * 0.01);
          continue;
        }
        const m = maxi[Math.floor((z - oz) / 64) * nb + Math.floor((x - ox) / 64)];
        if (y > m + 2) {
          t0 = t;
          t += Math.max(2, Math.min(64, rd[1] < -0.01 ? (y - m) / -rd[1] : 64));
          continue;
        }
        if (y <= chao(x, z)) {
          let a = t0;
          let b = t;
          for (let k = 0; k < 10; k++) {
            const mt = (a + b) / 2;
            if (ch + rd[1] * mt <= chao(cx + rd[0] * mt, cz + rd[2] * mt)) b = mt;
            else a = mt;
          }
          t = b;
          x = cx + rd[0] * t;
          z = cz + rd[2] * t;
          bateu = true;
          break;
        }
        t0 = t;
        t += Math.max(2, t * 0.004);
      }
      let c;
      if (!bateu) c = mistura(C.ceuH, C.ceuZ, cl(rd[1] * 3));
      else {
        const a = dentro(x, z) ? aguaAt(x, z) : AGUA.MAR;
        if (a) {
          const prof = dentro(x, z) ? nivelAt(x, z, a) - alturaEm(T, x, z) : 20;
          c = a === AGUA.MAR ? mistura(C.marRaso, C.mar, cl(prof / 10)) : a === AGUA.LAGOA ? mistura(C.marRaso, C.lagoa, cl(prof / 3)) : C.rio;
          c = mistura(c, C.ceuH, 0.15 + 0.6 * (1 - Math.max(0, -rd[1])) ** 5);
        } else {
          const e = 4;
          const hx = (alturaEm(T, x + e, z) - alturaEm(T, x - e, z)) / (2 * e);
          const hz = (alturaEm(T, x, z + e) - alturaEm(T, x, z - e)) / (2 * e);
          const nl = Math.hypot(hx, 1, hz);
          const decl = Math.hypot(hx, hz);
          const hh = alturaEm(T, x, z);
          let lam = (-hx * sol[0] + sol[1] - hz * sol[2]) / nl;
          if (lam > 0) {
            for (let q = 12; q < 900; q *= 1.25) {
              if (alturaEm(T, x + sol[0] * q, z + sol[2] * q) > hh + 0.5 + sol[1] * q) {
                lam *= 0.25;
                break;
              }
            }
          }
          const d = densAt(x, z);
          c = mistura(C.pasto, C.capim, cl((hh - 6) / 40) * 0.6 + ruidoCor(x / 37, z / 37) * 0.15);
          if (hh < 3.2 && decl < 0.1) c = mistura(C.areia, c, cl((hh - 1.8) / 1.4));
          c = mistura(c, mistura(C.mata, C.mata2, ruidoCor(x / 11, z / 11)), cl(d * 1.15));
          c = mistura(c, mistura(C.pedra, C.pedra2, ruidoCor(x / 9, z / 9)), cl((decl - 0.75) / 0.45) * (1 - d * 0.7));
          const luz = 0.34 + 0.12 / nl + 0.95 * Math.max(0, lam);
          c = [c[0] * luz, c[1] * luz * 0.93, c[2] * luz * 0.8];
        }
        c = mistura(c, C.neb, cl((1 - Math.exp(-t / 9000)) * 0.95));
      }
      const k = (py * w + px) * 3;
      for (let q = 0; q < 3; q++) img.rgb[k + q] = c[q] > 255 ? 255 : c[q] < 0 ? 0 : c[q];
    }
  }
  gravarPng(arquivo, img);
  return arquivo;
}

// ------------------------------------------------------------------------------------------------ conferências

/** Confere o mapa autoral. Devolve { ok, falhas: [texto], medidas }. */
export function conferirMapa(sim) {
  const falhas = [];
  const T = sim.espelho.terreno;
  const tb = terrenoBase(sim);
  const { mapa } = tb;
  const [[a0, b0], [a1, b1]] = mapa.inicio;
  const x0 = mapa.origem[0] + a0 * mapa.ladrilho;
  const z0 = mapa.origem[1] + b0 * mapa.ladrilho;
  const x1 = mapa.origem[0] + (a1 + 1) * mapa.ladrilho;
  const z1 = mapa.origem[1] + (b1 + 1) * mapa.ladrilho;
  const i0 = Math.round((x0 - T.origem[0]) / T.passo);
  const j0 = Math.round((z0 - T.origem[1]) / T.passo);
  const i1 = Math.round((x1 - T.origem[0]) / T.passo);
  const j1 = Math.round((z1 - T.origem[1]) / T.passo);
  // componentes de terra firme na área inicial (4 vizinhos)
  const w = i1 - i0 + 1;
  const h = j1 - j0 + 1;
  const rot = new Int32Array(w * h).fill(-1);
  let componentes = 0;
  const tamanhos = [];
  let terra = 0;
  const fila = new Int32Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      if (rot[k] >= 0 || T.agua[(j0 + j) * T.n + i0 + i] !== AGUA.TERRA) continue;
      let ini = 0;
      let fim = 0;
      fila[fim++] = k;
      rot[k] = componentes;
      let n = 0;
      while (ini < fim) {
        const q = fila[ini++];
        n++;
        const qi = q % w;
        const qj = (q / w) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = qi + di;
          const nj = qj + dj;
          if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
          const nk = nj * w + ni;
          if (rot[nk] >= 0 || T.agua[(j0 + nj) * T.n + i0 + ni] !== AGUA.TERRA) continue;
          rot[nk] = componentes;
          fila[fim++] = nk;
        }
      }
      tamanhos.push(n);
      terra += n;
      componentes++;
    }
  }
  if (componentes !== 1) falhas.push(`área inicial com ${componentes} componentes de terra (${tamanhos.join(', ')} amostras)`);
  if (!tb.base.assado) falhas.push('relevo assado velho ou ausente: rode node ferramentas/mapa.mjs --assar');
  // recursos dentro e fora
  const E = sim.espelho.recursos;
  const dentro = (i, j) => {
    const x = E.origem[0] + (i + 0.5) * E.passo;
    const z = E.origem[1] + (j + 0.5) * E.passo;
    return x >= x0 && x < x1 && z >= z0 && z < z1;
  };
  const maxDentro = {};
  const maxFora = {};
  for (const tipo of RECURSOS) {
    maxDentro[tipo] = 0;
    maxFora[tipo] = 0;
    for (let j = 0; j < E.n; j++) {
      for (let i = 0; i < E.n; i++) {
        const v = E[tipo][j * E.n + i];
        if (dentro(i, j)) maxDentro[tipo] = Math.max(maxDentro[tipo], v);
        else maxFora[tipo] = Math.max(maxFora[tipo], v);
      }
    }
  }
  for (const tipo of ['rocha', 'areia', 'argila']) if (maxDentro[tipo] < 150) falhas.push(`pouca ${tipo} na área inicial (${maxDentro[tipo]})`);
  if (maxDentro.calcario > 0) falhas.push('calcário dentro da área inicial');
  if (maxFora.calcario < 150) falhas.push('calcário faltando fora da área inicial');
  const orla = sim.espelho.areas.find((a) => a.id === 'orla');
  if (orla) {
    for (let k = 0; k < orla.contorno.length; k += 2) {
      const x = orla.contorno[k];
      const z = orla.contorno[k + 1];
      if (x > x0 && x < x1 && z > z0 && z < z1) falhas.push('orla nobre dentro da área inicial');
    }
  }
  // Vila e rodovia
  const M = sim.json.mapa;
  const nPredios = M.predios.length;
  if (nPredios < 50 || nPredios > 75) falhas.push(`Vila com ${nPredios} prédios (esperado ~60)`);
  if (M.moradores < 330 || M.moradores > 380) falhas.push(`Vila com ${M.moradores} moradores (esperado ~350)`);
  // a Vila inteira na área inicial (D3: os 4 x 4 ficam em volta da gleba, da Vila e da entrada): plantas e ruas
  const P = sim.tabelas.predios;
  const A = sim.tabelas.arestas;
  const dentroInicio = (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
  let vilaFora = 0;
  for (const ref of M.predios) {
    const i = ref % 1048576;
    const c = cantosRetangulo(P.x[i], P.z[i], P.rot[i], P.w[i], P.d[i]);
    for (let k = 0; k < 8; k += 2) if (!dentroInicio(c[k], c[k + 1])) vilaFora++;
  }
  for (const [id, refs] of Object.entries(M.ruas)) {
    if (id === 'estrada') continue; // a estrada de terra sobe até a rodovia, fora da área inicial
    for (const ref of refs) for (const [x, z] of amostrasAresta(A, ref % 1048576, 8)) if (!dentroInicio(x, z)) vilaFora++;
  }
  if (vilaFora) falhas.push(`Vila fora da área inicial (${vilaFora} pontos de plantas e ruas)`);
  if (M.entrada < 0) falhas.push('sem nó de entrada');
  if (M.ponte < 0) falhas.push('sem a ponte da rodovia');
  if (sim.erros.length) falhas.push(`erros na simulação: ${sim.erros[0].mensagem}`);
  const val = sim.validar();
  if (val.length) falhas.push(`validar: ${val[0].erro}`);
  const hash = hexHash(fnv1aTipado(new Uint8Array(tb.base.altura.buffer)));
  return {
    ok: !falhas.length,
    falhas,
    medidas: { componentes, terraInicio: terra, maxDentro, maxFora, predios: nPredios, moradores: M.moradores, vilaFora, hashBase: hash, msTerreno: tb.base.ms },
  };
}

// ------------------------------------------------------------------------------------------------ linha de comando

function args(argv) {
  const o = { saida: null, semente: 'heldopolis-1', soConferir: false, assar: false, conferirAssado: false, vista: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--saida') o.saida = argv[++i];
    else if (argv[i] === '--semente') o.semente = argv[++i];
    else if (argv[i] === '--so-conferir') o.soConferir = true;
    else if (argv[i] === '--assar') o.assar = true;
    else if (argv[i] === '--conferir-assado') o.conferirAssado = true;
    else if (argv[i] === '--vista') o.vista = true;
  }
  return o;
}

/** Caminho do módulo gerado com o relevo assado. */
export const ARQUIVO_ASSADO = resolve(dirname(fileURLToPath(import.meta.url)), '../fonte/sim/mundo/relevo-assado.js');

/** Assa o relevo dos maciços do mapa: { texto (o módulo), medidas, rel, E }. */
export function assar(mapa = MAPA_HELDOPOLIS, par = PARAMETROS) {
  const C = camposDoMapa(mapa);
  const r = assarRelevo(mapa, C, FERRAMENTAS, par);
  const m = r.modulo;
  const linhas = [
    '// Gerado por `node ferramentas/mapa.mjs --assar` (dona: S1a). Não edite à mão: mude os controles em',
    '// data/mapa-heldopolis.js e asse de novo. Relevo dos maciços acima da planície na grade de 32 m, com a erosão fluvial',
    `// (mundo/erosao.js, ${par.iteracoes} iterações), quantizado a ${m.escala} m e comprimido (previsão MED, corridas de`,
    '// resíduos nulos e Exp-Golomb); mundo/relevo.js decodifica.',
    'export const RELEVO_ASSADO = Object.freeze({',
    `  mapa: '${m.mapa}',`,
    `  versao: ${m.versao},`,
    `  controles: '${m.controles}',`,
    `  n: ${m.n},`,
    `  passo: ${m.passo},`,
    `  k: ${m.k},`,
    `  escala: ${m.escala},`,
    `  hash: '${m.hash}',`,
    `  dados: '${m.dados}',`,
    m.detalhe
      ? `  detalhe: Object.freeze({ x0: ${m.detalhe.x0}, z0: ${m.detalhe.z0}, n: ${m.detalhe.n}, passo: ${m.detalhe.passo}, k: ${m.detalhe.k}, escala: ${m.detalhe.escala}, hash: '${m.detalhe.hash}',\n    dados: '${m.detalhe.dados}' }),`
      : '  detalhe: null,',
    '});',
    '',
  ];
  return { texto: linhas.join('\n'), medidas: r.medidas, rel: r.rel, E: r.E };
}

async function principal() {
  const o = args(process.argv.slice(2));
  if (o.assar) {
    const t0 = performance.now();
    const r = assar();
    writeFileSync(ARQUIVO_ASSADO, r.texto);
    const kb = (r.medidas.bytes / 1024).toFixed(1);
    console.log(`mapa: relevo assado em ${((performance.now() - t0) / 1000).toFixed(1)} s, ${kb} KB, erro máximo ${r.medidas.erroMax.toFixed(3)} m`);
    console.log(`  ${ARQUIVO_ASSADO}`);
    return;
  }
  if (o.conferirAssado) {
    // assa de novo na memória e compara com o módulo gravado (a erosão é determinística)
    const { readFileSync } = await import('node:fs');
    const igual = readFileSync(ARQUIVO_ASSADO, 'utf8') === assar().texto;
    console.log(igual ? 'mapa: o relevo assado confere com os controles e o assador' : 'mapa: o relevo assado NÃO confere: rode --assar');
    if (!igual) process.exit(1);
    return;
  }
  const t0 = performance.now();
  const sim = criarSimulacao({ semente: o.semente, cronometro: () => performance.now() });
  const t1 = performance.now();
  const r = conferirMapa(sim);
  console.log(`mapa: simulação criada em ${(t1 - t0).toFixed(0)} ms (grade base em ${r.medidas.msTerreno?.toFixed(0) ?? '?'} ms, hash ${r.medidas.hashBase})`);
  console.log(`mapa: área inicial com ${r.medidas.componentes} componente de terra (${r.medidas.terraInicio} amostras); Vila com ${r.medidas.predios} prédios e ${r.medidas.moradores} moradores`);
  console.log(`mapa: recursos na área inicial ${JSON.stringify(r.medidas.maxDentro)}; fora ${JSON.stringify(r.medidas.maxFora)}`);
  if (!o.soConferir) {
    const pasta = resolve(o.saida ?? join(tmpdir(), 'heldopolis-mapa'));
    const arquivos = desenharMapa(sim, pasta);
    if (o.vista) for (const v of VISTAS) arquivos.push(desenharVista(sim, join(pasta, `${v[0]}.png`), v));
    console.log(`mapa: ${arquivos.length} imagens em ${pasta}`);
    for (const a of arquivos) console.log(`  ${a}`);
  }
  if (!r.ok) {
    console.log(`mapa: falhas\n  ${r.falhas.join('\n  ')}`);
    process.exit(1);
  }
  console.log('mapa ok');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await principal();
