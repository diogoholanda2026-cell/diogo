// Terreno (desenho do render 3.1 e 3.2, D4, D44, D46): troca o chão da depuração (domínio 'terreno').
//   - CDLOD numa chamada: uma grade de 16 x 16 quadrados (512 triângulos) instanciada, um nó da quadtree por
//     instância, escolhidos na CPU a cada quadro; "morph" no vértice em até três níveis (sem rachaduras nem estalos).
//   - Alturas: a grade do espelho (R32F) lida no vértice pela mesma bilinear de comum/altura.js (teste de paridade).
//   - Dados por amostra (RGBA8): normal, floresta e distância à água; uso do solo a 4 m (vias, pisos, terra batida,
//     gramados dos lotes) rasterizado na CPU pelo espelho; mapa de cor assado na GPU para o longe e para a água.
//   - Camadas do chão: paleta com albedo real e detalhe fino (procedural ou CC0, ?materiais=proc|cc0); copa da mata
//     levantando o chão onde a floresta é densa.
//   - Sobreposições no chão, 0 chamadas: campo de camada (X3a), células de zona (ferramenta de zona), ladrilhos e o
//     pincel; o passe da máscara de gramado (?passe=mascara) para o aceite de cor.
// Publica em ctx.chao (e no domínio): uniformes (a água usa os mesmos), texturas, ab(bool), usoSolo e a leitura das
// alturas para os testes.
import * as THREE from 'three';
import { GLSL_TER_VERTICE, GLSL_TER_FRAGMENTO, GLSL_ASSAR, NIVEIS_CDLOD, GRADE_NO, N_CAMADAS, MORPH_INICIO } from '../materiais/shaders/terreno.glsl.js';
import { modoMateriais, carregarCC0 } from '../materiais/texturas-chao.js';
import { AGUA, PREDIO, TIPO_PREDIO, CELULA } from '../../contratos/flags.js';
import { VIAS, VIAS_ORDEM } from '../../data/vias.js';
import { ZONAS, ZONAS_ORDEM } from '../../data/zonas.js';
import { pedeTudo } from '../ponte.js';
import { CELULA_M } from '../../contratos/espelho.js';

// ------------------------------------------------------------------------------------------------ parâmetros

/** Por perfil: primeiro alcance do CDLOD, lado do mapa de cor, alcance do detalhe e relevo das copas (m). */
export const PERFIL_TERRENO = Object.freeze({
  ultra: { r0: 1000, cor: 4096, detalhe: 600, faixa: 150, copaRelevo: 4000, aniso: 8 },
  alta: { r0: 800, cor: 2048, detalhe: 400, faixa: 120, copaRelevo: 3000, aniso: 8 },
  media: { r0: 600, cor: 2048, detalhe: 180, faixa: 60, copaRelevo: 2000, aniso: 4 },
  leve: { r0: 320, cor: 1024, detalhe: 0, faixa: 1, copaRelevo: 800, aniso: 1 },
});
export const LADO_USO = 2048; // 4 m por texel no mapa de 8.192 m
export const RAIZ_CDLOD = Object.freeze({ x: -16384, z: -16384, lado: 32768 }); // moldura de 32 km (1.4)
export const COPA_ALTURA = 18;
/** A copa mais alta que o vértice levanta (COPA_ALTURA vezes 0,72 + 0,5 do ruído, no GLSL): a caixa do nó cobre até ela. */
export const COPA_MAX = COPA_ALTURA * 1.22;
export const FORA = Object.freeze({ faixa: 1600, serra: 230, mar: 45 });
const MORPH = Object.freeze({ inicio: MORPH_INICIO, fim: 0.95 });
const MAX_NOS = 1024;

// ------------------------------------------------------------------------------------------------ puros (testados)

/** Alcances de cada nível do CDLOD: r0 x 2^nível. */
export const faixasCDLOD = (r0) => Array.from({ length: NIVEIS_CDLOD }, (_, l) => r0 * 2 ** l);

/**
 * A conta do GLSL de terAlturaBase em Float32 (para o teste de paridade com alturaEm de comum/altura.js).
 * @param {{ n: number, passo: number, origem: number[], altura: Float32Array }} T
 */
export function alturaComoGLSL(T, x, z) {
  const F = Math.fround;
  const n = T.n;
  let fx = F(F(F(x) - F(T.origem[0])) / F(T.passo));
  let fz = F(F(F(z) - F(T.origem[1])) / F(T.passo));
  fx = Math.min(Math.max(fx, 0), n - 1);
  fz = Math.min(Math.max(fz, 0), n - 1);
  const i = Math.min(Math.floor(fx), n - 2);
  const j = Math.min(Math.floor(fz), n - 2);
  const tx = F(fx - i);
  const tz = F(fz - j);
  const k = j * n + i;
  const a = T.altura;
  const l0 = F(F(a[k] * F(1 - tx)) + F(a[k + 1] * tx));
  const l1 = F(F(a[k + n] * F(1 - tx)) + F(a[k + n + 1] * tx));
  return F(F(l0 * F(1 - tz)) + F(l1 * tz));
}

const INF = 1e12;
function edt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** Distância euclidiana exata (Felzenszwalb) até a amostra mais perto com alvo(k) verdadeiro, em amostras. */
function edt2d(n, alvo) {
  const g = new Float64Array(n * n);
  for (let k = 0; k < n * n; k++) g[k] = alvo(k) ? 0 : INF;
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) f[j] = g[j * n + i];
    edt1d(f, n, d, v, z);
    for (let j = 0; j < n; j++) g[j * n + i] = d[j];
  }
  for (let j = 0; j < n; j++) {
    const o = j * n;
    for (let i = 0; i < n; i++) f[i] = g[o + i];
    edt1d(f, n, d, v, z);
    for (let i = 0; i < n; i++) g[o + i] = Math.sqrt(d[i]);
  }
  return g;
}

/**
 * Distância à água (amostras de terra) e à terra (amostras de água), em amostras da grade, e se a água que conta é o
 * mar: na terra, se a água mais perto é o mar (a praia só nasce ali); na água, se a amostra é de mar.
 * @param {Uint8Array} agua  espelho.terreno.agua (0 terra)
 * @returns {{ dist: Float32Array, mar: Uint8Array }}
 */
export function distanciaAgua(agua, n) {
  const ateMar = edt2d(n, (k) => agua[k] === AGUA.MAR);
  const ateInterior = edt2d(n, (k) => agua[k] === AGUA.RIO || agua[k] === AGUA.LAGOA);
  const ateTerra = edt2d(n, (k) => agua[k] === AGUA.TERRA);
  const dist = new Float32Array(n * n);
  const mar = new Uint8Array(n * n);
  for (let k = 0; k < n * n; k++) {
    if (agua[k] === AGUA.TERRA) {
      dist[k] = Math.min(ateMar[k], ateInterior[k]);
      mar[k] = ateMar[k] <= ateInterior[k] ? 1 : 0;
    } else {
      dist[k] = ateTerra[k];
      mar[k] = agua[k] === AGUA.MAR ? 1 : 0;
    }
  }
  return { dist, mar };
}

/** Byte da distância à água: passos de 2 m (0 a 127, até 254 m) mais 128 se a água que conta é o mar. */
export const codificarAgua = (metros, mar) => Math.min(127, Math.round(metros / 2)) + (mar ? 128 : 0);

/**
 * Dados por amostra (RGBA8): normal x e z (0,5 = 0), floresta (média das 4 células em volta) e a água pela
 * codificarAgua. ret = [i0, j0, i1, j1] refaz só um pedaço (a distância vem pronta de distanciaAgua).
 */
