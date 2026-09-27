// Gramática do prédio (desenho do render 5.1, D20, D39), pura: sem three e sem DOM (roda no worker `oficina` e no
// Node). Do lote (frente w ao longo da via, fundo d), do modelo e do nível do catálogo (a faixa de andares, D20), do
// estilo do bairro e da semente sai o PLANO: a lista de peças com relevo (volumes, telhado, varandas, pilotis, toldo,
// marquise, equipamentos, muro e piso do lote), a caixa e a altura do topo. O mesmo plano dá o LOD0 (todas as peças) e
// o LOD1 (as peças marcadas lod1, como instâncias de forma), então a silhueta não muda na troca.
//
// Tipologias brasileiras por zona e nível (o CS2 muda o visual a cada dois níveis): casa térrea ou sobrado com telha
// ou laje e caixa d'água, sobrados geminados, casa de alto padrão com laje em balanço; prédio sobre pilotis com janela
// em fita e cobogó, prédio com varandas e garagem no térreo, varanda gourmet; torre sobre pódio com área de lazer,
// torre de varandas, torre de vidro com heliponto; loja de rua com toldo e platibanda, mercado, galeria, uso misto,
// centro com pele perfurada; lâmina com brise (Capanema), pele de vidro, torre de controle solar em chanfro ou
// cilindro; galpão com shed ou arco, silos, fábrica limpa com painel solar.
//
// Espaço do lote: origem no centro, frente em +z (z = d/2 é o alinhamento da via), y = 0 na cota da plataforma.
// Peça: { forma, x, z, w, d, y0, h, giro, mat, topo, lod1, principal, chao, lote, sobra, soLod1, ... } (malhaPredio.js).
//   lod1     entra no LOD1 (instância de forma); principal: a única que fica no LOD2
//   chao     nasce no chão: desce ENTERRA m no terreno (o v da fachada continua medido do nível do lote)
//   lote     é do lote (muro, piso, piscina): fora da caixa do prédio
//   sobra    saliência que pode passar da silhueta do LOD1 (toldo, marquise, sacada): até SOBRA_MAX m
//   soLod1   só no LOD1 (o envelope de um galpão com shed, que no LOD0 são as paredes e os dentes)
import { Rng } from '../../comum/rng.js';
import { clamp } from '../../comum/util.js';
import { PREDIOS, PREDIOS_ORDEM } from '../../data/predios.js';
import { ZONAS } from '../../data/zonas.js';
import { PALETAS, ESTILOS_BAIRRO, TIPOLOGIAS, CORES_PREDIO } from '../../data/estilos.js';
import { FACHADA as F, TERREO, TERREO_ALTURA, USO } from './malhaPredio.js';

/** Metros que as peças do chão descem no terreno (o lote não é aplainado sob o prédio inteiro). */
export const ENTERRA = 2;
/** Folga até a divisa do lote (prédios geminados não brigam pela mesma face). */
export const FOLGA = 0.2;
/** Saliência máxima fora da silhueta do LOD1 (toldo, marquise, sacada, laje em balanço). */
export const SOBRA_MAX = 2.8;

const USO_FAM = { res: USO.RES, com: USO.COM, esc: USO.ESC, ind: USO.IND };

/** Fluxo xoshiro128** semeado pelo inteiro do prédio (splitmix32), sem texto: barato para milhares de prédios. */
export function rngDoPredio(semente) {
  const s = new Uint32Array(4);
  let a = semente >>> 0;
  for (let i = 0; i < 4; i++) {
    a = (a + 0x9e3779b9) >>> 0;
    let z = a;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    s[i] = (z ^ (z >>> 16)) >>> 0;
  }
  if (!(s[0] | s[1] | s[2] | s[3])) s[0] = 1;
  return new Rng(s);
}

// ------------------------------------------------------------------------------------------------ contexto

class Ctx {
  constructor(e, m, nv) {
    this.W = e.w;
    this.D = e.d;
    this.r = rngDoPredio(e.semente ?? 0);
    this.est = ESTILOS_BAIRRO[((e.estilo ?? 0) % ESTILOS_BAIRRO.length + ESTILOS_BAIRRO.length) % ESTILOS_BAIRRO.length];
    this.tip = nv.tipologia;
    this.par = TIPOLOGIAS[this.tip] ?? { pe: 3 };
    this.nivel = e.nivel;
    this.modelo = m;
    this.zona = m.zona;
    this.fam = ZONAS[m.zona]?.familia ?? 'res';
    this.uso = USO_FAM[this.fam] ?? 0;
    const [a0, a1] = nv.andares;
    this.andares = a0 + this.r.int(0, a1 - a0);
    this.andaresMax = a1;
    this.corJogador = CORES_PREDIO[e.cor ?? 0] ?? null;
    this.dg = e.abandonado ? 0.95 : clamp(0.18 + this.r.f() * 0.45 + (5 - e.nivel) * 0.04, 0, 1);
    this.vd = this.r.f();
    this.pecas = [];
  }

  /** Uma cor de uma paleta. */
  cor(paleta) {
    const p = PALETAS[paleta];
    return p[this.r.int(0, p.length - 1)];
  }

  /** Cor da parede principal pelo estilo do bairro (ou a escolhida pelo jogador). */
  parede(preferida = null) {
    if (this.corJogador) return this.corJogador;
    const lista = preferida ?? this.est.paredes;
    return this.cor(lista[this.r.escolher(lista.map((_, i) => 3 - i * 0.8))] ?? lista[0]);
  }

  /** Fachada sorteada pelo estilo do bairro dentro das permitidas. */
  fachada(permitidas) {
    const pesos = permitidas.map((f) => this.est.fachadas[f] ?? 0.4);
    return permitidas[Math.max(0, this.r.escolher(pesos))];
  }

  /** Material de superfície. */
  m(t, c1, c2 = null, extra = {}) {
    return { t, c1, c2: c2 ?? c1, a: this.par.pe ?? 3, v: 3, uso: this.uso, vr: 0, tr: 0, dg: this.dg, vd: this.vd, ...extra };
  }

  add(p) {
    this.pecas.push(p);
    return p;
  }
}

/** Cor dos montantes e peitoris das peles de vidro (alumínio, champanhe, grafite, bronze claro). */
const MONTANTE = ['#bdb9b1', '#a9aaa8', '#c9c3b6', '#8f9294', '#d2cdc2', '#b5aa98'];

const MAT_FACHADA = { janela: F.JANELA, fita: F.FITA, cortina: F.CORTINA, briseH: F.BRISE_H, briseV: F.BRISE_V, cobogo: F.COBOGO, varanda: F.VARANDA, pastilha: F.PASTILHA, painel: F.PAINEL };

/** Material de concreto e laje comuns. */
const laje = (c) => c.m(F.LAJE, c.cor('laje'));
const concreto = (c) => c.m(F.CONCRETO, c.cor('concreto'));
const metal = (c) => c.m(F.METAL, c.cor('metal'));

// ------------------------------------------------------------------------------------------------ peças comuns

/** Equipamentos na laje: condensadoras, exaustores e às vezes um painel solar (até 1,3 m de altura). */
function equipar(c, x0, z0, x1, z1, y, { max = 4, solar = 0, hMax = 1.25 } = {}) {
  const { r } = c;
  const w = x1 - x0;
  const d = z1 - z0;
  if (w < 2 || d < 2) return;
  const n = r.int(0, max);
  for (let k = 0; k < n; k++) {
    const cw = r.entre(0.8, 1.3);
    const x = r.entre(x0 + cw, x1 - cw);
    const z = r.entre(z0 + 0.6, z1 - 0.6);
    if (r.chance(0.7)) c.add({ forma: 'caixa', x, z, w: cw, d: 0.45, y0: y, h: Math.min(hMax, r.entre(0.6, 0.9)), giro: r.chance(0.5) ? 0 : Math.PI / 2, mat: c.m(F.METAL, '#b9bcba'), topo: c.m(F.METAL, '#a9acaa') });
    else c.add({ forma: 'coluna', redonda: true, x, z, w: 0.6, d: 0.6, y0: y, h: Math.min(hMax, r.entre(0.8, 1.2)), mat: metal(c) });
  }
  if (solar > 0 && r.chance(solar) && w > 5 && d > 4) {
    const fileiras = Math.min(4, Math.floor((d - 2) / 2.4));
    const pw = Math.min(w - 2, r.entre(3, 8));
    for (let k = 0; k < fileiras; k++) {
      c.add({ forma: 'inclinado', x: x0 + 1 + pw / 2, z: z0 + 1.2 + k * 2.4, w: pw, d: 1.7, y0: y + 0.3, h: 0.55, esp: 0.05, pontas: true, mat: c.m(F.SOLAR, '#20242a', '#b8bcbe'), baixo: metal(c) });
    }
  }
}

/** Casa de máquinas e caixa d'água sobre a laje (peças do LOD1: o topo da silhueta). */
function casaDeMaquinas(c, x, z, w, d, y, { agua = true } = {}) {
  const { r } = c;
  const h = r.entre(2.8, 3.6);
  const parede = c.m(F.LISO, c.pecas[0]?.mat?.c1 ?? c.cor('rebocoClaro'));
  c.add({ forma: 'caixa', x, z, w, d, y0: y, h, mat: parede, topo: laje(c), parapeito: 0.3, lod1: true });
  if (agua) {
    const aw = Math.min(w, r.entre(3, 4.5));
    c.add({ forma: 'caixa', x: x + r.entre(-0.4, 0.4) * (w - aw), z, w: aw, d: Math.min(d, aw * 0.8), y0: y + h, h: r.entre(1.6, 2.2), mat: concreto(c), topo: laje(c), lod1: true });
  }
  return y + h;
}

