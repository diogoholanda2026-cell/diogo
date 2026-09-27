// Relevo dos maciços (serras, planaltos, morros de mata e morrotes) acima da planície (dona: S1a).
//
// O mapa autoral dá os controles (cristas com altura e largura, esporões, planaltos, morros); daqui sai o ENVELOPE, a
// forma lisa dos maciços. A forma final é o envelope entalhado por erosão fluvial (vales que se ramificam, espigões,
// grotas): a conta é pesada demais para a abertura, então `node ferramentas/mapa.mjs --assar` roda a erosão
// (mundo/erosao.js) na grade grossa de 32 m (o mapa inteiro) e numa janela de 16 m em volta da área inicial (os morros
// da cidade, que a câmera vê de perto), e grava tudo comprimido em mundo/relevo-assado.js. Na abertura,
// relevoDoMapa() só decodifica. O assado carrega o hash dos controles e a versão do assador: se alguém muda o mapa ou a
// conta sem assar de novo, o teste acusa (também assando de novo e comparando) e a abertura usa o envelope liso (o jogo
// não quebra, só perde os vales).
//
// Tudo é conta de soma, produto, raiz e piso (o mesmo bit no Node, no navegador e no worker).
import { smoothstep, jsonCanonico } from '../../comum/util.js';
import { fnv1aTexto, hexHash } from '../../comum/hash.js';
import { RELEVO_ASSADO } from './relevo-assado.js';

/** Escala da quantização do assado (metros por unidade). */
export const ESCALA_RELEVO = 0.5;

// ------------------------------------------------------------------------------------------------ controles

/**
 * Versão do assador (erosao.js e o envelope daqui): quem muda a conta do relevo sobe a versão e assa de novo; um
 * assado de outra versão não vale (a abertura cai no envelope liso e o teste do mundo acusa).
 * 2: o fundo do vale sobe com o rio no curso de cima (o rio não corre por cima do chão).
 */
export const VERSAO_ASSADO = 2;

/** Campos do mapa que entram na forma dos maciços (o hash deles vai no assado; os córregos entram na planície). */
const CONTROLES = ['semente', 'n', 'passo', 'origem', 'costa', 'serras', 'morros', 'planaltos', 'morrotes', 'detalheRelevo', 'rio', 'lagoa', 'lagoas', 'corregos', 'planicie', 'rodovia'];

/** Hash dos controles do relevo de um mapa (hex de 8 dígitos) e a versão do assador. */
export function hashControles(mapa, versao = VERSAO_ASSADO) {
  const c = { versao };
  for (const k of CONTROLES) c[k] = mapa[k] ?? null;
  return hexHash(fnv1aTexto(jsonCanonico(c)));
}

// ------------------------------------------------------------------------------------------------ envelope

/**
 * Envelope dos maciços acima da planície, nos nós de uma grade quadrada { nc, pc, ox, oz } (a grossa C.G, ou a do
 * detalhe): Float32Array nc², 0 fora dos maciços. `F` (as ferramentas de terreno.js: densificar, campoPolilinha,
 * preencherPoligono, ruido, fbm, amostrar e a planície) evita importar terreno.js aqui (terreno.js importa este módulo).
 *
 *  - cristas e esporões (mapa.serras): perfil em S da crista ao pé (crista redonda, pé côncavo), altura modulada ao
 *    longo da crista (picos e selas) e a leitura da distância deslocada por um ruído lento (o contorno não é reto);
 *  - planaltos: sobem da borda (deslocada) até a cota, com a ondulação lenta e o mar de morros;
 *  - morros de mata (forma 'morro'): uma crista curta envergada, com cume e ombros, espigões nos flancos e o lado da face
 *    mais em pé; os pães ('pao') ficam de fora (monólitos de granito, feitos na grade fina por terreno.js);
 *  - morrotes: colinas longe da cidade e da costa, pelo ruído;
 *  - faixa da rodovia: tudo baixa até o chão perto do eixo da BR.
 */