export function prepararDados(T, F, da, saida = null, ret = null) {
  const n = T.n;
  const h = T.altura;
  const out = saida ?? new Uint8Array(n * n * 4);
  const [i0, j0, i1, j1] = ret ?? [0, 0, n - 1, n - 1];
  const p2 = 2 * T.passo;
  const fn = F?.n ?? 0;
  for (let j = j0; j <= j1; j++) {
    const ja = Math.max(0, j - 1);
    const jb = Math.min(n - 1, j + 1);
    for (let i = i0; i <= i1; i++) {
      const ia = Math.max(0, i - 1);
      const ib = Math.min(n - 1, i + 1);
      const dx = (h[j * n + ib] - h[j * n + ia]) / (((ib - ia) * p2) / 2);
      const dz = (h[jb * n + i] - h[ja * n + i]) / (((jb - ja) * p2) / 2);
      const l = Math.hypot(dx, 1, dz);
      const k = 4 * (j * n + i);
      out[k] = Math.round((0.5 - (0.5 * dx) / l) * 255);
      out[k + 1] = Math.round((0.5 - (0.5 * dz) / l) * 255);
      let m = 0;
      if (fn) {
        let s = 0;
        let c = 0;
        for (let b = j - 1; b <= j; b++) {
          if (b < 0 || b >= fn) continue;
          for (let a = i - 1; a <= i; a++) {
            if (a < 0 || a >= fn) continue;
            s += F.dens[b * fn + a];
            c++;
          }
        }
        m = c ? s / c : 0;
      }
      out[k + 2] = Math.round(m);
      out[k + 3] = codificarAgua(da.dist[j * n + i] * T.passo, da.mar[j * n + i]);
    }
  }
  return out;
}

/**
 * Mínimos das alturas por nível de mip (a mip l cobre 2^l amostras, com uma de folga em volta), do nível 1 até 1 x 1,
 * nos tamanhos que o WebGL2 espera (floor(n / 2^l)). O nível 0 é a própria grade. De longe, perto da água, o vértice do
 * terreno desce ao mínimo da vizinhança do tamanho do passo dele (a malha grossa não cobre rio nem lagoa).
 * @returns {{ data: Float32Array, width: number, height: number }[]}  níveis 1 em diante
 */
export function mipsDeMinimos(T) {
  const out = [];
  let ant = T.altura;
  let na = T.n;
  for (let l = 1; ; l++) {
    const m = Math.max(1, Math.floor(T.n / 2 ** l));
    const d = new Float32Array(m * m);
    for (let j = 0; j < m; j++) {
      const j0 = Math.max(0, 2 * j - 1);
      const j1 = Math.min(na - 1, 2 * j + 2);
      for (let i = 0; i < m; i++) {
        const i0 = Math.max(0, 2 * i - 1);
        const i1 = Math.min(na - 1, 2 * i + 2);
        let v = Infinity;
        for (let b = j0; b <= j1; b++) for (let a = i0; a <= i1; a++) if (ant[b * na + a] < v) v = ant[b * na + a];
        d[j * m + i] = v;
      }
    }
    out.push({ data: d, width: m, height: m });
    if (m === 1) break;
    ant = d;
    na = m;
  }
  return out;
}

/** Pirâmide de mínimos e máximos das alturas em blocos de 16 amostras (128 m) e seus agrupamentos 2 x 2. */
export function piramideAlturas(T) {
  const n = T.n;
  const b = (n - 1) / GRADE_NO;
  const niveis = [];
  let lado = b;
  let min = new Float32Array(b * b);
  let max = new Float32Array(b * b);
  for (let bj = 0; bj < b; bj++) {
    for (let bi = 0; bi < b; bi++) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let j = bj * GRADE_NO; j <= (bj + 1) * GRADE_NO; j++) {
        for (let i = bi * GRADE_NO; i <= (bi + 1) * GRADE_NO; i++) {
          const v = T.altura[j * n + i];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      }
      min[bj * b + bi] = lo;
      max[bj * b + bi] = hi;
    }
  }
  niveis.push({ lado, min, max });
  while (lado > 1) {
    const l2 = lado >> 1;
    const mi = new Float32Array(l2 * l2);
    const ma = new Float32Array(l2 * l2);
    for (let j = 0; j < l2; j++) {
      for (let i = 0; i < l2; i++) {
        const ks = [2 * j * lado + 2 * i, 2 * j * lado + 2 * i + 1, (2 * j + 1) * lado + 2 * i, (2 * j + 1) * lado + 2 * i + 1];
        mi[j * l2 + i] = Math.min(...ks.map((k) => min[k]));
        ma[j * l2 + i] = Math.max(...ks.map((k) => max[k]));
      }
    }
    lado = l2;
    min = mi;
    max = ma;
    niveis.push({ lado, min, max });
  }
  // borda do mapa (para os nós de fora)
  let bMin = Infinity;
  let bMax = -Infinity;
  for (let k = 0; k < n; k++) {
    for (const v of [T.altura[k], T.altura[(n - 1) * n + k], T.altura[k * n], T.altura[k * n + n - 1]]) {
      if (v < bMin) bMin = v;
      if (v > bMax) bMax = v;
    }
  }
  return { niveis, bloco: T.passo * GRADE_NO, ox: T.origem[0], oz: T.origem[1], lado: T.passo * (n - 1), bMin, bMax };
}

/** Mínimo e máximo das alturas num retângulo do mundo (conservador), com a moldura de fora se ligada. */
export function limitesAltura(P, x0, z0, x1, z1, fora = true) {
  let lo = Infinity;
  let hi = -Infinity;
  const ix0 = Math.max(x0, P.ox);
  const iz0 = Math.max(z0, P.oz);
  const ix1 = Math.min(x1, P.ox + P.lado);
  const iz1 = Math.min(z1, P.oz + P.lado);
  if (ix1 > ix0 && iz1 > iz0) {
    const base = P.niveis[0].lado;
    const bi0 = Math.max(0, Math.floor((ix0 - P.ox) / P.bloco));
    const bj0 = Math.max(0, Math.floor((iz0 - P.oz) / P.bloco));
    const bi1 = Math.min(base, Math.ceil((ix1 - P.ox) / P.bloco));
    const bj1 = Math.min(base, Math.ceil((iz1 - P.oz) / P.bloco));
    let l = 0;
    while (l < P.niveis.length - 1 && Math.max(bi1 - bi0, bj1 - bj0) >> l > 4) l++;
    const N = P.niveis[l];
    for (let j = bj0 >> l; j < Math.min(N.lado, (bj1 + (1 << l) - 1) >> l); j++) {
      for (let i = bi0 >> l; i < Math.min(N.lado, (bi1 + (1 << l) - 1) >> l); i++) {
        const k = j * N.lado + i;
        if (N.min[k] < lo) lo = N.min[k];
        if (N.max[k] > hi) hi = N.max[k];
      }
    }
  }
  const temFora = x0 < P.ox || z0 < P.oz || x1 > P.ox + P.lado || z1 > P.oz + P.lado;
  if (temFora) {
    if (fora) {
      lo = Math.min(lo, P.bMin - FORA.mar);
      hi = Math.max(hi, P.bMax + FORA.serra);
    } else if (!(ix1 > ix0 && iz1 > iz0)) return null;
  }
  return [lo, hi];
}

/**
 * Escolha dos nós do CDLOD (Strugar): um nó entra inteiro no nível dele se nenhum filho está no alcance do nível de
 * baixo; o filho fora do alcance vira um pedaço do tamanho do filho marcado com o nível do filho (o "morph" dele fica
 * inteiro, então ele desenha na resolução do pai). Nós só de mar fundo saem (a água opaca cobre).
 * @param {{ cam: {x,y,z}, visivel?: (caixa) => boolean, faixas: number[], P: object, fora?: boolean,
 *           copa?: number, fundo?: number, saida?: Float32Array }} op  saida: onde escrever (o quadro reusa a do atributo)
 * @returns {Float32Array} 4 por nó: x0, z0, lado, nível (e .n com o número de nós)
 */