/** Muro (ou mureta com grade) na frente do lote, com os portões. */
function muro(c, { h = 1.6, portoes = [], mat = null, mureta = false } = {}) {
  const { W, D, r } = c;
  const z = D / 2 - 0.12;
  const mm = mat ?? c.m(F.LISO, c.pecas[0]?.mat?.c1 ?? c.cor('rebocoCor'));
  const cap = c.m(F.CONCRETO, '#bdb8ae');
  const lista = portoes.map(([x, w]) => [x - w / 2, x + w / 2]).sort((a, b) => a[0] - b[0]);
  let x = -W / 2 + 0.05;
  const hm = mureta ? 0.7 : h;
  const seg = (a, b) => {
    if (b - a < 0.3) return;
    c.add({ forma: 'caixa', x: (a + b) / 2, z, w: b - a, d: 0.16, y0: 0, h: hm, chao: true, mat: mm, topo: cap, lote: true });
    if (mureta) c.add({ forma: 'placa', x: (a + b) / 2, z, w: b - a, d: 0.04, y0: hm, h: h - hm, mat: c.m(F.BRISE_V, '#2e3032', '#3a3c3e', { a: 3, v: 0.5 }), lote: true });
  };
  for (const [a, b] of lista) {
    seg(x, a);
    // portão: chapa de metal (social) ou basculante (garagem)
    const largo = b - a > 2;
    c.add({ forma: 'placa', x: (a + b) / 2, z: z - 0.02, w: b - a, d: 0.04, y0: 0.05, h: h * 0.95, mat: largo ? c.m(F.GARAGEM, c.cor('caixilho')) : c.m(F.METAL, r.chance(0.5) ? '#3b3d3f' : c.cor('caixilho')), lote: true });
    x = b;
  }
  seg(x, W / 2 - 0.05);
}

/** Piso do lote (retângulo em z, na largura toda). */
function pisoLote(c, z0, z1, mat, x0 = -c.W / 2, x1 = c.W / 2) {
  if (z1 - z0 < 0.3 || x1 - x0 < 0.3) return;
  c.add({ forma: 'piso', x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, y0: 0.04, h: 0, mat, lote: true });
}

/** Telhado de duas águas sobre uma caixa (bx, bz, bw, bd) com topo das paredes em hW. */
function telhado(c, bx, bz, bw, bd, hW, parede, { aoLongo = null, tg = null, beiral = null } = {}) {
  const { r, W } = c;
  const t = tg ?? r.entre(0.3, 0.46);
  const b = beiral ?? r.entre(0.45, 0.75);
  const longo = aoLongo ?? (bw >= bd * 0.85 ? true : r.chance(0.3));
  // o beiral não passa da divisa: do lado do vizinho ele encolhe (casas geminadas)
  const folgaX = Math.max(0, Math.min((bx - bw / 2) - (-W / 2 + 0.05), (W / 2 - 0.05) - (bx + bw / 2)));
  const bx2 = Math.min(b, folgaX);
  const bS = longo ? b : bx2;
  const bO = longo ? bx2 : b;
  const vao = longo ? bd : bw;
  const comp = longo ? bw : bd;
  const h = (vao / 2 + bS) * t;
  return c.add({
    forma: 'duasAguas', x: bx, z: bz, w: comp + 2 * bO, d: vao + 2 * bS, y0: hW - bS * t, h, giro: longo ? 0 : Math.PI / 2, beiral: bS, beiralOitao: bO,
    mat: parede, topo: c.m(F.TELHA, c.cor('telha')), lod1: true,
  });
}

// ------------------------------------------------------------------------------------------------ residencial baixa

function casa(c) {
  const { W, D, r } = c;
  const recuo = clamp(r.entre(...c.par.recuo), 1.5, Math.max(1.5, D * 0.28));
  const quintal = D >= 20 ? r.entre(3, 6.5) : r.entre(1.2, 2.5);
  const bd = clamp(D - recuo - quintal, 6, 13.5);
  const lado = r.chance(0.5) ? 1 : -1;
  let x0 = -W / 2 + FOLGA;
  let x1 = W / 2 - FOLGA;
  let garagem = null;
  if (W <= 9) {
    const corredor = r.entre(1.0, 1.5);
    if (lado > 0) x0 += corredor;
    else x1 -= corredor;
  } else {
    const g = r.entre(3.0, 3.5);
    const lat = r.entre(0.9, 1.8);
    if (lado > 0) {
      x0 = -W / 2 + g;
      x1 = Math.min(W / 2 - lat, x0 + 13);
      garagem = [-W / 2 + g / 2, g - 0.4];
    } else {
      x1 = W / 2 - g;
      x0 = Math.max(-W / 2 + lat, x1 - 13);
      garagem = [W / 2 - g / 2, g - 0.4];
    }
  }
  const bw = x1 - x0;
  const bx = (x0 + x1) / 2;
  const bz = D / 2 - recuo - bd / 2;
  const n = c.andares;
  const pe = c.par.pe;
  const hW = n * pe + 0.3;
  const corParede = c.parede(c.nivel >= 3 ? ['rebocoCor', 'rebocoClaro', 'pastilha'] : ['rebocoCor', 'rebocoClaro', 'tijolo']);
  const tijolo = PALETAS.tijolo.includes(corParede);
  // variante 4 a 7: janelas com grade de ferro (mais comum no bairro popular)
  const grade = r.chance(c.est.id === 'popular' ? 0.65 : 0.3);
  const parede = c.m(tijolo ? F.TIJOLO : F.CASA, corParede, c.cor('caixilho'), { v: r.entre(2.8, 3.6), vr: grade ? r.int(4, 7) : r.int(0, 3), a: pe });
  const comTelha = r.chance(c.est.telha * (c.par.telha ?? 0.6) * 1.4);
  const par = comTelha ? 0 : r.entre(0.5, 0.9);
  c.add({
    forma: 'caixa', x: bx, z: bz, w: bw, d: bd, y0: 0, h: hW + par, chao: true, mat: parede, lod1: true, principal: true,
    topo: comTelha ? c.m(F.TELHA, '#a45a3d') : laje(c), sem: comTelha ? 16 : 0, parapeito: par,
  });
  if (comTelha) telhado(c, bx, bz, bw, bd, hW, parede);
  else {
    // caixa d'água sobre a laje, às vezes num castelinho de alvenaria
    const alto = r.chance(0.45);
    const tw = r.entre(1.8, 2.6);
    const tx = clamp(bx + r.entre(-0.3, 0.3) * bw, x0 + tw / 2 + 0.3, x1 - tw / 2 - 0.3);
    const tz = bz - bd * r.entre(0.05, 0.3);
    c.add({ forma: 'caixa', x: tx, z: tz, w: tw, d: tw, y0: hW, h: alto ? r.entre(2.6, 3.2) : r.entre(1.5, 1.9), mat: c.m(F.LISO, corParede), topo: c.m(F.LAJE, '#8e9aa0'), lod1: true });
    equipar(c, x0 + 0.4, bz - bd / 2 + 0.4, x1 - 0.4, bz + bd / 2 - 0.4, hW, { max: 1, solar: 0.4 });
  }
  // varanda na frente (laje ou telhadinho sobre dois pilares)
  const zf = bz + bd / 2;
  if (recuo >= 2.6 && r.chance(0.45)) {
    const pw = bw * r.entre(0.55, 1);
    const px = bx + ((bw - pw) / 2) * (r.chance(0.5) ? 1 : -1);
    const pd = Math.min(recuo - 0.8, r.entre(1.8, 2.5));
    const ph = pe * 0.96;
    if (comTelha) c.add({ forma: 'inclinado', x: px, z: zf + pd / 2, w: pw, d: pd, y0: ph, h: 0.45, mat: c.m(F.TELHA, c.cor('telha')), baixo: c.m(F.MADEIRA, '#8a6d52'), sobra: true });
    else c.add({ forma: 'caixa', x: px, z: zf + pd / 2, w: pw, d: pd, y0: ph, h: 0.16, mat: c.m(F.CONCRETO, '#c8c2b6'), topo: laje(c), base: c.m(F.LISO, '#d6d0c4'), sobra: true });
    for (const s of [-1, 1]) c.add({ forma: 'coluna', redonda: r.chance(0.3), x: px + s * (pw / 2 - 0.2), z: zf + pd - 0.2, w: 0.22, d: 0.22, y0: 0, h: ph, mat: c.m(F.LISO, '#d9d4c9'), sobra: true });
  }
  // sacada no andar de cima
  if (n >= 2 && r.chance(0.4)) {
    const sw = Math.min(bw - 1, r.entre(2.4, 3.6));
    c.add({ forma: 'varanda', x: bx + r.entre(-0.25, 0.25) * (bw - sw), z: zf + 0.5, w: sw, d: 1.0, y0: pe - 0.16, mat: c.m(F.CONCRETO, '#cfc9bd'), guarda: r.chance(0.5) ? c.m(F.METAL, '#2f3133') : c.m(F.LISO, corParede), sobra: true });
  }
  // porta de entrada (madeira ou metal) na frente da casa, alinhada ao portão social
  const xp = clamp(bx + r.entre(-0.3, 0.3) * bw, x0 + 0.9, x1 - 0.9);
  c.add({ forma: 'placa', umLado: true, x: xp, z: zf + 0.03, w: 0.95, d: 0, y0: 0.05, h: 2.15, mat: c.m(F.PORTA, r.chance(0.6) ? c.cor('madeira') : '#3b3d3f', '#cfd1cf'), sobra: true });
  // muro, portões, divisas e o quintal da frente cimentado
  const portoes = [[xp, 1.0]];
  if (garagem) portoes.push(garagem);
  muro(c, { h: r.entre(1.2, 2.0), portoes, mat: r.chance(0.3) ? c.m(r.chance(0.5) ? F.PEDRA : F.TIJOLO, r.chance(0.5) ? c.cor('pedra') : c.cor('tijolo')) : null });
  if (r.chance(0.5)) {
    for (const s of [-1, 1]) c.add({ forma: 'caixa', x: s * (W / 2 - 0.08), z: zf + (D / 2 - zf) / 2, w: 0.14, d: D / 2 - zf - 0.2, y0: 0, h: 1.9, chao: true, mat: c.m(F.LISO, '#cbc4b6'), topo: concreto(c), lote: true });
  }
  pisoLote(c, zf, D / 2 - 0.25, c.m(F.PISO, r.chance(0.5) ? c.cor('piso') : '#9a6a52'));
}