export function envelope(mapa, C, F, grade = C.G) {
  const G = grade;
  const { nc, pc, ox, oz } = G;
  const NC = nc * nc;
  // campo da grade grossa no nó k desta grade (a mesma grade: leitura direta)
  const campo = G === C.G ? (D, k) => D[k] : (D, k) => F.amostrar(D, C.G.nc, C.G.pc, C.G.ox, C.G.oz, ox + (k % nc) * pc, oz + ((k / nc) | 0) * pc);
  const E = new Float32Array(NC);
  const s0 = F.sementeDe(mapa.semente) + 404;
  // deslocamento lento da leitura (contornos que serpenteiam): duas oitavas, 1.500 m e 520 m
  const wx = new Float32Array(NC);
  const wz = new Float32Array(NC);
  for (let j = 0; j < nc; j++) {
    const z = oz + j * pc;
    for (let i = 0; i < nc; i++) {
      const x = ox + i * pc;
      const k = j * nc + i;
      wx[k] = 150 * F.ruido(x / 1500, z / 1500, s0 + 1) + 55 * F.ruido(x / 520, z / 520, s0 + 3);
      wz[k] = 150 * F.ruido(x / 1500, z / 1500, s0 + 2) + 55 * F.ruido(x / 520, z / 520, s0 + 4);
    }
  }
  const ler = (D, k) => F.amostrar(D, nc, pc, ox, oz, ox + (k % nc) * pc + wx[k], oz + ((k / nc) | 0) * pc + wz[k]);

  // cristas
  let q = 0;
  for (const serra of mapa.serras) {
    q++;
    const L = F.densificar(serra.pontos, 50);
    let faixa = 0;
    for (const p of serra.pontos) if (p[3] > faixa) faixa = p[3];
    const Cc = F.campoPolilinha(G, L, faixa + 260, { longe: faixa + 400, comLado: false });
    const sq = s0 + 7919 * q;
    const total = L.s[L.n - 1];
    for (let k = 0; k < NC; k++) {
      if (Cc.dist[k] > faixa + 240) continue;
      const d = ler(Cc.dist, k);
      if (!(d < faixa)) continue;
      let s = ler(Cc.arco, k);
      s = s < 0 ? 0 : s > total ? total : s;
      const W = F.atributoNoArco(L, 1, s) * (0.88 + 0.24 * (0.5 + 0.5 * F.ruido(s / 900, 3.7, sq + 5)));
      const u = d / W;
      if (u >= 1) continue;
      // picos e selas: a altura anda com um ruído de 700 m ao longo da crista (mais nas serras altas)
      const H = F.atributoNoArco(L, 0, s) * (1 + (serra.picos ?? 0.16) * F.ruido(s / 700, 0.5, sq));
      const t = u < 0 ? 0 : u;
      const h = H * (1 - t * t * (3 - 2 * t));
      if (h > E[k]) E[k] = h;
    }
  }

  // planaltos
  for (const [p, pl] of (mapa.planaltos ?? []).entries()) {
    const L = F.densificar(pl.contorno.map(([x, z]) => [x, z]), 100, true);
    const Cc = F.campoPolilinha(G, L, pl.borda + 260, { fechado: true, longe: pl.borda + 400, comLado: false });
    const dentro = F.preencherPoligono(G, L.x, L.z);
    const sp = s0 + 3571 * (p + 1);
    // distância com sinal (+ dentro), lida deslocada
    const sd = new Float32Array(NC);
    for (let k = 0; k < NC; k++) sd[k] = dentro[k] ? Cc.dist[k] : -Cc.dist[k];
    for (let k = 0; k < NC; k++) {
      if (sd[k] < -300) continue;
      const d = ler(sd, k);
      if (d <= 0) continue;
      const x = ox + (k % nc) * pc;
      const z = oz + ((k / nc) | 0) * pc;
      const w = smoothstep(0, pl.borda, d);
      // mar de morros: ondulação lenta e morros de 300 a 700 m (a erosão abre os vales entre eles)
      const h = w * (pl.cota + pl.ondulacao * F.fbm(x / 1400, z / 1400, sp, 2) + 0.3 * pl.cota * F.fbm(x / 520, z / 520, sp + 1, 3));
      if (h > E[k]) E[k] = h;
    }
  }

  // morros de mata (os pães ficam para a grade fina): uma crista curta ao longo do eixo maior (ang), com o cume no meio
  // e ombros mais baixos; a encosta desce em S dos dois lados, mais em pé do lado da face (a erosão faz os espigões)
  for (const [m, morro] of mapa.morros.entries()) {
    if (morro.forma === 'pao') continue;
    const base = F.planicieEm(C, morro.x, morro.z);
    const A = Math.max(0, morro.h - base);
    const cs = F.cos(morro.ang);
    const sn = F.sen(morro.ang);
    const r = Math.max(morro.rx, morro.rz) * 1.25 + 60;
    const sm = s0 + 104729 * (m + 1);
    const forte = morro.forte ?? 0;
    // o lado da face no eixo menor (lz cresce na direção (-sen, cos) do ângulo)
    const ladoFace = forte ? (F.cos(morro.face) * -sn + F.sen(morro.face) * cs >= 0 ? 1 : -1) : 0;
    const curva = morro.curva ?? 0.12;
    const i0 = Math.max(0, Math.floor((morro.x - r - ox) / pc));
    const i1 = Math.min(nc - 1, Math.ceil((morro.x + r - ox) / pc));
    const j0 = Math.max(0, Math.floor((morro.z - r - oz) / pc));
    const j1 = Math.min(nc - 1, Math.ceil((morro.z + r - oz) / pc));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * nc + i;
        // leitura deslocada fraca (o morro é pequeno e o cume fica onde o mapa pôs)
        const dx = ox + i * pc + 0.2 * wx[k] - morro.x;
        const dz = oz + j * pc + 0.2 * wz[k] - morro.z;
        const lx = (dx * cs + dz * sn) / morro.rx;
        // a crista não é reta: enverga um pouco (curva) e serpenteia devagar
        const ax = lx < 0 ? -lx : lx;
        if (ax >= 1.12) continue;
        const l2 = ax * ax;
        // o cume fica onde o mapa pôs; para os lados a crista enverga, serpenteia e ganha ombros e selas (ruído lento)
        const lz = (dz * cs - dx * sn) / morro.rz - curva * l2 - 0.2 * l2 * F.ruido(lx * 1.6, 7.1, sm + 3);
        let Hc = 1 - 0.55 * l2 - 0.45 * l2 * l2;
        if (Hc <= 0) continue;
        Hc *= 1 + 0.8 * l2 * (1 - l2) * F.ruido(lx * 2.1, 0.5, sm);
        const w = Math.sqrt(1 - 0.8 * (l2 < 1 ? l2 : 1)) + 0.12;
        let u = (lz < 0 ? -lz : lz) / w;
        if (ladoFace && (lz > 0 ? 1 : -1) === ladoFace) u *= 1 + 0.45 * forte;
        if (u >= 1) continue;
        // espigões e grotas nos flancos: o contorno ondula ao longo da crista, mais na meia encosta
        u *= 1 + 0.5 * u * (1 - u) * F.ruido(lx * 4.2, (lz > 0 ? 3.3 : -3.3) + u * 1.1, sm + 9);
        if (u >= 1) continue;
        const h = A * Hc * (1 - u * u * (3 - 2 * u));
        if (h > E[k]) E[k] = h;
      }
    }
  }

  // morrotes: colinas longe da cidade e da costa (só as cristas do ruído sobem)
  const MT = mapa.morrotes;
  if (MT) {
    for (let k = 0; k < NC; k++) {
      const sdc = campo(C.costa.sd, k);
      if (sdc < 150) continue;
      const x = ox + (k % nc) * pc;
      const z = oz + ((k / nc) | 0) * pc;
      const longe = smoothstep(MT.raio[0], MT.raio[1], Math.sqrt(x * x + z * z));
      if (longe <= 0) continue;
      const c = 0.7 * F.ruido(x / 950, z / 950, s0 + 31) + 0.3 * F.ruido(x / 420, z / 420, s0 + 37);
      const h = MT.altura * longe * smoothstep(0.05, 0.75, c) * smoothstep(150, 900, sdc);
      if (h > E[k]) E[k] = h;
    }
  }

  // vale do rio: o maciço desce até a várzea numa encosta de largura pela altura (declive médio perto de 50%), para a
  // erosão e o entalhe do rio na grade fina (terreno.js) contarem a mesma história, sem paredão na beira da várzea.
  // No curso de cima, onde a água corre acima da planície (a serra), o fundo do vale fica no nível do rio: o vale sobe
  // com ele, e o rio não passa por cima do chão
  const R = { a: 0, hw: 0, nivel: 0, varzea: 0, lado: 1, v: 0 };
  for (let k = 0; k < NC; k++) {
    const x = ox + (k % nc) * pc;
    const z = oz + ((k / nc) | 0) * pc;
    F.rioNosCampos(C, x, z, R);
    // da borda da várzea (medida do eixo da faixa de meandros) sobe a encosta do vale, de largura pela altura do
    // maciço (declive médio perto de 50%)
    const borda = 0.7 * R.varzea;
    const largura = 200 + 1.3 * E[k];
    if (!(R.v < borda + largura)) continue;
    const s = smoothstep(borda, borda + largura, R.v);
    const fundo = fundoDoVale(C, F, x, z, R.nivel);
    E[k] = fundo > 0 ? fundo + (E[k] - fundo) * s : E[k] * s;
  }

  // faixa da rodovia: o relevo baixa até o chão perto do eixo da BR
  if (C.corredor) {
    const { dist, fundo, largura } = C.corredor;
    for (let k = 0; k < NC; k++) {
      const d = campo(dist, k);
      if (d < largura) E[k] *= smoothstep(fundo, largura, d);
    }
  }
  return E;
}