export function selecionarNos({ cam, visivel = () => true, faixas, P, fora = true, copa = COPA_MAX, fundo = -2.5, max = MAX_NOS, saida = null }) {
  const out = saida && saida.length >= max * 4 ? saida : new Float32Array(max * 4);
  let n = 0;
  const caixa = { x0: 0, z0: 0, x1: 0, z1: 0, y0: 0, y1: 0 };
  const limites = (x0, z0, s) => {
    const l = limitesAltura(P, x0, z0, x0 + s, z0 + s, fora);
    if (!l) return null;
    caixa.x0 = x0;
    caixa.z0 = z0;
    caixa.x1 = x0 + s;
    caixa.z1 = z0 + s;
    caixa.y0 = l[0];
    caixa.y1 = l[1] + copa;
    return caixa;
  };
  const dist2 = (c) => {
    const dx = Math.max(c.x0 - cam.x, 0, cam.x - c.x1);
    const dy = Math.max(c.y0 - cam.y, 0, cam.y - c.y1);
    const dz = Math.max(c.z0 - cam.z, 0, cam.z - c.z1);
    return dx * dx + dy * dy + dz * dz;
  };
  const por = (x0, z0, s, nivel) => {
    if (n >= max) return;
    out[4 * n] = x0;
    out[4 * n + 1] = z0;
    out[4 * n + 2] = s;
    out[4 * n + 3] = nivel;
    n++;
  };
  const sel = (x0, z0, s, nivel) => {
    const c = limites(x0, z0, s);
    if (!c) return true; // fora do mapa sem moldura: nada a desenhar
    if (dist2(c) > faixas[nivel] * faixas[nivel]) return false;
    if (c.y1 - copa < fundo) return true;
    if (!visivel(c)) return true;
    if (nivel === 0) {
      por(x0, z0, s, 0);
      return true;
    }
    if (dist2(c) > faixas[nivel - 1] * faixas[nivel - 1]) {
      por(x0, z0, s, nivel);
      return true;
    }
    const m = s / 2;
    for (const [a, b] of [[0, 0], [m, 0], [0, m], [m, m]]) {
      if (!sel(x0 + a, z0 + b, m, nivel - 1)) {
        const cf = limites(x0 + a, z0 + b, m);
        if (cf && cf.y1 - copa >= fundo && visivel(cf)) por(x0 + a, z0 + b, m, nivel - 1);
      }
    }
    return true;
  };
  sel(RAIZ_CDLOD.x, RAIZ_CDLOD.z, RAIZ_CDLOD.lado, NIVEIS_CDLOD - 1);
  const r = out.subarray(0, 4 * n);
  r.n = n;
  return r;
}

// uso do solo ------------------------------------------------------------------------------------

function carimbar(buf, lado, t, ox, oz, x0, z0, x1, z1, cobre, canais) {
  const i0 = Math.max(0, Math.floor((x0 - ox) / t));
  const j0 = Math.max(0, Math.floor((z0 - oz) / t));
  const i1 = Math.min(lado - 1, Math.floor((x1 - ox) / t));
  const j1 = Math.min(lado - 1, Math.floor((z1 - oz) / t));
  for (let j = j0; j <= j1; j++) {
    const cz = oz + (j + 0.5) * t;
    for (let i = i0; i <= i1; i++) {
      const c = cobre(ox + (i + 0.5) * t, cz);
      if (c <= 0) continue;
      const k = 4 * (j * lado + i);
      for (let q = 0; q < 4; q++) {
        const v = Math.round(c * canais[q] * 255);
        if (v > buf[k + q]) buf[k + q] = v;
      }
    }
  }
}

const cobertura = (d, t) => Math.min(1, Math.max(0, 0.5 - d / t));

/** Canais de um lote (piso, terra, gramado) pela família da zona, o tipo e o estado do prédio. */
function canaisDoLote(P, i) {
  const f = P.flags[i];
  const s = (P.semente[i] >>> 4) % 100 / 100;
  if (f & PREDIO.OBRA) return [0, 0.35, 0.8, 0];
  if (f & PREDIO.ABANDONADO) return [0, 0.5, 0.45, 0.2];
  if (P.tipo[i] !== TIPO_PREDIO.ZONA) return [0, 0.65, 0.05, 0.4];
  const fam = ZONAS[ZONAS_ORDEM[P.zona[i]]]?.familia;
  // o quintal brasileiro é quase todo cimentado; o gramado é pouco (e o jardim do prédio alto, um canteiro)
  if (fam === 'res') return P.nivel[i] >= 3 ? [0, 0.72, 0.04, 0.26 + 0.14 * s] : [0, 0.5 + 0.2 * s, 0.12, 0.26];
  if (fam === 'com') return [0, 0.85, 0, 0.12 + 0.1 * s];
  if (fam === 'ind') return [0, 0.62, 0.3 + 0.2 * s, 0.05];
  return [0, 0.8, 0, 0.2];
}

/**
 * Canais de uma célula de zona: vazia é terreno baldio (terra batida e capim ralo, mais terra perto da rua), ocupada é
 * quintal (cimentado e um pouco de terra). O lote do prédio vem por cima.
 */
function canaisDaCelula(C, c) {
  const frente = C.linha ? Math.max(0, 1 - C.linha[c] / 5) : 0.5;
  if (C.estado[c] === CELULA.OCUPADA) return [0, 0.36 + 0.12 * frente, 0.16, 0.1];
  return [0, 0.03, 0.12 + 0.1 * frente, 0.1];
}

/** Caixa de uma célula de zona (com a folga do giro), ou null. out evita alocar (o laço do uso do solo reusa um). */
export function caixaCelula(C, c, out = [0, 0, 0, 0]) {
  if (!C.viva[c] || !C.zona[c] || C.estado[c] === CELULA.INVALIDA) return null;
  const r = CELULA_M * 0.75 + 2;
  out[0] = C.x[c] - r;
  out[1] = C.z[c] - r;
  out[2] = C.x[c] + r;
  out[3] = C.z[c] + r;
  return out;
}

/** Largura da calçada de cada lado de uma via (m), pelo perfil de data/vias.js. */
function calcadaDe(tipo) {
  const p = tipo?.perfil;
  if (!p?.length) return 0;
  return p[0].parte === 'calcada' ? p[0].largura : 0;
}

function bezierPonto(p, o, t, out) {
  const u = 1 - t;
  const b0 = u * u * u;
  const b1 = 3 * u * u * t;
  const b2 = 3 * u * t * t;
  const b3 = t * t * t;
  out[0] = b0 * p[o] + b1 * p[o + 2] + b2 * p[o + 4] + b3 * p[o + 6];
  out[1] = b0 * p[o + 1] + b1 * p[o + 3] + b2 * p[o + 5] + b3 * p[o + 7];
}

/** Caixa (x0, z0, x1, z1) de uma aresta com a meia largura, ou null. */
export function caixaAresta(A, e, out = [0, 0, 0, 0]) {
  if (!A.viva[e]) return null;
  const tipo = VIAS[VIAS_ORDEM[A.tipo[e]]] ?? VIAS.rua;
  const m = tipo.largura / 2 + 4;
  const p = A.p;
  const o = 8 * e;
  out[0] = Math.min(p[o], p[o + 2], p[o + 4], p[o + 6]) - m;
  out[1] = Math.min(p[o + 1], p[o + 3], p[o + 5], p[o + 7]) - m;
  out[2] = Math.max(p[o], p[o + 2], p[o + 4], p[o + 6]) + m;
  out[3] = Math.max(p[o + 1], p[o + 3], p[o + 5], p[o + 7]) + m;
  return out;
}

/** Caixa de um prédio (planta girada), ou null. */
export function caixaPredio(P, i, out = [0, 0, 0, 0]) {
  if (!P.viva[i]) return null;
  const r = Math.hypot(P.w[i], P.d[i]) / 2 + 4;
  out[0] = P.x[i] - r;
  out[1] = P.z[i] - r;
  out[2] = P.x[i] + r;
  out[3] = P.z[i] + r;
  return out;
}

const cruza = (a, b) => a && b && a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

/**
 * Uso do solo (RGBA8 lado x lado sobre o mapa): R via (asfalto e calçada escura), G piso (lotes e calçadas), B terra
 * batida (ruas de terra, obra), A gramado dos lotes. Refaz o retângulo ret = [x0, z0, x1, z1] em metros, ou uma lista
 * deles, numa passada só pelas tabelas (tudo sem ret). Devolve os texels refeitos, [i0, j0, i1, j1] (uma lista se ret
 * era uma lista).
 */