function sobradoGeminado(c) {
  const { W, D, r } = c;
  const nU = clamp(Math.round(W / r.entre(6.5, 8.5)), 1, 4);
  const uw = (W - 2 * FOLGA) / nU;
  const recuo = clamp(r.entre(...c.par.recuo), 1.5, D * 0.25);
  const bd = clamp(D - recuo - r.entre(2, 5), 7, 14);
  const bz = D / 2 - recuo - bd / 2;
  const n = Math.max(2, c.andares);
  const pe = c.par.pe;
  const hW = n * pe + 0.3;
  const corParede = c.parede(['rebocoCor', 'rebocoClaro', 'pastilha']);
  const t = c.fachada(['janela', 'fita', 'pastilha']);
  const parede = c.m(t === 'pastilha' ? F.PASTILHA : t === 'fita' ? F.FITA : F.CASA, corParede, c.cor('caixilho'), { v: uw / r.int(2, 3), vr: r.int(0, 5), a: pe, tr: r.chance(0.5) ? TERREO.GARAGEM : 0 });
  const comTelha = r.chance(c.est.telha * 1.1);
  const par = comTelha ? 0 : r.entre(0.6, 1.0);
  c.add({ forma: 'caixa', x: 0, z: bz, w: W - 2 * FOLGA, d: bd, y0: 0, h: hW + par, chao: true, mat: parede, lod1: true, principal: true, topo: comTelha ? c.m(F.TELHA, '#a45a3d') : laje(c), sem: comTelha ? 16 : 0, parapeito: par });
  if (comTelha) telhado(c, 0, bz, W - 2 * FOLGA, bd, hW, parede, { aoLongo: true });
  const zf = bz + bd / 2;
  const espelho = r.chance(0.5);
  const guarda = r.chance(0.5) ? c.m(F.METAL, '#303234') : c.m(F.LISO, corParede);
  for (let k = 0; k < nU; k++) {
    const ux = -W / 2 + FOLGA + uw * (k + 0.5);
    const lado = (k % 2 === 0) === espelho ? 1 : -1;
    // varanda de cada unidade nos andares de cima, espelhada de uma para a outra
    c.add({ forma: 'placa', umLado: true, x: ux - lado * uw * 0.28, z: zf + 0.03, w: 0.95, d: 0, y0: 0.05, h: 2.15, mat: c.m(F.PORTA, c.cor('madeira'), '#cfd1cf'), sobra: true });
    for (let a = 1; a < n; a++) c.add({ forma: 'varanda', x: ux + lado * uw * 0.18, z: zf + 0.55, w: uw * 0.55, d: 1.1, y0: a * pe - 0.16, mat: c.m(F.CONCRETO, '#cfc9bd'), guarda, sobra: true });
    if (!comTelha) c.add({ forma: 'caixa', x: ux - lado * uw * 0.2, z: bz - bd * 0.25, w: 1.8, d: 1.8, y0: hW, h: 1.6, mat: c.m(F.LISO, corParede), topo: c.m(F.LAJE, '#8e9aa0'), lod1: true });
  }
  if (!comTelha) equipar(c, -W / 2 + 1, bz - bd / 2 + 0.5, W / 2 - 1, bz + bd / 2 - 0.5, hW, { max: nU, solar: 0.3 });
  const portoes = [];
  for (let k = 0; k < nU; k++) portoes.push([-W / 2 + FOLGA + uw * (k + 0.5) + (espelho ? 1 : -1) * uw * 0.15, Math.min(uw - 2, 2.6)]);
  muro(c, { h: r.entre(1.0, 1.8), portoes, mureta: r.chance(0.4) });
  pisoLote(c, zf, D / 2 - 0.25, c.m(F.PISO, c.cor('piso')));
}

function casaAltoPadrao(c) {
  const { W, D, r } = c;
  const recuo = clamp(r.entre(...c.par.recuo), 3, D * 0.4);
  const aw = Math.min(W - 3, r.entre(10, 16));
  const ad = clamp(D - recuo - r.entre(3, 6), 7, 12);
  const az = D / 2 - recuo - ad / 2;
  const pe = c.par.pe;
  const branco = c.parede(['rebocoClaro']);
  const madeira = c.cor('madeira');
  const vidro = c.m(F.CORTINA, branco, '#3a3c3e', { v: 2.4, a: pe });
  const baixo = c.add({ forma: 'caixa', x: 0, z: az, w: aw, d: ad, y0: 0, h: pe + 0.2, chao: true, mat: vidro, lado: c.m(F.LISO, branco), topo: laje(c), lod1: true, principal: true });
  // volume de cima: desalinhado, em balanço sobre o de baixo, com painel de madeira e laje fina que avança
  const bw = Math.min(W - 2, Math.max(Math.min(7, W - 2), aw * r.entre(0.7, 1.05)));
  const bdd = ad * r.entre(0.7, 0.95);
  const sx = r.entre(-1, 1) * Math.max(0, (W - 2 - bw) / 2);
  const bz = az + r.entre(0.5, 2.2);
  const cima = c.m(F.JANELA, madeira, '#2f3133', { v: 3.2, vr: 6, a: pe });
  c.add({ forma: 'caixa', x: sx, z: bz, w: bw, d: bdd, y0: pe + 0.2, h: pe, mat: cima, lado: c.m(F.MADEIRA, madeira), topo: laje(c), lod1: true });
  c.add({ forma: 'caixa', x: sx, z: bz + 0.8, w: Math.min(bw + 1.2, W - 0.4 - 2 * Math.abs(sx)), d: bdd + 1.6, y0: 2 * pe + 0.2, h: 0.28, mat: c.m(F.LISO, '#dedbd3'), topo: laje(c), base: c.m(F.LISO, '#e0ddd6'), sobra: true });
  // piscina e deck na frente, muro baixo de pedra
  const zf = az + ad / 2;
  const pw = Math.min(W - 4, r.entre(6, 10));
  if (recuo >= 5) {
    pisoLote(c, zf + 0.5, D / 2 - 0.4, c.m(F.MADEIRA, '#8e6c4c', null, { v: 1 }), -pw / 2 - 1, pw / 2 + 1);
    c.add({ forma: 'piso', x: 0, z: zf + (D / 2 - zf) / 2, w: pw, d: Math.min(recuo - 2, 4), y0: 0.06, h: 0, mat: c.m(F.AGUA, '#2a5a5e'), lote: true });
  }
  muro(c, { h: 1.1, portoes: [[W * 0.3, 3], [-W * 0.2, 1.2]], mat: c.m(F.PEDRA, c.cor('pedra')) });
  return baixo;
}

// ------------------------------------------------------------------------------------------------ residencial média e alta

/** Recuos e envelope de um prédio: frente, laterais e fundos. */
function envelope(c, { recuo, lat, fundo, dMax = 22, wMax = 40 }) {
  const { W, D } = c;
  const w = clamp(W - 2 * lat, 6, wMax);
  const d = clamp(D - recuo - fundo, 6, dMax);
  return { w, d, z: D / 2 - recuo - d / 2 };
}

/** Fachada de parede de prédio médio pelo estilo. */
function fachadaPredio(c, permitidas, extra = {}) {
  const f = c.fachada(permitidas);
  const t = MAT_FACHADA[f] ?? F.JANELA;
  const cor = t === F.PASTILHA ? c.cor('pastilha') : t === F.PAINEL || t === F.FITA ? c.parede(['concreto', 'rebocoClaro']) : c.parede();
  return c.m(t, cor, c.cor('caixilho'), { v: c.r.entre(2.6, 3.8), vr: c.r.int(0, 5), ...extra });
}

function pilotis(c) {
  const { W, D, r } = c;
  const recuo = r.entre(...c.par.recuo);
  const lat = W >= 24 ? r.entre(2, 3.5) : 1.5;
  const env = envelope(c, { recuo, lat, fundo: r.entre(3, 5), dMax: r.entre(14, 20) });
  const ph = TERREO_ALTURA[TERREO.PILOTIS];
  const pe = c.par.pe;
  const nCima = Math.max(3, c.andares - 1);
  const par = r.entre(0.9, 1.3);
  const hCorpo = nCima * pe + par;
  const parede = fachadaPredio(c, ['fita', 'janela', 'pastilha', 'painel']);
  const lado = c.m(r.chance(0.5) ? F.JANELA : F.LISO, parede.c1, parede.c2, { v: 3.2, vr: 4 });
  c.add({ forma: 'caixa', x: 0, z: env.z, w: env.w, d: env.d, y0: ph, h: hCorpo, mat: parede, lado, topo: laje(c), parapeito: par, base: concreto(c), aoBase: 0.45, lod1: true, principal: true });
  // hall de vidro e a caixa da escada sob o prédio
  const hw = env.w * r.entre(0.3, 0.45);
  const hd = env.d * r.entre(0.4, 0.6);
  c.add({ forma: 'caixa', x: r.entre(-0.2, 0.2) * env.w, z: env.z - env.d * 0.1, w: hw, d: hd, y0: 0, h: ph, chao: true, mat: c.m(F.CORTINA, '#d9d4c9', '#3a3c3e', { v: 2.4, a: ph }), lado: concreto(c), topo: laje(c), sem: 16, lod1: true });
  // pilotis em grade, redondos ou quadrados
  const nx = Math.max(2, Math.round(env.w / r.entre(4.5, 6.5)));
  const nz = Math.max(2, Math.round(env.d / r.entre(4.5, 6)));
  const red = r.chance(0.55);
  const cw = r.entre(0.45, 0.7);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = -env.w / 2 + 0.7 + ((env.w - 1.4) * i) / (nx - 1);
      const z = env.z - env.d / 2 + 0.7 + ((env.d - 1.4) * j) / (nz - 1);
      c.add({ forma: 'coluna', redonda: red, x, z, w: cw, d: cw, y0: -ENTERRA, h: ph + ENTERRA, mat: c.m(F.CONCRETO, '#c9c3b7') });
    }
  }
  // cobogó da escada numa das faces laterais
  if (r.chance(0.7)) {
    const s = r.chance(0.5) ? 1 : -1;
    const cd = Math.min(env.d * 0.4, 5);
    c.add({ forma: 'placa', umLado: true, x: s * (env.w / 2 + 0.03), z: env.z + r.entre(-0.3, 0.3) * env.d, w: cd, d: 0, y0: ph, h: nCima * pe, giro: s * Math.PI / 2, mat: c.m(F.COBOGO, r.chance(0.5) ? '#d8d2c4' : parede.c1), sobra: true });
  }
  const topo = ph + hCorpo;
  casaDeMaquinas(c, r.entre(-0.2, 0.2) * env.w, env.z - env.d * 0.2, r.entre(5, 7), r.entre(4, 5), topo - par);
  equipar(c, -env.w / 2 + 0.8, env.z - env.d / 2 + 0.8, env.w / 2 - 0.8, env.z + env.d / 2 - 0.8, topo - par, { max: 3 });
  const zf = env.z + env.d / 2;
  c.add({ forma: 'caixa', x: -c.W / 2 + 2.2, z: c.D / 2 - 2.2, w: 2.4, d: 2.4, y0: 0, h: 2.8, chao: true, mat: c.m(F.JANELA, '#d6d0c4', '#3a3c3e', { v: 2.4, vr: 5, a: 2.8 }), topo: laje(c), lote: true });
  muro(c, { h: 2.1, portoes: [[r.entre(-0.2, 0.2) * c.W, 1.2], [c.W / 2 - 2.6, 3.4]], mureta: true });
  pisoLote(c, zf, D / 2 - 0.2, c.m(F.PISO, c.cor('piso')));
}