/**
 * Quanto o fundo do vale fica acima da planície em (x, z), no curso de cima do rio (nível da água a partir de uns 6 a
 * 12 m, na serra): o nível mais 0,8 m menos a planície, ou 0 onde o rio corre na planície ou abaixo dela (a várzea e a
 * foz, que o entalhe da grade fina resolve). O envelope e as bases da erosão usam a mesma conta.
 */
export function fundoDoVale(C, F, x, z, nivel) {
  const peso = smoothstep(6, 12, nivel);
  if (peso <= 0) return 0;
  const f = (nivel + 0.8 - F.planicieEm(C, x, z)) * peso;
  return f > 0 ? f : 0;
}

/**
 * Lobos de um morro: o principal e dois ou três ombros menores, em coordenadas da elipse (raio 1): [cx, cz, rx, rz, h].
 * Morro de verdade tem ombros e selas; o sorteio é pela semente do morro.
 */
export function lobosDoMorro(sm) {
  const mistura = (h) => {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    return (h ^ (h >>> 15)) & 15;
  };
  const lobos = [[0, 0, 1, 1, 1]];
  for (let k = 0; k < 3; k++) {
    const a = ((mistura(sm + 17 * k) + 0.5) / 16) * 6.283185307179586 + k * 2.1;
    const d = 0.4 + 0.04 * (mistura(sm + 31 * k) & 7);
    const r = 0.52 + 0.03 * (mistura(sm + 47 * k) & 7);
    const h = 0.5 + 0.04 * (mistura(sm + 59 * k) & 7);
    // cos e sen por série curta (ângulo em [0, 2 pi + 4,2]): o mesmo bit em todo lugar
    lobos.push([cosSerie(a) * d, cosSerie(a - 1.5707963267948966) * d, r * 1.15, r, h]);
  }
  return lobos;
}