export function rasterizarUso(esp, buf, lado, mapa, ret = null) {
  const t = mapa.lado / lado;
  const ox = mapa.ox;
  const oz = mapa.oz;
  const lista = ret == null ? [[ox, oz, ox + mapa.lado, oz + mapa.lado]] : Array.isArray(ret[0]) ? ret : [ret];
  // limpa todos os retângulos antes de carimbar (um item que cruza dois é carimbado nos dois)
  const texels = [];
  const recortes = [];
  const tudo = [Infinity, Infinity, -Infinity, -Infinity];
  for (const r of lista) {
    const i0 = Math.max(0, Math.floor((r[0] - ox) / t));
    const j0 = Math.max(0, Math.floor((r[1] - oz) / t));
    const i1 = Math.min(lado - 1, Math.ceil((r[2] - ox) / t));
    const j1 = Math.min(lado - 1, Math.ceil((r[3] - oz) / t));
    texels.push([i0, j0, i1, j1]);
    if (i1 < i0 || j1 < j0) continue;
    for (let j = j0; j <= j1; j++) buf.fill(0, 4 * (j * lado + i0), 4 * (j * lado + i1 + 1));
    const rc = [ox + i0 * t, oz + j0 * t, ox + (i1 + 1) * t, oz + (j1 + 1) * t];
    recortes.push(rc);
    tudo[0] = Math.min(tudo[0], rc[0]);
    tudo[1] = Math.min(tudo[1], rc[1]);
    tudo[2] = Math.max(tudo[2], rc[2]);
    tudo[3] = Math.max(tudo[3], rc[3]);
  }
  const lim = (b, rc) => [Math.max(b[0], rc[0]), Math.max(b[1], rc[1]), Math.min(b[2], rc[2]), Math.min(b[3], rc[3])];
  const cx = [0, 0, 0, 0]; // caixa de trabalho (sem alocar por item: a cidade tem centenas de milhares de células)
  // células de zona, lotes e vias (max por canal)
  const C = esp.celulas;
  if (C && recortes.length) {
    const m = CELULA_M / 2;
    for (let c = 0; c < C.n; c++) {
      if (!cruza(caixaCelula(C, c, cx), tudo)) continue;
      const cs = Math.cos(C.ang[c]);
      const sn = Math.sin(C.ang[c]);
      const x = C.x[c];
      const z = C.z[c];
      const cobre = (px, pz) => {
        const dx = px - x;
        const dz = pz - z;
        return cobertura(Math.max(Math.abs(dx * cs - dz * sn), Math.abs(dx * sn + dz * cs)) - m, t);
      };
      const canais = canaisDaCelula(C, c);
      for (const rc of recortes) {
        if (!cruza(cx, rc)) continue;
        const b = lim(cx, rc);
        carimbar(buf, lado, t, ox, oz, b[0], b[1], b[2], b[3], cobre, canais);
      }
    }
  }
  const P = esp.predios;
  if (P && recortes.length) {
    for (let i = 0; i < P.n; i++) {
      if (!cruza(caixaPredio(P, i, cx), tudo)) continue;
      const cs = Math.cos(P.rot[i]);
      const sn = Math.sin(P.rot[i]);
      const hw = P.w[i] / 2;
      const hd = P.d[i] / 2;
      const x = P.x[i];
      const z = P.z[i];
      const cobre = (px, pz) => {
        const dx = px - x;
        const dz = pz - z;
        const lx = dx * cs - dz * sn;
        const lz = dx * sn + dz * cs;
        return cobertura(Math.max(Math.abs(lx) - hw, Math.abs(lz) - hd), t);
      };
      const canais = canaisDoLote(P, i);
      for (const rc of recortes) {
        if (!cruza(cx, rc)) continue;
        const b = lim(cx, rc);
        carimbar(buf, lado, t, ox, oz, b[0], b[1], b[2], b[3], cobre, canais);
      }
    }
  }
  const A = esp.vias?.arestas;
  if (A && recortes.length) {
    const a = [0, 0];
    const b = [0, 0];
    for (let e = 0; e < A.n; e++) {
      if (!cruza(caixaAresta(A, e, cx), tudo)) continue;
      const tipo = VIAS[VIAS_ORDEM[A.tipo[e]]] ?? VIAS.rua;
      const meia = tipo.largura / 2;
      const calc = calcadaDe(tipo);
      const terra = tipo === VIAS.terra;
      const pista = meia - calc;
      const o = 8 * e;
      const passos = Math.max(2, Math.ceil((A.comp?.[e] || 60) / 6));
      for (const rc of recortes) {
        if (!cruza(cx, rc)) continue;
        bezierPonto(A.p, o, 0, a);
        for (let s = 1; s <= passos; s++) {
          bezierPonto(A.p, o, s / passos, b);
          const ax = a[0];
          const az = a[1];
          const vx = b[0] - ax;
          const vz = b[1] - az;
          const l2 = vx * vx + vz * vz || 1;
          const dSeg = (px, pz) => {
            const u = Math.min(1, Math.max(0, ((px - ax) * vx + (pz - az) * vz) / l2));
            return Math.hypot(px - ax - vx * u, pz - az - vz * u);
          };
          const bb = lim([Math.min(ax, b[0]) - meia - t, Math.min(az, b[1]) - meia - t, Math.max(ax, b[0]) + meia + t, Math.max(az, b[1]) + meia + t], rc);
          if (bb[2] >= bb[0] && bb[3] >= bb[1]) {
            if (terra) carimbar(buf, lado, t, ox, oz, bb[0], bb[1], bb[2], bb[3], (px, pz) => cobertura(dSeg(px, pz) - meia, t), [0, 0, 1, 0]);
            else {
              if (calc > 0) carimbar(buf, lado, t, ox, oz, bb[0], bb[1], bb[2], bb[3], (px, pz) => cobertura(dSeg(px, pz) - meia, t), [0, 1, 0, 0]);
              carimbar(buf, lado, t, ox, oz, bb[0], bb[1], bb[2], bb[3], (px, pz) => cobertura(dSeg(px, pz) - pista, t), [1, 0, 0, 0]);
            }
          }
          a[0] = b[0];
          a[1] = b[1];
        }
      }
    }
  }
  return ret != null && Array.isArray(ret[0]) ? texels : texels[0];
}

/**
 * Caixas guardadas por índice (x0, z0, x1, z1; NaN sem caixa) numa Float32Array que cresce: a caixa velha de um item
 * que mudou (o uso do solo refaz onde ele estava e onde está), sem um array por célula.
 */
export class CaixasGuardadas {
  constructor() {
    this.d = new Float32Array(0);
  }

  garantir(n) {
    if (this.d.length >= 4 * n) return;
    const d = new Float32Array(Math.max(4 * n, 2 * this.d.length, 256)).fill(NaN);
    d.set(this.d);
    this.d = d;
  }

  /** A caixa guardada do item k (um array novo) ou null. */
  ler(k) {
    const o = 4 * k;
    if (o >= this.d.length || Number.isNaN(this.d[o])) return null;
    return [this.d[o], this.d[o + 1], this.d[o + 2], this.d[o + 3]];
  }

  gravar(k, caixa) {
    this.garantir(k + 1);
    const o = 4 * k;
    if (caixa) this.d.set(caixa, o);
    else this.d.fill(NaN, o, o + 4);
  }

  /** Refaz todas pelas tabelas (n itens, caixa(k, out) de caixaCelula, caixaPredio ou caixaAresta). */
  refazer(n, caixa) {
    this.d = new Float32Array(0);
    this.garantir(n);
    const out = [0, 0, 0, 0];
    for (let k = 0; k < n; k++) this.gravar(k, caixa(k, out));
  }
}

/**
 * Junta os retângulos que se tocam (até não sobrar par que se cruze) e, se ainda sobrarem mais que max, devolve a
 * união de todos. Evita refazer a mesma área várias vezes e, no mapa de cor, assar o mapa inteiro por causa de duas
 * mudanças longe uma da outra.
 */
export function juntarRetangulos(rets, max = Infinity) {
  let lista = rets.map((r) => r.slice(0, 4));
  // passadas até nenhum par se cruzar (cada passada junta cada um no primeiro que ele cruza)
  for (let mudou = true; mudou; ) {
    mudou = false;
    const saida = [];
    for (const r of lista) {
      const q = saida.find((o) => cruza(o, r));
      if (!q) {
        saida.push(r);
        continue;
      }
      q[0] = Math.min(q[0], r[0]);
      q[1] = Math.min(q[1], r[1]);
      q[2] = Math.max(q[2], r[2]);
      q[3] = Math.max(q[3], r[3]);
      mudou = true;
    }
    lista = saida;
  }
  if (lista.length <= max) return lista;
  const u = lista.reduce((q, r) => [Math.min(q[0], r[0]), Math.min(q[1], r[1]), Math.max(q[2], r[2]), Math.max(q[3], r[3])]);
  return [u];
}