/**
 * Prédio de varandas: pódio de garagem (ventilado por cobogó), corpo com o núcleo recuado e as varandas no envelope,
 * cobertura recuada no alto. gourmet: varandas fundas com guarda-corpo de vidro.
 */
function varandas(c, { gourmet = false } = {}) {
  const { W, D, r } = c;
  const recuo = r.entre(...c.par.recuo);
  const pe = c.par.pe;
  const G = c.andares >= 10 ? 2 : 1;
  const tr = TERREO.PORTARIA;
  const hPod = TERREO_ALTURA[tr] + (G - 1) * 3.0;
  const podD = clamp(D - recuo - 2, 10, 36);
  const podZ = D / 2 - recuo - podD / 2;
  const podMat = c.m(F.PAINEL, c.parede(['concreto', 'rebocoClaro']), c.cor('caixilho'), { tr, v: 3.6, a: 3.0 });
  c.add({ forma: 'caixa', x: 0, z: podZ, w: W - 2 * FOLGA, d: podD, y0: 0, h: hPod + 1.1, chao: true, mat: podMat, lado: c.m(F.COBOGO, podMat.c1), topo: c.m(F.LAJE, '#8d8a82'), parapeito: 1.1, lod1: true });
  const lat = r.entre(2.5, 4);
  const env = envelope(c, { recuo: recuo + r.entre(1, 3), lat, fundo: r.entre(3, 5), dMax: r.entre(16, 22) });
  const nCima = Math.max(3, c.andares - G);
  const prof = gourmet ? r.entre(2.2, 2.7) : r.entre(1.3, 1.8);
  const par = r.entre(1.0, 1.4);
  const cob = nCima >= 8 && r.chance(0.6);
  const nCorpo = cob ? nCima - 1 : nCima;
  const hCorpo = nCorpo * pe;
  const corP = c.parede(gourmet ? ['rebocoClaro', 'pastilha'] : null);
  const vr = gourmet || r.chance(0.5) ? 0 : 1; // 0 vidro, 1 guarda-corpo cheio
  const matEnv = c.m(F.VARANDA, corP, '#d8d3c8', { v: r.entre(3.2, 4.2), vr, a: pe });
  const matNucleo = c.m(F.JANELA, corP, c.cor('caixilho'), { v: matEnv.v, vr: 7, a: pe });
  const matLado = c.m(gourmet ? F.PASTILHA : F.JANELA, corP, c.cor('caixilho'), { v: 3.2, vr: 4, a: pe });
  const y0 = hPod;
  // envelope do LOD1 (a fachada de varandas desenhada) e, no LOD0, o núcleo recuado com as varandas de verdade
  c.add({ forma: 'caixa', x: 0, z: env.z, w: env.w, d: env.d, y0, h: hCorpo + par, mat: matEnv, lado: matLado, fundo: matLado, topo: laje(c), parapeito: par, lod1: true, principal: true, soLod1: true });
  c.add({ forma: 'caixa', x: 0, z: env.z - prof / 2, w: env.w, d: env.d - prof, y0, h: hCorpo + par, mat: matNucleo, lado: matLado, fundo: matLado, topo: laje(c), parapeito: par });
  const bays = Math.max(1, Math.round(env.w / matEnv.v));
  const grupos = gourmet ? [[0, bays]] : bays >= 4 && r.chance(0.6) ? [[0, 2], [bays - 2, bays]] : [[0, bays]];
  const guarda = vr === 0 ? c.m(F.VIDRO, '#9fb0b4') : c.m(F.LISO, corP);
  const lajeV = c.m(F.CONCRETO, '#d8d3c8');
  const zv = env.z + env.d / 2 - prof / 2;
  for (let a = 0; a < nCorpo; a++) {
    for (const [b0, b1] of grupos) {
      const xa = -env.w / 2 + (env.w * b0) / bays + 0.1;
      const xb = -env.w / 2 + (env.w * b1) / bays - 0.1;
      c.add({ forma: 'varanda', x: (xa + xb) / 2, z: zv, w: xb - xa, d: prof, y0: y0 + a * pe, esp: 0.18, gc: gourmet ? 1.15 : 1.05, mat: lajeV, guarda, semPontas: grupos.length === 1 && gourmet });
    }
  }
  let topo = y0 + hCorpo + par;
  if (cob) {
    // cobertura recuada com terraço
    const cw = env.w * r.entre(0.55, 0.8);
    const cd = env.d - prof - r.entre(2, 4);
    c.add({ forma: 'caixa', x: r.entre(-0.15, 0.15) * env.w, z: env.z - prof / 2 - (env.d - prof - cd) / 2, w: cw, d: cd, y0: y0 + hCorpo, h: pe + par, mat: c.m(F.CORTINA, corP, c.cor('caixilho'), { v: 2.6, a: pe }), lado: matLado, topo: laje(c), parapeito: par, lod1: true });
    topo = y0 + hCorpo + pe + par;
  }
  casaDeMaquinas(c, r.entre(-0.1, 0.1) * env.w, env.z - env.d * 0.25, r.entre(5, 7), r.entre(3.5, 5), topo - par);
  equipar(c, -env.w / 2 + 0.8, env.z - env.d / 2 + 0.8, env.w / 2 - 0.8, env.z + env.d / 2 - prof - 0.5, y0 + hCorpo, { max: 3 });
  // lazer na laje do pódio (atrás da torre): deck e verde
  const livreFundo = env.z - env.d / 2 - (podZ - podD / 2);
  if (livreFundo > 4) c.add({ forma: 'piso', x: 0, z: podZ - podD / 2 + livreFundo / 2, w: W - 3, d: livreFundo - 1.5, y0: hPod + 0.05, h: 0, mat: c.m(F.VERDE, c.cor('verde')) });
  muro(c, { h: 2.0, portoes: [[r.entre(-0.25, 0.25) * W, 1.4], [W / 2 - 2.8, 3.6]], mureta: true });
  pisoLote(c, podZ + podD / 2, D / 2 - 0.2, c.m(F.PISO, c.cor('piso')));
}

/** Pódio de torre (garagem, hall e lazer) com a piscina e o verde na laje. */
function podio(c, { andares = 2, tr = TERREO.PORTARIA, recuo, mat = null, lazer = true }) {
  const { W, D, r } = c;
  const hPod = TERREO_ALTURA[tr] + (andares - 1) * 3.2;
  const podD = clamp(D - recuo - 2, 10, 44);
  const podZ = D / 2 - recuo - podD / 2;
  const m = mat ?? c.m(F.PAINEL, c.parede(['concreto', 'pedra', 'rebocoClaro']), c.cor('caixilho'), { tr, v: 4, a: 3.2 });
  c.add({ forma: 'caixa', x: 0, z: podZ, w: W - 2 * FOLGA, d: podD, y0: 0, h: hPod + 1.1, chao: true, mat: m, lado: c.m(F.COBOGO, m.c1), topo: c.m(F.LAJE, '#8d8a82'), parapeito: 1.1, lod1: true });
  return { h: hPod, z: podZ, d: podD, lazer };
}

/** Lazer na laje do pódio: piscina, deck e verde fora da projeção da torre. */
function lazerNoPodio(c, pod, tz, td) {
  const { W, r } = c;
  const frente = pod.z + pod.d / 2 - (tz + td / 2);
  const fundo = tz - td / 2 - (pod.z - pod.d / 2);
  const faixa = frente > fundo ? [tz + td / 2 + 0.8, pod.z + pod.d / 2 - 1.2] : [pod.z - pod.d / 2 + 1.2, tz - td / 2 - 0.8];
  const fd = faixa[1] - faixa[0];
  if (fd < 3) return;
  const y = pod.h + 0.05;
  c.add({ forma: 'piso', x: 0, z: (faixa[0] + faixa[1]) / 2, w: W - 3, d: fd, y0: y, h: 0, mat: c.m(F.PISO, '#b4ab9c') });
  const pw = Math.min(W * 0.45, 14);
  c.add({ forma: 'piso', x: r.entre(-0.2, 0.2) * W, z: (faixa[0] + faixa[1]) / 2, w: pw, d: Math.min(fd - 1.2, 5), y0: y + 0.02, h: 0, mat: c.m(F.AGUA, '#2a5a5e') });
  c.add({ forma: 'piso', x: W / 2 - 3, z: (faixa[0] + faixa[1]) / 2, w: 3.5, d: fd - 0.6, y0: y + 0.03, h: 0, mat: c.m(F.VERDE, c.cor('verde')) });
}