/** Cosseno por redução a [-pi, pi] e série de Taylor até x^14 (erro < 1e-9; só soma, produto e piso). */
function cosSerie(a) {
  const TAU = 6.283185307179586;
  let x = a - TAU * Math.floor(a / TAU + 0.5);
  const x2 = x * x;
  let t = 1;
  let s = 1;
  for (let k = 1; k <= 7; k++) {
    t *= -x2 / ((2 * k - 1) * (2 * k));
    s += t;
  }
  return s;
}

// ------------------------------------------------------------------------------------------------ assado

const B64 = new Int16Array(128).fill(-1);
{
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < 64; i++) B64[a.charCodeAt(i)] = i;
}

/** Base64 para bytes (sem depender de atob nem de Buffer). */
export function deBase64(s) {
  let n = s.length;
  while (n > 0 && s[n - 1] === '=') n--;
  const out = new Uint8Array((n * 3) >> 2);
  let o = 0;
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < n; i++) {
    const v = B64[s.charCodeAt(i)];
    if (v < 0) throw new Error('relevo: base64 inválido');
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 255;
    }
  }
  return out;
}

/** 2 elevado a e (inteiro, e >= 0), por produtos: o mesmo número em todo lugar. */
export function dois(e) {
  let v = 1;
  for (let i = 0; i < e; i++) v *= 2;
  return v;
}