/**
 * Células de zona (R8 lado x lado): zona (1 a 7) mais 8 se a célula está ocupada; 0 sem zona. Com valores (camada de
 * fonte 'celulas'), grava o valor por célula em vez da zona.
 */
export function rasterizarCelulas(esp, buf, lado, mapa, valor = null) {
  buf.fill(0);
  const C = esp.celulas;
  if (!C) return buf;
  const t = mapa.lado / lado;
  for (let c = 0; c < C.n; c++) {
    if (!C.viva[c] || C.estado[c] === CELULA.INVALIDA) continue;
    const v = valor ? valor(c) : C.zona[c] ? C.zona[c] + (C.estado[c] === CELULA.OCUPADA ? 8 : 0) : 0;
    if (!v) continue;
    const cs = Math.cos(C.ang[c]);
    const sn = Math.sin(C.ang[c]);
    const x = C.x[c];
    const z = C.z[c];
    const i0 = Math.max(0, Math.floor((x - 6 - mapa.ox) / t));
    const i1 = Math.min(lado - 1, Math.floor((x + 6 - mapa.ox) / t));
    const j0 = Math.max(0, Math.floor((z - 6 - mapa.oz) / t));
    const j1 = Math.min(lado - 1, Math.floor((z + 6 - mapa.oz) / t));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = mapa.ox + (i + 0.5) * t - x;
        const dz = mapa.oz + (j + 0.5) * t - z;
        if (Math.abs(dx * cs - dz * sn) <= 4 && Math.abs(dx * sn + dz * cs) <= 4) buf[j * lado + i] = v;
      }
    }
  }
  return buf;
}

// ------------------------------------------------------------------------------------------------ material

/** Uniformes do chão (um objeto só: o terreno, o assado e a água usam os mesmos). */
export function criarUniformes() {
  const v = (value) => ({ value });
  return {
    uTerAltura: v(null),
    uTerDados: v(null),
    uTerRuido: v(null),
    uTerCor: v(null),
    uTerUso: v(null),
    uTerSobre: v(null),
    uTerCamadas: v(null),
    uTerCamadasB: v(null),
    uTerGrade: v(new THREE.Vector4(-4096, -4096, 8, 1025)),
    uTerMapa: v(new THREE.Vector4(-4096, -4096, 8192, 1 / 8192)),
    uTerFora: v(new THREE.Vector4(1, FORA.faixa, FORA.serra, FORA.mar)),
    uTerEstacao: v(0),
    uTerMorph: v(Array.from({ length: NIVEIS_CDLOD }, () => new THREE.Vector2())),
    uTerCopaV: v(new THREE.Vector4(COPA_ALTURA, 0, 150, 0)),
    uTerDetalhe: v(new THREE.Vector4(180, 60, 1, 2000)),
    uTerGanho: v(Array.from({ length: N_CAMADAS }, () => new THREE.Vector3(1, 1, 1))),
    uTerGanhoB: v(Array.from({ length: N_CAMADAS }, () => new THREE.Vector3(1, 1, 1))),
    uTerAB: v(new THREE.Vector4(0, 0, 0, 0)),
    uTerSobreModo: v(new THREE.Vector4(0, 0, 0, 0)),
    uTerSobreRet: v(new THREE.Vector4(0, 0, 1, 1)),
    uTerSobreRampa: v(Array.from({ length: 8 }, () => new THREE.Color())),
    uTerPincel: v(new THREE.Vector4(0, 0, 0, 0)),
    uTerLadrilho: v(new THREE.Vector4(0, -4096, -4096, 512)),
    uTerMascara: v(0),
  };
}

function trocar(src, alvo, novo) {
  if (!src.includes(alvo)) throw new Error(`terreno: shader do three sem '${alvo}'`);
  return src.replace(alvo, novo);
}