function torrePodio(c) {
  const { W, D, r } = c;
  const recuo = r.entre(...c.par.recuo);
  const pe = c.par.pe;
  const pod = podio(c, { andares: r.int(2, 3), recuo });
  const tw = clamp(W - r.entre(8, 14), 16, 26);
  const td = clamp(D - recuo - r.entre(12, 18), 14, 22);
  const tz = pod.z - pod.d / 2 + td / 2 + r.entre(3, 6);
  const nCima = Math.max(10, c.andares - 2);
  const par = r.entre(1.2, 1.8);
  const parede = fachadaPredio(c, ['pastilha', 'janela', 'painel', 'fita']);
  const h = nCima * pe + par;
  c.add({ forma: 'caixa', x: 0, z: tz, w: tw, d: td, y0: pod.h, h, mat: parede, topo: laje(c), parapeito: par, lod1: true, principal: true });
  // pilastras verticais na frente e no fundo: ritmo vertical, nada de listras iguais
  const np = r.int(1, 2);
  for (let k = 0; k < np; k++) {
    const px = (tw / (np + 1)) * (k + 1) - tw / 2;
    for (const s of [1, -1]) c.add({ forma: 'caixa', x: px, z: tz + s * (td / 2 + 0.25), w: r.entre(0.8, 1.4), d: 0.5, y0: pod.h, h: h - par, mat: c.m(F.LISO, parede.t === F.PASTILHA ? '#d9d4c9' : parede.c1), topo: concreto(c) });
  }
  lazerNoPodio(c, pod, tz, td);
  const topo = pod.h + h;
  casaDeMaquinas(c, 0, tz, Math.min(tw * 0.5, 9), Math.min(td * 0.45, 7), topo - par);
  equipar(c, -tw / 2 + 1, tz - td / 2 + 1, tw / 2 - 1, tz + td / 2 - 1, topo - par, { max: 4 });
  muro(c, { h: 2.2, portoes: [[0, 1.6], [W / 2 - 3, 4]], mureta: true });
  pisoLote(c, pod.z + pod.d / 2, D / 2 - 0.2, c.m(F.PISO, c.cor('piso')));
}

function torreVarandas(c) {
  const { W, D, r } = c;
  const recuo = r.entre(...c.par.recuo);
  const pe = c.par.pe;
  const pod = podio(c, { andares: r.int(2, 4), recuo });
  const tw = clamp(W - r.entre(8, 12), 16, 26);
  const td = clamp(D - recuo - r.entre(12, 16), 14, 22);
  const tz = pod.z - pod.d / 2 + td / 2 + r.entre(3, 6);
  const nCima = Math.max(12, c.andares - 3);
  const par = r.entre(1.2, 1.6);
  const corP = c.parede(['rebocoClaro', 'pastilha']);
  const prof = r.entre(1.4, 2.0);
  const vr = r.chance(0.6) ? 0 : 1;
  const matEnv = c.m(F.VARANDA, corP, '#d7d2c7', { v: r.entre(3.4, 4.4), vr, a: pe });
  const matLado = c.m(F.PASTILHA, c.cor('pastilha'), c.cor('caixilho'), { v: 3.2, vr: 4, a: pe });
  const coroa = r.int(1, 2);
  const nCorpo = nCima - coroa;
  const hCorpo = nCorpo * pe;
  c.add({ forma: 'caixa', x: 0, z: tz, w: tw, d: td, y0: pod.h, h: hCorpo + par, mat: matEnv, lado: matLado, fundo: matEnv, topo: laje(c), parapeito: par, lod1: true, principal: true, soLod1: true });
  c.add({ forma: 'caixa', x: 0, z: tz - prof / 2, w: tw, d: td - prof, y0: pod.h, h: hCorpo + par, mat: c.m(F.JANELA, corP, c.cor('caixilho'), { v: matEnv.v, vr: 7, a: pe }), lado: matLado, fundo: matEnv, topo: laje(c), parapeito: par });
  // varandas em duas colunas nas pontas da frente (leve: sem guarda-corpo das pontas); no fundo, desenhadas
  const bays = Math.max(2, Math.round(tw / matEnv.v));
  const bw = (tw / bays) * (bays >= 5 ? 2 : 1);
  const guarda = vr === 0 ? c.m(F.VIDRO, '#9fb0b4') : c.m(F.LISO, corP);
  const lajeV = c.m(F.CONCRETO, '#d7d2c7');
  for (let a = 0; a < nCorpo; a++) {
    for (const lx of [-tw / 2 + bw / 2 + 0.1, tw / 2 - bw / 2 - 0.1]) {
      c.add({ forma: 'varanda', x: lx, z: tz + td / 2 - prof / 2, w: bw - 0.2, d: prof, y0: pod.h + a * pe, esp: 0.18, gc: 1.05, mat: lajeV, guarda, semPontas: true });
    }
  }
  // coroamento: os últimos andares recuados, com a casa de máquinas escondida atrás de um pano
  const cw = tw * r.entre(0.6, 0.8);
  const cd = td * r.entre(0.6, 0.8);
  const yC = pod.h + hCorpo;
  c.add({ forma: 'caixa', x: 0, z: tz, w: cw, d: cd, y0: yC, h: coroa * pe + par + 2.5, mat: c.m(F.CORTINA, corP, c.cor('caixilho'), { v: 2.8, a: pe }), topo: laje(c), parapeito: par + 2.5, lod1: true });
  lazerNoPodio(c, pod, tz, td);
  equipar(c, -tw / 2 + 1, tz - td / 2 + prof, tw / 2 - 1, tz + td / 2 - prof, yC, { max: 3 });
  muro(c, { h: 2.2, portoes: [[0, 1.6], [W / 2 - 3, 4]], mureta: true });
  pisoLote(c, pod.z + pod.d / 2, D / 2 - 0.2, c.m(F.PISO, c.cor('piso')));
}

function torreVidro(c) {
  const { W, D, r } = c;
  const recuo = r.entre(...c.par.recuo);
  const pe = c.par.pe;
  const pod = podio(c, { andares: 2, tr: TERREO.PORTARIA_ALTA, recuo, mat: c.m(F.PEDRA, c.cor('pedra'), c.cor('caixilho'), { tr: TERREO.PORTARIA_ALTA, v: 4, a: 3.4 }) });
  const tw = clamp(W - r.entre(10, 14), 18, 26);
  const td = clamp(D - recuo - r.entre(14, 18), 16, 24);
  const tz = pod.z - pod.d / 2 + td / 2 + r.entre(4, 6);
  const nCima = Math.max(20, c.andares - 2);
  const coroa = 2;
  const hCorpo = (nCima - coroa) * pe;
  const aletas = r.chance(0.5);
  const forma = r.chance(0.45) ? 'chanfro' : 'caixa';
  const corVidro = c.cor('caixilho');
  const pele = c.m(aletas ? F.BRISE_V : F.CORTINA, r.item(MONTANTE), aletas ? '#b8b2a6' : corVidro, { v: r.entre(2.8, 3.6), vr: r.int(0, 3), a: pe, vd: c.r.f() });
  c.add({ forma, x: 0, z: tz, w: tw, d: td, y0: pod.h, h: hCorpo + 0.8, mat: pele, topo: laje(c), lod1: true, principal: true, chanfro: Math.min(tw, td) * 0.16 });
  // coroa: dois andares recuados com terraço, heliponto no alto
  const cw = tw * 0.72;
  const cd = td * 0.72;
  const yC = pod.h + hCorpo + 0.8;
  c.add({ forma, x: 0, z: tz, w: cw, d: cd, y0: yC, h: coroa * pe + 1.2, mat: c.m(F.CORTINA, pele.c1, corVidro, { v: 2.6, a: pe, vd: pele.vd }), topo: laje(c), parapeito: 1.2, lod1: true, chanfro: Math.min(cw, cd) * 0.16 });
  const yH = yC + coroa * pe + 1.2;
  const dh = Math.min(cw, cd, 17);
  c.add({ forma: 'cilindro', x: 0, z: tz, w: dh, d: dh, y0: yH + 1.2, h: 0.5, mat: c.m(F.METAL, '#6f7477'), topo: c.m(F.CONCRETO, '#5a5e60'), base: metal(c), lod1: true });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.add({ forma: 'coluna', x: sx * dh * 0.28, z: tz + sz * dh * 0.28, w: 0.5, d: 0.5, y0: yH, h: 1.2, mat: metal(c) });
  lazerNoPodio(c, pod, tz, td);
  equipar(c, -tw / 2 + 1.2, tz - td / 2 + 1.2, tw / 2 - 1.2, tz + td / 2 - 1.2, yC, { max: 2 });
  muro(c, { h: 2.2, portoes: [[0, 2], [W / 2 - 3.2, 4.2]], mureta: true });
  pisoLote(c, pod.z + pod.d / 2, D / 2 - 0.2, c.m(F.PEDRA, c.cor('pedra')));
}

// ------------------------------------------------------------------------------------------------ comércio