/** Leitor de bits (do mais significativo para o menos). */
class LeitorBits {
  constructor(bytes) {
    this.b = bytes;
    this.p = 0;
  }
  bit() {
    const v = (this.b[this.p >> 3] >> (7 - (this.p & 7))) & 1;
    this.p++;
    return v;
  }
  bits(n) {
    let v = 0;
    for (let i = 0; i < n; i++) v = v * 2 + this.bit();
    return v;
  }
  /** Exp-Golomb de ordem k. */
  eg(k) {
    let z = 0;
    while (this.bit() === 0) z++;
    return this.bits(z + k) + dois(z + k) - dois(k);
  }
}

/** Previsão do codec (a MED do LOCO-I: mediana de oeste, norte e oeste + norte - noroeste). */
export function prever(q, n, i, j) {
  const a = i > 0 ? q[j * n + i - 1] : 0;
  const b = j > 0 ? q[(j - 1) * n + i] : 0;
  const c = i > 0 && j > 0 ? q[(j - 1) * n + i - 1] : 0;
  const mx = a > b ? a : b;
  const mn = a > b ? b : a;
  if (c >= mx) return mn;
  if (c <= mn) return mx;
  return a + b - c;
}

/**
 * Decodifica um assado ({ n, k, dados }) em alturas acima da planície (Float32Array n², metros). O fluxo é:
 * [corrida de resíduos nulos em EG(0)] [resíduo não nulo em EG(k), em zigue-zague, menos 1] ... até cobrir n².
 */
export function decodificar(assado) {
  const { n, k } = assado;
  const N = n * n;
  const q = new Int32Array(N);
  const L = new LeitorBits(deBase64(assado.dados));
  let pos = 0;
  while (pos < N) {
    let zeros = L.eg(0);
    while (zeros-- > 0 && pos < N) {
      q[pos] = prever(q, n, pos % n, (pos / n) | 0);
      pos++;
    }
    if (pos >= N) break;
    const u = L.eg(k) + 1;
    const r = u & 1 ? -((u + 1) >> 1) : u >> 1;
    q[pos] = prever(q, n, pos % n, (pos / n) | 0) + r;
    pos++;
  }
  const out = new Float32Array(N);
  const e = assado.escala ?? ESCALA_RELEVO;
  for (let i = 0; i < N; i++) out[i] = q[i] * e;
  return out;
}

/**
 * Relevo dos maciços acima da planície de um mapa: o grosso (Float32Array nc², 32 m) e o detalhe (16 m, na janela
 * mapa.detalheRelevo), assados, se forem deste mapa e dos mesmos controles; senão o envelope liso (sem os vales e sem
 * o detalhe). `F` são as ferramentas de terreno.js.
 * @returns {{ rel: Float32Array, detalhe: { x0, z0, n, passo, rel: Float32Array } | null, assado: boolean }}
 */
export function relevoDoMapa(mapa, C, F) {
  const A = RELEVO_ASSADO;
  if (A && A.mapa === mapa.id && A.versao === VERSAO_ASSADO && A.n === C.G.nc && A.controles === hashControles(mapa)) {
    const d = A.detalhe;
    return {
      rel: decodificar(A),
      detalhe: d ? { x0: d.x0, z0: d.z0, n: d.n, passo: d.passo, rel: decodificar(d) } : null,
      assado: true,
    };
  }
  return { rel: envelope(mapa, C, F), detalhe: null, assado: false };
}