/** Material do terreno: MeshStandardMaterial com os trechos do CDLOD e das camadas; os ganchos entram por cima. */
export function criarMaterialTerreno(ganchos, U, { detalhe = true, ab = false } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  mat.name = 'terreno';
  mat.defines = { ...mat.defines }; // mantém o STANDARD do three (IBL difusa e oclusão especular)
  if (detalhe) mat.defines.TER_DETALHE = '';
  if (ab) mat.defines.TER_AB = '';
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    let vs = shader.vertexShader;
    vs = trocar(vs, '#include <common>', `#include <common>\n${GLSL_TER_VERTICE.pars}`);
    vs = trocar(vs, '#include <beginnormal_vertex>', GLSL_TER_VERTICE.normal);
    vs = trocar(vs, '#include <begin_vertex>', GLSL_TER_VERTICE.posicao);
    let fs = shader.fragmentShader;
    fs = trocar(fs, '#include <common>', `#include <common>\n${GLSL_TER_FRAGMENTO.pars}`);
    fs = trocar(fs, '#include <map_fragment>', GLSL_TER_FRAGMENTO.cor);
    fs = trocar(fs, '#include <roughnessmap_fragment>', GLSL_TER_FRAGMENTO.rugosidade);
    fs = trocar(fs, '#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${GLSL_TER_FRAGMENTO.normal}`);
    fs = trocar(fs, '#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${GLSL_TER_FRAGMENTO.emissivo}`);
    fs = trocar(fs, '#include <dithering_fragment>', `#include <dithering_fragment>\n${GLSL_TER_FRAGMENTO.mascara}`);
    shader.vertexShader = vs;
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => `terreno|${Object.keys(mat.defines).sort().join(',')}`;
  // a sombra, a neblina e o resto dos ganchos comuns por cima (o 'camada' não: o chão pinta a camada ele mesmo)
  return ganchos.aplicar(mat, ['sombra', 'sombraLonge', 'hao', 'noite', 'neblina']);
}

/** A grade de 16 x 16 quadrados (17 x 17 vértices em coordenadas de grade 0 a 16), instanciada por nó. */
export function geometriaNo() {
  const g = new THREE.InstancedBufferGeometry();
  const m = GRADE_NO + 1;
  const pos = new Float32Array(m * m * 3);
  const nor = new Float32Array(m * m * 3);
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < m; i++) {
      const k = 3 * (j * m + i);
      pos[k] = i;
      pos[k + 2] = j;
      nor[k + 1] = 1;
    }
  }
  const idx = new Uint16Array(GRADE_NO * GRADE_NO * 6);
  let q = 0;
  for (let j = 0; j < GRADE_NO; j++) {
    for (let i = 0; i < GRADE_NO; i++) {
      const a = j * m + i;
      // diagonal alternada: o morph fecha os triângulos sem rachar
      if ((i + j) % 2 === 0) idx.set([a, a + m, a + 1, a + 1, a + m, a + m + 1], q);
      else idx.set([a, a + m, a + m + 1, a, a + m + 1, a + 1], q);
      q += 6;
    }
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  const inst = new THREE.InstancedBufferAttribute(new Float32Array(MAX_NOS * 4), 4);
  inst.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aNo', inst);
  g.instanceCount = 0;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
  return g;
}

// ------------------------------------------------------------------------------------------------ assado

/** Mapa de cor assado na GPU (RGBA8, sqrt do albedo e a rugosidade), com mipmaps; refaz por retângulo. */
class Assador {
  constructor(renderer, U, lado, aniso) {
    this.renderer = renderer;
    this.lado = lado;
    this.alvo = new THREE.WebGLRenderTarget(lado, lado, {
      depthBuffer: false,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      anisotropy: aniso,
    });
    this.alvo.texture.colorSpace = THREE.NoColorSpace;
    this.mat = new THREE.ShaderMaterial({
      uniforms: U,
      vertexShader: GLSL_ASSAR.vertice,
      fragmentShader: GLSL_ASSAR.fragmento,
      depthTest: false,
      depthWrite: false,
    });
    this.cena = new THREE.Scene();
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    q.frustumCulled = false;
    this.cena.add(q);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.vezes = 0;
  }

  /** Assa o retângulo [x0, z0, x1, z1] do mundo (ou tudo). */
  assar(mapa, ret = null) {
    const r = this.renderer;
    const a = this.alvo;
    if (ret) {
      const k = this.lado / mapa.lado;
      const x0 = Math.max(0, Math.floor((ret[0] - mapa.ox) * k) - 2);
      const y0 = Math.max(0, Math.floor((ret[1] - mapa.oz) * k) - 2);
      const x1 = Math.min(this.lado, Math.ceil((ret[2] - mapa.ox) * k) + 2);
      const y1 = Math.min(this.lado, Math.ceil((ret[3] - mapa.oz) * k) + 2);
      if (x1 <= x0 || y1 <= y0) return;
      a.scissor.set(x0, y0, x1 - x0, y1 - y0);
      a.scissorTest = true;
    } else a.scissorTest = false;
    const antes = r.getRenderTarget();
    r.setRenderTarget(a);
    r.render(this.cena, this.cam);
    r.setRenderTarget(antes);
    a.scissorTest = false;
    this.vezes++;
  }

  /** Assa vários retângulos; os mipmaps saem uma vez só, no último (o three os refaz a cada render no alvo). */
  assarVarios(mapa, rets) {
    const tex = this.alvo.texture;
    rets.forEach((r, k) => {
      tex.generateMipmaps = k === rets.length - 1;
      this.assar(mapa, r);
    });
    tex.generateMipmaps = true;
  }

  descartar() {
    this.alvo.dispose();
    this.mat.dispose();
    for (const m of this.cena.children) m.geometry.dispose();
  }
}

// ------------------------------------------------------------------------------------------------ domínio

const unir = (a, b) => (a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : b.slice());

function lerPasse() {
  try {
    return new URLSearchParams(globalThis.location?.search ?? '').get('passe');
  } catch (e) {
    return null;
  }
}

/** Estação seca (0 a 1) pelo dia do ano: o capim amarela de maio a setembro, com o pico no fim de julho. */
export const estacaoSeca = (diaDoAno) => 0.5 + 0.5 * Math.cos((2 * Math.PI * ((diaDoAno ?? 0) - 212)) / 365);

function criarTerreno(ctx) {
  const U = criarUniformes();
  let pt = PERFIL_TERRENO[ctx.perfil.id] ?? PERFIL_TERRENO.media;
  const modo = modoMateriais();
  const estado = {
    T: null, F: null, dist: null, dados: null, P: null, uso: null, mapa: null, texAlt: null, texDados: null, texUso: null,
    assador: null, sujoCor: [], ultimoAssado: -1e9, camadasCC0: null, faixas: null,
    caixasA: new CaixasGuardadas(), caixasP: new CaixasGuardadas(), caixasC: new CaixasGuardadas(),
    sobre: { camada: null, zona: false, ladrilhos: false, texZona: null, texCamada: null, texLad: null, zonaSuja: true },
    ab: false, instAssinatura: '',
  };

  U.uTerRuido.value = ctx.textura('chao.ruido');
  U.uTerCamadasB.value = ctx.textura('chao.cc0');
  U.uTerMascara.value = lerPasse() === 'mascara' ? 1 : 0;

  function ligarDetalhe() {
    pt = PERFIL_TERRENO[ctx.perfil.id] ?? PERFIL_TERRENO.media;
    U.uTerDetalhe.value.set(pt.detalhe, pt.faixa, 1, pt.copaRelevo);
    estado.faixas = faixasCDLOD(pt.r0);
    estado.faixas.forEach((r, l) => U.uTerMorph.value[l].set(MORPH.inicio * r, 1 / ((MORPH.fim - MORPH.inicio) * r)));
    if (pt.detalhe > 0) {
      const t = ctx.textura('chao.camadas');
      U.uTerCamadas.value = t;
      const g = t?.userData?.ganhos;
      if (g) U.uTerGanho.value.forEach((v, i) => v.set(g[3 * i], g[3 * i + 1], g[3 * i + 2]));
    }
    if (modo === 'cc0' && estado.camadasCC0) usarCC0(estado.camadasCC0, false);
  }
  /** Sem CC0, o lado B mostra o mesmo procedural (o A/B fica honesto: os dois lados iguais). */
  function espelharB() {
    if (estado.camadasCC0 || !U.uTerCamadas.value) return;
    U.uTerCamadasB.value = U.uTerCamadas.value;
    U.uTerGanhoB.value.forEach((v, i) => v.copy(U.uTerGanho.value[i]));
  }
  function usarCC0(tex, ladoB) {
    const g = tex.userData.ganhos;
    if (ladoB) {
      U.uTerCamadasB.value = tex;
      U.uTerGanhoB.value.forEach((v, i) => v.set(g[3 * i], g[3 * i + 1], g[3 * i + 2]));
    } else if (pt.detalhe > 0) {
      U.uTerCamadas.value = tex;
      U.uTerGanho.value.forEach((v, i) => v.set(g[3 * i], g[3 * i + 1], g[3 * i + 2]));
    }
  }
  ligarDetalhe();
  espelharB();

  let mat = criarMaterialTerreno(ctx.ganchos, U, { detalhe: pt.detalhe > 0, ab: modo === 'ab' });
  const geo = geometriaNo();
  const malha = ctx.medidas.familia(new THREE.Mesh(geo, mat), 'terreno');
  malha.name = 'terreno';
  malha.frustumCulled = false;
  ctx.cena.add(malha);

  const promessaCC0 = modo === 'proc' ? Promise.resolve(null) : carregarCC0({ renderer: ctx.renderer, THREE, montagem: ctx.montagem });
  promessaCC0.then((tex) => {
    if (!tex) return;
    estado.camadasCC0 = tex;
    usarCC0(tex, modo === 'ab' || estado.ab);
  });

  // ---------------------------------------------------------------- dados do espelho

  function montarTudo(esp) {
    const T = esp.terreno;
    const n = T.n;
    estado.T = T;
    estado.F = esp.floresta ?? null;
    estado.mapa = { ox: T.origem[0], oz: T.origem[1], lado: T.passo * (n - 1) };
    U.uTerGrade.value.set(T.origem[0], T.origem[1], T.passo, n);
    U.uTerMapa.value.set(T.origem[0], T.origem[1], estado.mapa.lado, 1 / estado.mapa.lado);
    U.uTerLadrilho.value.set(U.uTerLadrilho.value.x, T.origem[0], T.origem[1], estado.mapa.lado / 16);
    // alturas: o nível 0 aponta para o array do espelho (sem cópia); as mips são os mínimos (mipsDeMinimos)
    estado.texAlt?.dispose();
    const ta = new THREE.DataTexture(T.altura, n, n, THREE.RedFormat, THREE.FloatType);
    ta.mipmaps = [{ data: T.altura, width: n, height: n }, ...mipsDeMinimos(T)];
    ta.minFilter = THREE.NearestMipmapNearestFilter;
    ta.magFilter = THREE.NearestFilter;
    ta.generateMipmaps = false;
    ta.needsUpdate = true;
    estado.texAlt = ta;
    U.uTerAltura.value = ta;
    // distância à água e dados
    estado.dist = T.agua ? distanciaAgua(T.agua, n) : { dist: new Float32Array(n * n).fill(1e4), mar: new Uint8Array(n * n) };
    estado.dados = prepararDados(T, estado.F, estado.dist);
    estado.texDados?.dispose();
    const td = new THREE.DataTexture(estado.dados, n, n, THREE.RGBAFormat, THREE.UnsignedByteType);
    td.minFilter = THREE.LinearMipmapLinearFilter;
    td.magFilter = THREE.LinearFilter;
    td.generateMipmaps = true;
    td.colorSpace = THREE.NoColorSpace;
    td.needsUpdate = true;
    estado.texDados = td;
    U.uTerDados.value = td;
    estado.P = piramideAlturas(T);
    // uso do solo
    if (!estado.uso) {
      estado.uso = new Uint8Array(LADO_USO * LADO_USO * 4);
      const tu = new THREE.DataTexture(estado.uso, LADO_USO, LADO_USO, THREE.RGBAFormat, THREE.UnsignedByteType);
      tu.minFilter = tu.magFilter = THREE.LinearFilter;
      tu.generateMipmaps = false;
      tu.colorSpace = THREE.NoColorSpace;
      estado.texUso = tu;
      U.uTerUso.value = tu;
    }
    guardarCaixas(esp);
    rasterizarUso(esp, estado.uso, LADO_USO, estado.mapa);
    estado.texUso.needsUpdate = true;
    // mapa de cor
    const ladoCor = pt.cor;
    if (!estado.assador || estado.assador.lado !== ladoCor) {
      estado.assador?.descartar();
      estado.assador = new Assador(ctx.renderer, U, ladoCor, pt.aniso);
      U.uTerCor.value = estado.assador.alvo.texture;
    }
    estado.sujoCor = [];
    estado.assador.assar(estado.mapa);
    estado.sobre.zonaSuja = true;
    atualizarSobre(esp);
  }

  function guardarCaixas(esp) {
    const A = esp.vias?.arestas;
    const P = esp.predios;
    const C = esp.celulas;
    estado.caixasA.refazer(A?.n ?? 0, (e, out) => caixaAresta(A, e, out));
    estado.caixasP.refazer(P?.n ?? 0, (i, out) => caixaPredio(P, i, out));
    estado.caixasC.refazer(C?.n ?? 0, (c, out) => caixaCelula(C, c, out));
  }

  /** Marca um retângulo do mapa de cor para assar de novo (juntos os que se tocam; até 16 separados, senão a união). */
  function sujarCor(r) {
    estado.sujoCor = juntarRetangulos([...estado.sujoCor, r], 16);
  }

  /** Retângulos sujos do terreno (aplainar) e da floresta: refaz dados, alturas e a pirâmide no pedaço. */
  function refazerTerreno(esp, rets, alturaMudou) {
    const T = estado.T;
    const n = T.n;
    let tudo = null;
    for (const r of rets) {
      const i0 = Math.max(0, Math.floor((r[0] - T.origem[0]) / T.passo) - 1);
      const j0 = Math.max(0, Math.floor((r[1] - T.origem[1]) / T.passo) - 1);
      const i1 = Math.min(n - 1, Math.ceil((r[2] - T.origem[0]) / T.passo) + 1);
      const j1 = Math.min(n - 1, Math.ceil((r[3] - T.origem[1]) / T.passo) + 1);
      prepararDados(T, esp.floresta ?? estado.F, estado.dist, estado.dados, [i0, j0, i1, j1]);
      for (let j = j0; j <= j1; j++) estado.texDados.addUpdateRange(4 * (j * n + i0), 4 * (i1 - i0 + 1));
      tudo = unir(tudo, r);
    }
    estado.texDados.needsUpdate = true;
    if (alturaMudou) {
      estado.texAlt.mipmaps = [{ data: T.altura, width: n, height: n }, ...mipsDeMinimos(T)];
      estado.texAlt.needsUpdate = true;
      estado.P = piramideAlturas(T);
    }
    if (tudo) sujarCor(tudo);
  }

  /** Refaz o uso do solo nos retângulos (uma passada pelas tabelas para todos) e marca o mapa de cor. */
  function refazerUso(esp, rets) {
    const texels = rasterizarUso(esp, estado.uso, LADO_USO, estado.mapa, rets);
    for (const [i0, j0, i1, j1] of texels) {
      for (let j = j0; j <= j1; j++) estado.texUso.addUpdateRange(4 * (j * LADO_USO + i0), 4 * (i1 - i0 + 1));
    }
    for (const r of rets) sujarCor(r);
    estado.texUso.needsUpdate = true;
  }

  function mudancasDeUso(d, esp) {
    const rets = [];
    const A = esp.vias?.arestas;
    const P = esp.predios;
    const C = esp.celulas;
    if (pedeTudo(d, 'vias') || pedeTudo(d, 'arestas') || pedeTudo(d, 'predios') || pedeTudo(d, 'celulas')) return 'tudo';
    const trocar = (cache, k, nova) => {
      const velha = cache.ler(k);
      if (velha) rets.push(velha);
      if (nova) rets.push(nova);
      cache.gravar(k, nova);
    };
    for (const c of d.celulas ?? []) trocar(estado.caixasC, c, C ? caixaCelula(C, c) : null);
    for (const e of d.arestas ?? []) trocar(estado.caixasA, e, A ? caixaAresta(A, e) : null);
    for (const i of d.predios ?? []) trocar(estado.caixasP, i, P ? caixaPredio(P, i) : null);
    if (rets.length > 4096) return 'tudo';
    return juntarRetangulos(rets);
  }

  // ---------------------------------------------------------------- sobreposições

  const texR8 = (dados, n, filtro) => {
    const t = new THREE.DataTexture(dados, n, n, THREE.RedFormat, THREE.UnsignedByteType);
    t.minFilter = t.magFilter = filtro;
    t.unpackAlignment = 1; // linhas de n bytes: com o alinhamento 4 do padrão, uma grade de lado ímpar sairia torta
    t.generateMipmaps = false;
    t.colorSpace = THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  };

  function atualizarSobre(esp) {
    const s = estado.sobre;
    const m = estado.mapa;
    const modoV = U.uTerSobreModo.value;
    const ret = U.uTerSobreRet.value;
    modoV.set(0, 0, 0, 0);
    U.uTerLadrilho.value.x = 0;
    if (!m) return;
    if (s.ladrilhos && esp?.ladrilhos?.estado) {
      const d = new Uint8Array(256);
      d.set(esp.ladrilhos.estado.subarray(0, 256));
      if (!s.texLad) s.texLad = texR8(d, 16, THREE.NearestFilter);
      else {
        s.texLad.image.data.set(d);
        s.texLad.needsUpdate = true;
      }
      U.uTerSobre.value = s.texLad;
      U.uTerLadrilho.value.x = 1;
      return;
    }
    if (s.zona && esp?.celulas) {
      if (!s.texZona) s.texZona = texR8(new Uint8Array(LADO_USO * LADO_USO), LADO_USO, THREE.NearestFilter);
      if (s.zonaSuja) {
        rasterizarCelulas(esp, s.texZona.image.data, LADO_USO, m);
        s.texZona.needsUpdate = true;
        s.zonaSuja = false;
      }
      ZONAS_ORDEM.forEach((z, i) => {
        if (i > 0 && i < 8) U.uTerSobreRampa.value[i].set(ZONAS[z].cor);
      });
      U.uTerSobre.value = s.texZona;
      ret.set(m.ox, m.oz, 1 / m.lado, 1 / m.lado);
      modoV.set(1, 8, s.camada ? 0.8 : 0.2, 0);
      return;
    }
    const c = s.camada;
    if (!c) return;
    const cores = (c.cores ?? []).slice(0, 8);
    cores.forEach((hex, i) => U.uTerSobreRampa.value[i].set(hex));
    const nCores = Math.max(1, cores.length);
    const min = Number.isFinite(c.min) ? c.min : 0;
    const max = Number.isFinite(c.max) && c.max !== min ? c.max : min + 1;
    if (c.fonte === 'grade' && c.grade && c.dados) {
      const n = c.grade.n;
      const d = new Uint8Array(n * n);
      for (let k = 0; k < n * n; k++) d[k] = c.categorico ? Math.max(0, Math.min(255, Math.round(c.dados[k]))) : Math.round(Math.min(1, Math.max(0, (c.dados[k] - min) / (max - min))) * 255);
      s.texCamada?.dispose();
      s.texCamada = texR8(d, n, c.categorico ? THREE.NearestFilter : THREE.LinearFilter);
      const o = c.grade.origem ?? [m.ox, m.oz];
      const passo = c.grade.passo;
      // grade de amostras: a amostra k fica no centro do texel k
      ret.set(o[0] - passo / 2, o[1] - passo / 2, 1 / (passo * n), 1 / (passo * n));
      U.uTerSobre.value = s.texCamada;
      modoV.set(c.categorico ? 3 : 2, nCores, 1, 0);
    } else if (c.fonte === 'celulas' && c.dados && esp?.celulas) {
      if (!s.texZona) s.texZona = texR8(new Uint8Array(LADO_USO * LADO_USO), LADO_USO, THREE.NearestFilter);
      rasterizarCelulas(esp, s.texZona.image.data, LADO_USO, m, (i) => {
        const v = c.dados[i];
        if (!Number.isFinite(v)) return 0;
        return c.categorico ? Math.max(0, Math.min(255, Math.round(v))) : 1 + Math.round(Math.min(1, Math.max(0, (v - min) / (max - min))) * 254);
      });
      s.texZona.needsUpdate = true;
      s.zonaSuja = true;
      U.uTerSobre.value = s.texZona;
      ret.set(m.ox, m.oz, 1 / m.lado, 1 / m.lado);
      modoV.set(c.categorico ? 3 : 2, nCores, 1, 0);
    } else {
      // camadas por prédio ou por aresta: o chão só fica neutro (prédios e vias pintam a deles)
      modoV.set(0, 0, 1, 0);
    }
  }

  const soltar = [
    ctx.ouvir('camadas', (c) => {
      estado.sobre.camada = c ?? null;
      atualizarSobre(ctx.sim.espelho);
    }),
    ctx.ouvir('ferramenta.zona', (b) => {
      estado.sobre.zona = !!b;
      estado.sobre.zonaSuja = true;
      atualizarSobre(ctx.sim.espelho);
    }),
    ctx.ouvir('ferramenta.ladrilhos', (b) => {
      estado.sobre.ladrilhos = !!b;
      atualizarSobre(ctx.sim.espelho);
    }),
    ctx.ouvir('ferramenta.pincel', (p) => {
      if (p && Number.isFinite(p.x)) U.uTerPincel.value.set(p.x, p.z, p.raio ?? 24, 1);
      else U.uTerPincel.value.w = 0;
    }),
    ctx.ouvir('ferramenta.limpar', () => {
      U.uTerPincel.value.w = 0;
      estado.sobre.ladrilhos = false;
      atualizarSobre(ctx.sim.espelho);
    }),
    ctx.ouvir('qualidade', () => {
      // a troca de qualidade solta as texturas do registro: pede de novo
      U.uTerRuido.value = ctx.textura('chao.ruido');
      if (!estado.camadasCC0) U.uTerCamadasB.value = ctx.textura('chao.cc0');
      ligarDetalhe();
      espelharB();
      const novo = criarMaterialTerreno(ctx.ganchos, U, { detalhe: pt.detalhe > 0, ab: modo === 'ab' || estado.ab });
      malha.material = novo;
      mat.dispose();
      mat = novo;
      if (estado.T) montarTudo(ctx.sim.espelho);
    }),
  ];

  // ---------------------------------------------------------------- CDLOD

  const frustum = new THREE.Frustum();
  const m4 = new THREE.Matrix4();
  const caixa3 = new THREE.Box3();
  const camCorte = new THREE.PerspectiveCamera();
  function visivel(c) {
    caixa3.min.set(c.x0, c.y0, c.z0);
    caixa3.max.set(c.x1, c.y1, c.z1);
    return frustum.intersectsBox(caixa3);
  }
  function escolherNos(cam) {
    if (!estado.P) return;
    // o corte vai até 60 km, qualquer que seja o far da vista (a faixa de longe da R1a desenha com outro plano)
    if (cam.isPerspectiveCamera) {
      camCorte.copy(cam, false);
      camCorte.near = Math.min(cam.near, 1);
      camCorte.far = Math.max(cam.far, 60000);
      camCorte.updateProjectionMatrix();
      m4.multiplyMatrices(camCorte.projectionMatrix, cam.matrixWorldInverse);
    } else m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    frustum.setFromProjectionMatrix(m4);
    // escreve direto no atributo (sem um Float32Array novo por quadro)
    const attr = geo.getAttribute('aNo');
    const nos = selecionarNos({ cam: cam.position, visivel, faixas: estado.faixas, P: estado.P, fora: U.uTerFora.value.x > 0.5, saida: attr.array });
    attr.clearUpdateRanges();
    attr.addUpdateRange(0, nos.n * 4);
    attr.needsUpdate = true;
    geo.instanceCount = nos.n;
    estado.nos = nos.n;
  }

  // ---------------------------------------------------------------- API

  const api = {
    nome: 'terreno',
    chao: null,
    aplicar(d, esp) {
      const T = esp.terreno;
      if (!T) return;
      if (T !== estado.T || pedeTudo(d, 'terreno')) {
        montarTudo(esp);
        return;
      }
      const floresta = pedeTudo(d, 'floresta') ? [[estado.mapa.ox, estado.mapa.oz, estado.mapa.ox + estado.mapa.lado, estado.mapa.oz + estado.mapa.lado]] : d.floresta ?? [];
      if (d.terreno?.length) refazerTerreno(esp, d.terreno, true);
      if (floresta.length) refazerTerreno(esp, floresta, false);
      const uso = mudancasDeUso(d, esp);
      if (uso === 'tudo') {
        guardarCaixas(esp);
        rasterizarUso(esp, estado.uso, LADO_USO, estado.mapa);
        estado.texUso.needsUpdate = true;
        sujarCor([estado.mapa.ox, estado.mapa.oz, estado.mapa.ox + estado.mapa.lado, estado.mapa.oz + estado.mapa.lado]);
      } else if (uso.length) refazerUso(esp, uso);
      if (d.celulas?.length || pedeTudo(d, 'celulas')) {
        estado.sobre.zonaSuja = true;
        if (estado.sobre.zona) atualizarSobre(esp);
      }
      if (d.ladrilhos && estado.sobre.ladrilhos) atualizarSobre(esp);
    },
    quadro(tMs, c) {
      const agora = typeof performance !== 'undefined' ? performance.now() : tMs;
      if (estado.sujoCor.length && estado.assador && agora - estado.ultimoAssado > 200) {
        estado.assador.assarVarios(estado.mapa, estado.sujoCor);
        estado.sujoCor = [];
        estado.ultimoAssado = agora;
      }
      U.uTerEstacao.value = estacaoSeca(c.sim.espelho.tempo?.diaDoAno);
      escolherNos(c.camera);
      if (U.uTerAB.value.y > 0.5 && estado.abX !== undefined) U.uTerAB.value.x = estado.abX * c.renderer.getPixelRatio();
    },
    descartar() {
      for (const f of soltar) f();
      ctx.cena.remove(malha);
      geo.dispose();
      mat.dispose();
      estado.texAlt?.dispose();
      estado.texDados?.dispose();
      estado.texUso?.dispose();
      estado.assador?.descartar();
      for (const t of [estado.sobre.texZona, estado.sobre.texCamada, estado.sobre.texLad]) t?.dispose();
    },
  };

  const chao = {
    uniformes: U,
    malha,
    get perfil() {
      return pt;
    },
    get nos() {
      return estado.nos ?? 0;
    },
    get assados() {
      return estado.assador?.vezes ?? 0;
    },
    get usoSolo() {
      return { dados: estado.uso, lado: LADO_USO, mapa: estado.mapa, textura: estado.texUso };
    },
    /** Materiais em uso: 'proc', 'cc0' (quando carregou) e se o A/B está ligado. */
    materiais: () => ({ modo, cc0: !!estado.camadasCC0, ab: estado.ab || modo === 'ab' }),
    /** Liga o A/B (lado B CC0 à direita da divisa, em px CSS): recompila o material uma vez. */
    ab(ligado, xCss = null) {
      estado.ab = !!ligado;
      estado.abX = Number.isFinite(xCss) ? xCss : undefined;
      U.uTerAB.value.y = ligado ? 1 : 0;
      if (ligado && !('TER_AB' in mat.defines)) {
        mat.defines.TER_AB = '';
        mat.needsUpdate = true;
        espelharB();
        if (estado.camadasCC0) usarCC0(estado.camadasCC0, true);
        else carregarCC0({ renderer: ctx.renderer, THREE, montagem: ctx.montagem }).then((t) => t && ((estado.camadasCC0 = t), usarCC0(t, true)));
      }
    },
    /** Moldura de fora (serra e mar até 16 km): a R2b desliga quando o mundo de fora dela entrar. */
    fora(ligado) {
      U.uTerFora.value.x = ligado ? 1 : 0;
    },
    /** A copa baixa perto da câmera (R2b liga quando as árvores de perto existirem): distância e faixa em m. */
    copaPerto(dist, faixa = 150) {
      U.uTerCopaV.value.y = dist;
      U.uTerCopaV.value.z = faixa;
    },
    /** Refaz o mapa de cor (depois de pintar o uso do solo por fora, por exemplo). */
    reassar: (ret = null) => (ret ? sujarCor(ret) : estado.assador?.assar(estado.mapa)),
  };
  api.chao = chao;
  ctx.chao = chao;
  return api;
}

export function registrar(api) {
  api.registrarDominio('terreno', criarTerreno);
}