function lojaToldo(c) {
  const { W, D, r } = c;
  if (W >= 30) return mercado(c);
  const recuo = r.entre(0, 0.6);
  const fundo = D > 10 ? r.entre(0, 4) : 0;
  const bd = clamp(D - recuo - fundo, 6, D - 0.4);
  const bz = D / 2 - recuo - bd / 2;
  const n = c.andares;
  const tH = TERREO_ALTURA[TERREO.VITRINE];
  const pe = c.par.pe;
  const h = tH + (n - 1) * pe;
  const par = r.entre(0.8, 2.0); // platibanda alta (a "fachada falsa" do comércio de rua)
  const corP = c.parede(['rebocoCor', 'rebocoClaro', 'pastilha']);
  const tipo = n > 1 ? c.fachada(['janela', 'fita', 'pastilha']) : 'janela';
  const frente = c.m(MAT_FACHADA[tipo] ?? F.JANELA, tipo === 'pastilha' ? c.cor('pastilha') : corP, c.cor('caixilho'), { tr: TERREO.VITRINE, v: clamp(W / Math.max(1, Math.round(W / r.entre(3.2, 4.2))), 2.6, 5), vr: r.int(0, 5), a: pe });
  const lado = c.m(F.LISO, corP);
  c.add({ forma: 'caixa', x: 0, z: bz, w: W - 2 * FOLGA, d: bd, y0: 0, h: h + par, chao: true, mat: frente, lado, fundo: lado, topo: laje(c), parapeito: par, lod1: true, principal: true });
  const zf = bz + bd / 2;
  // toldo de lona ou marquise de concreto sobre a calçada
  const t = r.f();
  if (t < 0.55) c.add({ forma: 'inclinado', x: 0, z: zf + 0.8, w: (W - 0.6) * r.entre(0.7, 1), d: 1.6, y0: 2.9, h: 0.5, pontas: true, mat: c.m(F.TOLDO, c.cor('toldo')), sobra: true });
  else if (t < 0.85) c.add({ forma: 'caixa', x: 0, z: zf + 0.75, w: W - 0.6, d: 1.5, y0: 3.5, h: 0.2, mat: c.m(F.CONCRETO, '#cfc9bd'), topo: laje(c), base: c.m(F.LISO, '#d9d4c9'), sobra: true });
  // letreiro de bandeira na quina (aceso à noite)
  if (r.chance(0.3)) {
    const s = r.chance(0.5) ? 1 : -1;
    c.add({ forma: 'placa', x: s * (W / 2 - 0.9), z: zf + 0.7, w: 1.2, d: 0.12, y0: 3.6, h: 1.4, giro: Math.PI / 2, mat: c.m(F.LETREIRO, c.cor('letreiro')), sobra: true });
  }
  // depósito baixo nos fundos
  const topo = h;
  if (fundo > 3 && r.chance(0.5)) c.add({ forma: 'caixa', x: 0, z: -D / 2 + fundo / 2 + 0.2, w: W * 0.6, d: fundo - 0.6, y0: 0, h: 3.2, chao: true, mat: lado, topo: c.m(F.TELHA_METAL, c.cor('telhaMetal')), lod1: true });
  const tw = r.entre(1.8, 2.4);
  c.add({ forma: 'caixa', x: r.entre(-0.3, 0.3) * (W - tw - 1), z: bz - bd * 0.3, w: tw, d: tw, y0: topo, h: r.entre(1.5, 2.6), mat: c.m(F.LISO, corP), topo: c.m(F.LAJE, '#8e9aa0'), lod1: true });
  equipar(c, -W / 2 + 0.8, bz - bd / 2 + 0.6, W / 2 - 0.8, bz + bd / 2 - 0.6, topo, { max: 2 });
  if (recuo > 0.2) pisoLote(c, zf, D / 2 - 0.05, c.m(F.PISO, c.cor('piso')));
}

function mercado(c) {
  const { W, D, r } = c;
  const recuo = r.entre(7, 10);
  const bd = clamp(D - recuo - 2, 12, 26);
  const bz = D / 2 - recuo - bd / 2;
  const h = c.andares > 1 ? 8.5 : r.entre(6, 7);
  const par = 1.2;
  const corP = c.parede(['rebocoClaro', 'concreto']);
  const frente = c.m(F.PAINEL, corP, c.cor('caixilho'), { tr: TERREO.VITRINE_ALTA, v: 4.8, a: h });
  c.add({ forma: 'caixa', x: 0, z: bz, w: W - 2, d: bd, y0: 0, h: h + par, chao: true, mat: frente, lado: c.m(F.GALPAO, c.cor('galpao'), null, { v: 4, a: h }), topo: c.m(F.TELHA_METAL, c.cor('telhaMetal')), parapeito: par, lod1: true, principal: true });
  const zf = bz + bd / 2;
  c.add({ forma: 'caixa', x: 0, z: zf + 1.2, w: W * 0.6, d: 2.4, y0: 4.2, h: 0.3, mat: c.m(F.METAL, '#8e9396'), topo: c.m(F.METAL, '#9ea4a7'), base: c.m(F.LISO, '#d9d4c9'), sobra: true });
  c.add({ forma: 'placa', umLado: true, x: 0, z: zf + 0.05, w: Math.min(12, W * 0.4), d: 0, y0: h - 0.2, h: par + 0.1, mat: c.m(F.LETREIRO, c.cor('letreiro')), sobra: true });
  equipar(c, -W / 2 + 2, bz - bd / 2 + 1, W / 2 - 2, bz + bd / 2 - 1, h, { max: 6 });
  // estacionamento na frente
  c.add({ forma: 'piso', x: 0, z: zf + recuo / 2, w: W - 0.4, d: recuo - 0.4, y0: 0.04, h: 0, mat: c.m(F.PISO, '#5f5d59'), lote: true });
}

function galeriaVitrine(c) {
  const { W, D, r } = c;
  const recuo = r.entre(...(c.par.recuo ?? [0, 2]));
  const bd = clamp(D - recuo - r.entre(1, 3), 6, 40);
  const bz = D / 2 - recuo - bd / 2;
  const tr = W >= 16 ? TERREO.VITRINE_ALTA : TERREO.VITRINE;
  const tH = TERREO_ALTURA[tr];
  const pe = c.par.pe;
  const n = Math.max(2, c.andares);
  const h = tH + (n - 1) * pe;
  const par = r.entre(1.0, 1.6);
  const corP = c.parede(['rebocoClaro', 'concreto', 'pastilha']);
  const frente = c.m(r.chance(0.6) ? F.CORTINA : F.FITA, corP, c.cor('caixilho'), { tr, v: clamp(W / Math.max(1, Math.round(W / 3.6)), 2.8, 5), vr: r.int(0, 3), a: pe });
  const lado = c.m(F.PAINEL, corP, c.cor('caixilho'), { v: 4, a: pe });
  c.add({ forma: 'caixa', x: 0, z: bz, w: W - 2 * FOLGA, d: bd, y0: 0, h: h + par, chao: true, mat: frente, lado, fundo: lado, topo: laje(c), parapeito: par, lod1: true, principal: true });
  const zf = bz + bd / 2;
  c.add({ forma: 'caixa', x: 0, z: zf + 1.1, w: W - 0.8, d: 2.2, y0: tH - 0.4, h: 0.3, mat: c.m(F.CONCRETO, '#d2ccc0'), topo: laje(c), base: c.m(F.LISO, '#dcd7cc'), sobra: true });
  const cm = n >= 3 && W >= 16;
  if (cm) casaDeMaquinas(c, 0, bz - bd * 0.2, Math.min(8, W * 0.4), 5, h, { agua: r.chance(0.5) });
  equipar(c, -W / 2 + 1, bz - bd / 2 + 1, W / 2 - 1, bz + bd / 2 - 1, h, { max: 5, hMax: cm ? 1.25 : par - 0.05 });
  if (recuo > 0.4) pisoLote(c, zf, D / 2 - 0.05, c.m(F.PISO, c.cor('piso')));
}

function usoMisto(c) {
  const { W, D, r } = c;
  const recuo = r.entre(...c.par.recuo);
  const pe = c.par.pe;
  const nPod = r.int(2, 3);
  const tr = TERREO.VITRINE_ALTA;
  const pod = podio(c, { andares: nPod, tr, recuo, mat: c.m(F.CORTINA, c.parede(['concreto', 'rebocoClaro']), c.cor('caixilho'), { tr, v: 3.6, a: 4.2 }) });
  const tw = clamp(W - r.entre(6, 12), 14, 28);
  const td = clamp(pod.d - r.entre(8, 14), 12, 20);
  const tz = pod.z - pod.d / 2 + td / 2 + r.entre(2, 5);
  const nCima = Math.max(4, c.andares - nPod);
  const par = r.entre(1.0, 1.5);
  const parede = fachadaPredio(c, ['janela', 'fita', 'painel', 'briseV'], { a: pe });
  c.add({ forma: 'caixa', x: 0, z: tz, w: tw, d: td, y0: pod.h, h: nCima * pe + par, mat: parede, topo: laje(c), parapeito: par, lod1: true, principal: true });
  const zf = pod.z + pod.d / 2;
  c.add({ forma: 'caixa', x: 0, z: zf + 1.2, w: W - 1, d: 2.4, y0: TERREO_ALTURA[tr] - 0.4, h: 0.3, mat: c.m(F.CONCRETO, '#d2ccc0'), topo: laje(c), base: c.m(F.LISO, '#dcd7cc'), sobra: true });
  lazerNoPodio(c, pod, tz, td);
  casaDeMaquinas(c, 0, tz - td * 0.2, Math.min(tw * 0.5, 8), 5, pod.h + nCima * pe);
  if (recuo > 0.5) pisoLote(c, zf, D / 2 - 0.1, c.m(F.PISO, c.cor('piso')));
}

function centroPelePerfurada(c) {
  const { W, D, r } = c;
  const pe = c.par.pe;
  const peleCor = r.chance(0.5) ? c.cor('metal') : c.cor('rebocoClaro');
  if (W < 30 || c.andares <= 4) {
    // loja de bairro com pele de chapa perfurada nos andares de cima
    const recuo = r.entre(0, 1.5);
    const bd = clamp(D - recuo - r.entre(0, 3), 6, D - 0.2);
    const bz = D / 2 - recuo - bd / 2;
    const n = Math.max(2, c.andares);
    const tH = TERREO_ALTURA[TERREO.VITRINE];
    const h = tH + (n - 1) * 3.4;
    const pele = c.m(F.COBOGO, peleCor, null, { tr: TERREO.VITRINE, a: 3.4, v: 3.6, c2: c.cor('letreiro') });
    c.add({ forma: 'caixa', x: 0, z: bz, w: W - 2 * FOLGA, d: bd, y0: 0, h: h + 0.8, chao: true, mat: pele, lado: c.m(F.LISO, '#d5d0c6'), topo: laje(c), parapeito: 0.8, lod1: true, principal: true });
    c.add({ forma: 'caixa', x: 0, z: bz + bd / 2 + 1.1, w: W - 0.6, d: 2.2, y0: tH - 0.4, h: 0.28, mat: c.m(F.METAL, '#8e9396'), topo: metal(c), base: c.m(F.LISO, '#dcd7cc'), sobra: true });
    equipar(c, -W / 2 + 0.8, bz - bd / 2 + 0.6, W / 2 - 0.8, bz + bd / 2 - 0.6, h, { max: 3, hMax: 0.75 });
    return;
  }
  // centro comercial: pódio com pele perfurada e a torre de escritórios de vidro
  const recuo = r.entre(...c.par.recuo);
  const tr = TERREO.VITRINE_ALTA;
  const pod = podio(c, { andares: 3, tr, recuo, mat: c.m(F.COBOGO, peleCor, null, { tr, v: 4, a: 4.2, c2: c.cor('letreiro') }) });
  const tw = clamp(W - r.entre(10, 16), 16, 26);
  const td = clamp(pod.d - r.entre(10, 16), 14, 22);
  const tz = pod.z + r.entre(-2, 2);
  const nCima = Math.max(6, c.andares - 3);
  const forma = r.chance(0.4) ? 'chanfro' : 'caixa';
  c.add({ forma, x: 0, z: tz, w: tw, d: td, y0: pod.h, h: nCima * 3.8 + 1, mat: c.m(F.CORTINA, r.item(MONTANTE), c.cor('caixilho'), { uso: USO.ESC, v: 3, a: 3.8 }), topo: laje(c), parapeito: 1, lod1: true, principal: true, chanfro: Math.min(tw, td) * 0.16 });
  c.add({ forma: 'caixa', x: 0, z: pod.z + pod.d / 2 + 1.3, w: W * 0.7, d: 2.6, y0: 5.2, h: 0.4, mat: c.m(F.METAL, '#8e9396'), topo: metal(c), base: c.m(F.LISO, '#dcd7cc'), sobra: true });
  casaDeMaquinas(c, 0, tz, Math.min(tw * 0.45, 8), Math.min(td * 0.4, 6), pod.h + nCima * 3.8, { agua: false });
  pisoLote(c, pod.z + pod.d / 2, D / 2 - 0.1, c.m(F.PEDRA, c.cor('pedra')));
}

// ------------------------------------------------------------------------------------------------ escritórios

function laminaBrises(c) {
  const { W, D, r } = c;
  const recuo = r.entre(...c.par.recuo);
  const pe = c.par.pe;
  const lw = clamp(W - r.entre(3, 6), 18, 40);
  const ld = clamp(r.entre(12, 16), 10, D - recuo - 4);
  const lz = D / 2 - recuo - ld / 2 - r.entre(0, 3);
  const pil = r.chance(0.5);
  const tr = pil ? 0 : TERREO.PORTARIA_ALTA;
  const y0 = pil ? 4.5 : 0;
  const n = c.andares;
  const par = 1.0;
  const brise = c.m(r.chance(0.7) ? F.BRISE_H : F.BRISE_V, '#cfc9bd', c.parede(['concreto', 'rebocoClaro']), { tr, v: r.entre(3, 4), a: pe, uso: USO.ESC });
  const costas = c.m(r.chance(0.5) ? F.FITA : F.CORTINA, c.parede(['concreto', 'rebocoClaro']), c.cor('caixilho'), { v: 3, a: pe, uso: USO.ESC });
  const empena = c.m(r.chance(0.5) ? F.PEDRA : F.LISO, r.chance(0.5) ? c.cor('pedra') : c.cor('concreto'));
  const h = (pil ? n - 1 : n) * pe + par + (pil ? 0 : TERREO_ALTURA[TERREO.PORTARIA_ALTA] - pe);
  c.add({ forma: 'caixa', x: 0, z: lz, w: lw, d: ld, y0, h, chao: !pil, mat: brise, fundo: costas, lado: empena, topo: laje(c), parapeito: par, base: pil ? concreto(c) : null, aoBase: 0.45, lod1: true, principal: true });
  if (pil) {
    c.add({ forma: 'caixa', x: 0, z: lz - ld * 0.1, w: lw * 0.3, d: ld * 0.5, y0: 0, h: 4.5, chao: true, mat: c.m(F.CORTINA, '#d9d4c9', '#3a3c3e', { v: 2.4, a: 4.5, uso: USO.ESC }), topo: laje(c), sem: 16, lod1: true });
    const nx = Math.max(3, Math.round(lw / 7));
    for (let i = 0; i < nx; i++) for (const s of [-1, 1]) c.add({ forma: 'coluna', redonda: true, x: -lw / 2 + 1 + ((lw - 2) * i) / (nx - 1), z: lz + s * (ld / 2 - 1.2), w: 0.8, d: 0.8, y0: -ENTERRA, h: 4.5 + ENTERRA, mat: c.m(F.CONCRETO, '#cbc5b9') });
  }
  casaDeMaquinas(c, r.entre(-0.3, 0.3) * lw, lz, r.entre(6, 9), Math.min(ld * 0.5, 6), y0 + h - par, { agua: true });
  equipar(c, -lw / 2 + 1, lz - ld / 2 + 1, lw / 2 - 1, lz + ld / 2 - 1, y0 + h - par, { max: 5 });
  pisoLote(c, lz + ld / 2, D / 2 - 0.2, c.m(F.PEDRA, c.cor('pedra')));
}

function peleVidro(c) {
  const { W, D, r } = c;
  const recuo = r.entre(...c.par.recuo);
  const pe = c.par.pe;
  const tr = TERREO.PORTARIA_ALTA;
  const tw = clamp(W - r.entre(6, 12), 18, 30);
  const td = clamp(D - recuo - r.entre(6, 12), 16, 26);
  const tz = D / 2 - recuo - td / 2;
  const n = c.andares;
  const par = 1.0;
  const h = TERREO_ALTURA[tr] + (n - 1) * pe;
  const coroaA = r.int(1, 2);
  const pele = c.m(F.CORTINA, r.item(MONTANTE), c.cor('caixilho'), { tr, v: r.entre(2.6, 3.4), vr: r.int(0, 3), a: pe, uso: USO.ESC });
  c.add({ forma: 'caixa', x: 0, z: tz, w: tw, d: td, y0: 0, h: h - coroaA * pe + par, chao: true, mat: pele, topo: laje(c), parapeito: par, lod1: true, principal: true });
  // coroa recuada e a tela que esconde as máquinas
  const cw = tw * r.entre(0.6, 0.8);
  const cd = td * r.entre(0.6, 0.8);
  const yC = h - coroaA * pe + par;
  c.add({ forma: 'caixa', x: 0, z: tz, w: cw, d: cd, y0: yC - par, h: coroaA * pe + 3, mat: c.m(F.CORTINA, pele.c1, pele.c2, { v: 2.8, a: pe, uso: USO.ESC, vd: pele.vd }), topo: laje(c), parapeito: 3, lod1: true });
  c.add({ forma: 'caixa', x: 0, z: tz + td / 2 + 1.2, w: tw * 0.5, d: 2.4, y0: TERREO_ALTURA[tr] - 0.5, h: 0.35, mat: c.m(F.METAL, '#6f7477'), topo: metal(c), base: c.m(F.LISO, '#dcd7cc'), sobra: true });
  equipar(c, -tw / 2 + 1, tz - td / 2 + 1, tw / 2 - 1, tz + td / 2 - 1, yC - par, { max: 3 });
  pisoLote(c, tz + td / 2, D / 2 - 0.2, c.m(F.PEDRA, c.cor('pedra')));
}

function torreControleSolar(c) {
  const { W, D, r } = c;
  const recuo = r.entre(...c.par.recuo);
  const pe = c.par.pe;
  const tr = TERREO.PORTARIA_ALTA;
  const pod = podio(c, { andares: 2, tr, recuo, mat: c.m(F.PEDRA, c.cor('pedra'), c.cor('caixilho'), { tr, v: 4, a: 4, uso: USO.ESC }), lazer: false });
  const q = r.f();
  const forma = q < 0.45 ? 'chanfro' : q < 0.7 ? 'cilindro' : 'caixa';
  const tw = clamp(W - r.entre(8, 14), 20, 30);
  const td = forma === 'cilindro' ? tw : clamp(D - recuo - r.entre(10, 16), 18, 28);
  const tz = pod.z + r.entre(-2, 1);
  const n = Math.max(20, c.andares - 2);
  const pele = c.m(r.chance(0.35) ? F.BRISE_V : F.CORTINA, r.item(MONTANTE), r.item(['#5c4b3b', '#3b3d3f', '#8a8d8e', '#cfd1cf']), { v: r.entre(2.4, 3.2), vr: r.int(0, 3), a: pe, uso: USO.ESC, vd: r.f() });
  const hC = (n - 2) * pe;
  c.add({ forma, x: 0, z: tz, w: tw, d: td, y0: pod.h, h: hC, mat: pele, topo: laje(c), lod1: true, principal: true, chanfro: Math.min(tw, td) * 0.18 });
  // recuo e coroamento iluminado
  const k = r.entre(0.78, 0.88);
  c.add({ forma, x: 0, z: tz, w: tw * k, d: td * k, y0: pod.h + hC, h: 2 * pe, mat: { ...pele, _p: null }, topo: laje(c), lod1: true, chanfro: Math.min(tw, td) * k * 0.18 });
  const yCoroa = pod.h + hC + 2 * pe;
  const hCoroa = r.entre(3, 4.5);
  c.add({ forma, x: 0, z: tz, w: tw * k * 0.94, d: td * k * 0.94, y0: yCoroa, h: hCoroa, mat: c.m(F.LETREIRO, '#c9c5bb'), topo: laje(c), lod1: true, chanfro: Math.min(tw, td) * k * 0.94 * 0.18 });
  // máquinas no topo, atrás de uma tela de brise
  const mw = Math.min(tw, td) * k * 0.4;
  c.add({ forma: 'caixa', x: 0, z: tz, w: mw, d: mw * 0.8, y0: yCoroa + hCoroa, h: r.entre(2.5, 3.5), mat: c.m(F.BRISE_V, '#8e9396', '#9ea4a7', { a: 3, v: 1.2 }), topo: laje(c), lod1: true });
  equipar(c, -tw * k * 0.3, tz - td * k * 0.3, tw * k * 0.3, tz + td * k * 0.3, yCoroa + hCoroa, { max: 3 });
  pisoLote(c, pod.z + pod.d / 2, D / 2 - 0.2, c.m(F.PEDRA, c.cor('pedra')));
}

// ------------------------------------------------------------------------------------------------ indústria

function galpao(c, { silos = false, limpa = false } = {}) {
  const { W, D, r } = c;
  const recuo = r.entre(...c.par.recuo);
  const sd = silos ? r.entre(5, 7) : 0;
  const gw = W - r.entre(3, 6) - (silos ? sd + 1.5 : 0);
  const gx = silos ? -(sd + 1.5) / 2 : 0;
  const od = r.entre(5, 7);
  const gd = clamp(D - recuo - od - r.entre(2, 4), 10, 44);
  const gz = D / 2 - recuo - od - gd / 2;
  const hW = c.andares * (c.par.pe ?? 8) * r.entre(0.85, 1.05);
  const corG = c.parede(limpa ? ['rebocoClaro'] : ['concreto']);
  const chapa = c.cor('galpao');
  const parede = limpa ? c.m(F.PAINEL, '#d6d4ce', c.cor('caixilho'), { v: 4, a: hW, uso: USO.IND, tr: TERREO.DOCA }) : c.m(F.GALPAO, chapa, c.cor('caixilho'), { v: 4, a: hW, uso: USO.IND, tr: TERREO.DOCA });
  const lado = limpa ? c.m(F.FITA, '#d6d4ce', c.cor('caixilho'), { v: 4, a: hW / Math.max(1, Math.round(hW / 4.5)), uso: USO.IND }) : c.m(F.GALPAO, chapa, null, { v: 4, a: hW, uso: USO.IND });
  const telhaM = c.m(F.TELHA_METAL, c.cor('telhaMetal'));
  const tipoTelhado = limpa ? 'laje' : r.chance(0.5) ? 'shed' : 'arco';
  const subida = tipoTelhado === 'laje' ? 1.2 : tipoTelhado === 'shed' ? r.entre(2.2, 3) : Math.min(gw * 0.12, 5);
  // envelope do LOD1 (paredes e telhado) e, no LOD0, as paredes com o telhado de verdade
  c.add({ forma: 'caixa', x: gx, z: gz, w: gw, d: gd, y0: 0, h: hW + subida, chao: true, mat: parede, lado, fundo: lado, topo: tipoTelhado === 'laje' ? laje(c) : telhaM, parapeito: tipoTelhado === 'laje' ? 1.2 : 0, lod1: true, principal: true, soLod1: tipoTelhado !== 'laje' });
  if (tipoTelhado === 'shed') {
    c.add({ forma: 'caixa', x: gx, z: gz, w: gw, d: gd, y0: 0, h: hW, chao: true, mat: parede, lado, fundo: lado, topo: telhaM, sem: 16 });
    c.add({ forma: 'shed', x: gx, z: gz, w: gw, d: gd, y0: hW, h: subida, dentes: Math.max(2, Math.round(gd / 7)), mat: lado, topo: telhaM, vidro: c.m(F.CORTINA, '#c9c6bf', '#8a8d8e', { v: 1.5, a: subida, uso: USO.IND }) });
  } else if (tipoTelhado === 'arco') {
    c.add({ forma: 'caixa', x: gx, z: gz, w: gw, d: gd, y0: 0, h: hW, chao: true, mat: parede, lado, fundo: lado, topo: telhaM, sem: 16 });
    c.add({ forma: 'arco', x: gx, z: gz, w: gd, d: gw, y0: hW, h: subida, giro: Math.PI / 2, mat: lado, topo: telhaM });
  } else {
    equipar(c, gx - gw / 2 + 2, gz - gd / 2 + 2, gx + gw / 2 - 2, gz + gd / 2 - 2, hW, { max: 4, solar: 1 });
  }
  // escritório na quina da frente, diante do galpão; o resto da frente é o pátio de carga
  const ow = Math.min(gw * 0.4, r.entre(8, 12));
  const ox = gx + (gw / 2 - ow / 2) * (r.chance(0.5) ? 1 : -1);
  const oa = limpa ? 2 : r.int(1, 2);
  c.add({ forma: 'caixa', x: ox, z: gz + gd / 2 + od / 2, w: ow, d: od, y0: 0, h: oa * 3.4 + 0.8, chao: true, mat: c.m(limpa ? F.CORTINA : F.FITA, limpa ? '#d6d4ce' : corG, c.cor('caixilho'), { v: 3, a: 3.4, uso: USO.ESC }), topo: laje(c), parapeito: 0.8, lod1: true });
  if (silos) {
    const ns = r.int(2, 4);
    const sh = hW + r.entre(6, 12);
    const x = W / 2 - sd / 2 - 0.4;
    for (let k = 0; k < ns; k++) {
      const z = gz - gd / 2 + sd / 2 + k * (sd + 0.6);
      if (z + sd / 2 > gz + gd / 2) break;
      const ms = c.m(F.METAL, '#b9bcbb');
      c.add({ forma: 'cilindro', x, z, w: sd, d: sd, y0: 0, h: sh, chao: true, mat: ms, topo: metal(c) });
      c.add({ forma: 'cone', x, z, w: sd, d: sd, y0: sh, h: sd * 0.3, mat: c.m(F.METAL, '#a6aaa9') });
      c.add({ forma: 'cilindro', x, z, w: sd, d: sd, y0: 0, h: sh + sd * 0.3, chao: true, mat: ms, topo: metal(c), lod1: true, soLod1: true });
    }
  }
  const zp = gz + gd / 2;
  c.add({ forma: 'piso', x: 0, z: (zp + D / 2) / 2, w: W - 0.4, d: D / 2 - zp - 0.3, y0: 0.04, h: 0, mat: c.m(F.PISO, '#8a867e'), lote: true });
  muro(c, { h: 2.2, portoes: [[-ox * 0.5, 6], [ox, 1.2]], mureta: true });
}

// ------------------------------------------------------------------------------------------------ plano

const GERADORES = {
  casa, sobradoGeminado, casaAltoPadrao,
  pilotis, varandas: (c) => varandas(c), varandaGourmet: (c) => varandas(c, { gourmet: true }),
  torrePodio, torreVarandas, torreVidro,
  lojaToldo, galeriaVitrine, usoMisto, centroPelePerfurada,
  laminaBrises, peleVidro, torreControleSolar,
  galpaoShed: (c) => galpao(c), galpaoSilos: (c) => galpao(c, { silos: true }), fabricaLimpa: (c) => galpao(c, { limpa: true }),
};

/** Caixa [x0, y0, z0, x1, y1, z1] de peças (espaço do lote; a caixa de cada peça girada pelo giro). */
export function caixaDasPecas(pecas, filtro = () => true) {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const P of pecas) {
    if (!filtro(P)) continue;
    const c = Math.abs(Math.cos(P.giro ?? 0));
    const s = Math.abs(Math.sin(P.giro ?? 0));
    const hw = (P.w * c + (P.d ?? 0) * s) / 2;
    const hd = (P.w * s + (P.d ?? 0) * c) / 2;
    b[0] = Math.min(b[0], P.x - hw);
    b[3] = Math.max(b[3], P.x + hw);
    b[2] = Math.min(b[2], P.z - hd);
    b[5] = Math.max(b[5], P.z + hd);
    b[1] = Math.min(b[1], P.y0);
    b[4] = Math.max(b[4], P.y0 + (P.h ?? 0));
  }
  return b;
}

/**
 * Plano de um prédio da cidade.
 * @param {{ w: number, d: number, modelo: number | string, nivel?: number, estilo?: number, semente?: number,
 *           cor?: number, abandonado?: boolean }} e  w, d: frente e fundo do lote em metros (predios.w e predios.d)
 * @returns {{ pecas: object[], caixa: number[], alturaTopo: number, tipologia: string, andares: number }}
 * @example planoPredio({ w: 16, d: 24, modelo: 'casa', nivel: 1, estilo: 2, semente: 7 })
 */
export function planoPredio(e) {
  const m = typeof e.modelo === 'number' ? PREDIOS[PREDIOS_ORDEM[e.modelo]] : PREDIOS[e.modelo];
  const nivel = clamp(e.nivel ?? 1, 1, 5);
  if (!m) {
    // modelo desconhecido: um bloco simples de reboco, para nunca faltar prédio
    const c = new Ctx({ ...e, nivel }, { zona: 'resBaixa', niveis: [] }, { tipologia: 'casa', andares: [1, 1] });
    c.add({ forma: 'caixa', x: 0, z: 0, w: e.w - 1, d: e.d - 1, y0: 0, h: 4, chao: true, mat: c.m(F.LISO, '#b8b2a6'), topo: laje(c), lod1: true, principal: true });
    return finalizar(c);
  }
  const nv = m.niveis[nivel - 1];
  const c = new Ctx({ ...e, nivel }, m, nv);
  (GERADORES[nv.tipologia] ?? casa)(c);
  return finalizar(c);
}

function finalizar(c) {
  for (const P of c.pecas) {
    if (P.chao) {
      P.y0 -= ENTERRA;
      P.h += ENTERRA;
      P.vBase = -ENTERRA;
      P.ent = true;
    }
  }
  const predio = (P) => !P.lote && !P.sobra;
  const caixa = caixaDasPecas(c.pecas, predio);
  return { pecas: c.pecas, caixa, alturaTopo: caixa[4], tipologia: c.tip, andares: c.andares };
}

/** O plano roda dentro do gerador de setor (fundir.js): este módulo não registra tipo na oficina. */
export function registrar() {}
