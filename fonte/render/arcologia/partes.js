// Partes da sede v3, Park of Future Dreams (D88 a D90): o pódio redondo das torres, os dois anéis (o Horizon Ring em 8
// trechos e o Meridian Ring), a Codex Tower, as torres ovais (Helix Labs e Compass Tower), o lago e as Dream Falls, as
// fontes, o anel de floresta, o parque com as Supertrees e a passarela. Cada peça do plano (data/arcologia-plano.js)
// vira volumes com a fachada no shader (material vidro, tipo por vértice) e acabamentos (material opaco), em
// coordenadas do mundo, assentados no relevo por chao(x, z).
//
// LOD (D66): os anéis e as torres ovais têm a casca (vidro curvo, cobertura, pórticos) em comum e as marquises de cada
// andar em geometria só no LOD0, por setor (g.setor(s) dá as malhas do setor; os 16 trechos de anel, as 2 ovais e o
// parque, com o detalhe das Supertrees); no LOD1 as marquises saem do shader do vidro, que sabe pelo uniforme uLodSetor
// onde já há geometria. As outras peças são iguais nos dois. A casca serve também ao fantasma (fantasma.js) e ao volume
// de sombra (g.sombra).
//
// Referências: Apple Park e McLaren Technology Centre (os anéis de vidro curvo com a marquise branca em cada laje, o pé
// no jardim), as Petronas (o pódio com as torres), Black Diamond e a Biblioteca de Tianjin Binhai (a Codex), a Torre
// Generali de Zaha Hadid (a Helix) e o Simpson Querrey de Chicago (a Compass), Gardens by the Bay (as Supertrees e a
// OCBC Skyway), o Aterro do Flamengo e Copacabana de Burle Marx (o parque), Dubai Fountain (as fontes).
import {
  Malha, acab, vid, vidAnel, VIDRO, PADRAO, LUZ, tampa, caixa, cilindro, torno, hashF, orientar, barra, cascaEfeito,
  CASCATA, andaresLed,
} from './torre.js';
import { PAR, BACIA, AVENIDAS, HORIZON, MERIDIAN, PONTE, QUEDAS_ANGULOS, PASSEIO_DO_PARQUE, raioDaMargem } from '../../data/arcologia-plano.js';

import { noArco, difGraus, aoMundo, elipse, faixaEntre, paredeArco, faixaArco, testaArco } from './arcos.js';
import { PECAS_DE_AGUA } from './lagos.js';
import { ponte } from './pontes.js';
export { noArco, difGraus, aoMundo, elipse, faixaEntre };

const RAD = Math.PI / 180;

// acabamentos das partes (albedo real: nada acima de 0,80)
const K = {
  pedra: acab('#c3b79f', { rugo: 0.72, padrao: PADRAO.pedra }),
  pisoClaro: acab('#c4baa8', { rugo: 0.78, padrao: PADRAO.piso }),
  granito: acab('#6a655f', { rugo: 0.6, padrao: PADRAO.pedra }),
  granitoEscuro: acab('#3e3c3a', { rugo: 0.35, padrao: PADRAO.pedra }),
  metalClaro: acab('#b9b8b3', { rugo: 0.45, metal: 1, padrao: PADRAO.metal }),
  // a marquise branca de cada laje (a assinatura da Apple Park): alumínio pintado, fosco. A testa (a borda de 0,5 m) é
  // o traço branco; o topo, deitado, pega menos sol que a fachada no fim da tarde e fica um tom abaixo; à noite as duas
  // escurecem (o padrão marquise) e o forro pega a luz das salas (a classe de luz marquise)
  marquise: acab('#e4e2dc', { rugo: 0.55, padrao: PADRAO.marquise }),
  testa: acab('#ebe9e3', { rugo: 0.5, padrao: PADRAO.marquise }),
  marquiseTopo: acab('#aaa69e', { rugo: 0.6, padrao: PADRAO.marquise }),
  forro: acab('#d8d4ca', { rugo: 0.6, luz: LUZ.marquise }),
  forroAceso: acab('#d6cdbd', { rugo: 0.7, luz: LUZ.forro }),
  // painel solar de vidro escuro sobre a moldura clara: reflete o céu, de cima lê cinza-azulado (a cobertura da Apple
  // Park)
  solar: acab('#3b4450', { rugo: 0.3, metal: 0.5, padrao: PADRAO.solar }),
  telhadoVerde: acab('#435031', { rugo: 0.95, padrao: PADRAO.grama }),
  pista: acab('#a05a42', { rugo: 0.9, padrao: PADRAO.pista }),
  // quadra de piso rígido azul (a do US Open), com o entorno mais escuro do padrão
  quadra: acab('#3d6f8e', { rugo: 0.7, padrao: PADRAO.quadra }),
  deck: acab('#9c8064', { rugo: 0.8 }),
  piscina: acab('#2b7f93', { rugo: 0.05, metal: 0.2, luz: LUZ.piscina, padrao: PADRAO.agua }),
  aguaRasa: acab('#24363a', { rugo: 0.05, metal: 0.2, padrao: PADRAO.agua }),
  jardim: acab('#3d4a2c', { rugo: 0.9, padrao: PADRAO.folha }),
  grama: acab('#5b6a3a', { rugo: 0.95, padrao: PADRAO.grama }),
  gramaEscura: acab('#46532f', { rugo: 0.95, padrao: PADRAO.grama }),
  led: acab('#e6dfd2', { rugo: 0.3, metal: 0.3, luz: LUZ.led }),
  livros: acab('#6b4a32', { rugo: 0.85, luz: LUZ.livros, padrao: PADRAO.livros }),
  bronze: acab('#cbbb9d', { rugo: 0.45, metal: 0.8, padrao: PADRAO.metal }),
  obstaculo: acab('#7a1a14', { rugo: 0.4, luz: LUZ.obstaculo }),
  // o pé dos anéis: a canaleta de pedra escura colada no vidro (mais escura junto dele: a oclusão do pé), o meio-fio de
  // granito do canteiro, a terra e a sebe (a folhagem), e o passeio de pedra quente
  canaletaPe: acab('#2c2b28', { rugo: 0.8, padrao: PADRAO.pedra }),
  canaleta: acab('#55524b', { rugo: 0.8, padrao: PADRAO.pedra }),
  meioFio: acab('#7d776e', { rugo: 0.7, padrao: PADRAO.pedra }),
  sebe: acab('#34452a', { rugo: 0.95, padrao: PADRAO.folha }),
  passeio: acab('#958d80', { rugo: 0.8, padrao: PADRAO.piso }),
  // os Hanging Gardens (D97): o passeio do terraço, o canteiro de folhagem e a planta pendente da marquise, em verdes
  // fundos (nada de verde-lima)
  terraco: acab('#9a9285', { rugo: 0.8, padrao: PADRAO.piso }),
  folhagemTerraco: acab('#2c4326', { rugo: 0.95, padrao: PADRAO.folha }),
  pendente: acab('#23381d', { rugo: 0.95, padrao: PADRAO.folha }),
  pendente2: acab('#304a27', { rugo: 0.95, padrao: PADRAO.folha }),
  // o parque (Burle Marx): a pedra portuguesa das praças (o desenho de ondas é do shader), os caminhos de pedra clara
  portuguesa: acab('#808080', { rugo: 0.7, padrao: PADRAO.portuguesa }),
  caminho: acab('#b9ad98', { rugo: 0.8, padrao: PADRAO.piso }),
  bordaEspelho: acab('#9e968a', { rugo: 0.6, padrao: PADRAO.pedra }),
  // Supertrees (Gardens by the Bay): o tronco é jardim vertical atrás da treliça de aço em losangos, a copa é a malha
  // de aço em funil com as jardineiras; as barras de aço cor de ferrugem; tudo aceso à noite
  tronco: acab('#4a5a30', { rugo: 0.9, padrao: PADRAO.troncoVivo, luz: LUZ.arvoreLuz }),
  copa: acab('#6e4a35', { rugo: 0.6, metal: 0.35, luz: LUZ.arvoreLuz, padrao: PADRAO.malha }),
  trelica: acab('#7a5c44', { rugo: 0.6, metal: 0.35, luz: LUZ.arvoreLuz, padrao: PADRAO.metal }),
};

/**
 * Desloca um polígono (pares, orientação positiva) d metros para fora (d < 0 para dentro), vértice a vértice pela
 * bissetriz das normais das arestas vizinhas (esquina limitada). Mantém o número de pontos.
 */
export function deslocar(poly, d) {
  const P = orientar(poly);
  const n = P.length / 2;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i + n - 1) % n;
    const b = (i + 1) % n;
    const nrm = (x0, z0, x1, z1) => {
      const l = Math.hypot(x1 - x0, z1 - z0) || 1;
      return [(z1 - z0) / l, -(x1 - x0) / l];
    };
    const n0 = nrm(P[2 * a], P[2 * a + 1], P[2 * i], P[2 * i + 1]);
    const n1 = nrm(P[2 * i], P[2 * i + 1], P[2 * b], P[2 * b + 1]);
    let mx = n0[0] + n1[0];
    let mz = n0[1] + n1[1];
    const ml = Math.hypot(mx, mz) || 1;
    mx /= ml;
    mz /= ml;
    const cosm = Math.max(0.35, mx * n1[0] + mz * n1[1]);
    out.push(P[2 * i] + (mx * d) / cosm, P[2 * i + 1] + (mz * d) / cosm);
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ arcos

/**
 * Ângulos (graus) de um arco de raio r de `de` a `ate` a cada ~passo graus, com as bordas dos portais somadas: cada
 * portal é uma passagem reta de largura vao no eixo do ângulo q (os lados dela são paralelos ao eixo, não radiais). Os
 * `extras` entram também (as bordas das janelas das quedas).
 */
function angulosDoArco(r, de, ate, passo, portais, vao, extras = []) {
  const meio = Math.asin(Math.min(1, vao / 2 / r)) / RAD;
  const n = Math.max(1, Math.ceil((ate - de) / passo));
  const A = [];
  for (let i = 0; i <= n; i++) A.push(de + ((ate - de) * i) / n);
  for (const q of portais) {
    for (const s of [-1, 1]) {
      // o lado do portal na volta deste arco (o portal em 0 grau também é o de 360)
      for (const v of [-360, 0, 360]) {
        const a = q + v + s * meio;
        if (a > de + 1e-6 && a < ate - 1e-6) A.push(a);
      }
    }
  }
  // ângulos que o arco tem de ter (as bordas das janelas das Dream Falls), com a volta de 360 graus
  for (const e of extras) for (const v of [-360, 0, 360]) if (e + v > de + 1e-6 && e + v < ate - 1e-6) A.push(e + v);
  A.sort((x, y) => x - y);
  const out = [];
  for (const a of A) if (!out.length || a - out[out.length - 1] > 0.01) out.push(a);
  return { A: out, meio };
}

const noPortal = (a, portais, meio) => portais.some((q) => Math.abs(difGraus(a, q)) < meio - 1e-6);

// ------------------------------------------------------------------------------------------------ setores do LOD0

/** Setor de um ponto de anel (graus): os 8 trechos do Horizon Ring são 0 a 7, os do Meridian Ring 8 a 15. */
export function setorDoAnel(p, a) {
  if (p.id?.startsWith('horizon.')) return Number(p.id.slice(8)) - 1;
  return 8 + Math.min(7, Math.floor((((a % 360) + 360) % 360) / 45));
}
/** Setor das torres ovais (16 a Helix, 17 a Compass); o 19 nunca tem geometria (o pódio). */
export const SETOR_OVAL = Object.freeze({ helix: 16, compass: 17 });
/** Setor do parque (18): o detalhe das Supertrees de perto (as barras do tronco, as nervuras e o anel do meio). */
export const SETOR_PARQUE = 18;
const SETOR_SEM = 19;

// ------------------------------------------------------------------------------------------------ os anéis

/**
 * Meia altura (m) da faixa de LED de um anel de `andares` andares de pé-direito pe (D93: um terço dos andares, ímpar,
 * andaresLed), a mesma conta do shader do vidro.
 */
export const faixaLed = (pe, andares) => 0.5 * andaresLed(andares) * pe;

/** Faixa horizontal de r0 a r1 com a cor de r0 (k0) indo à de r1 (k1): a oclusão do pé, sem textura nem transparência. */
function faixaArcoGrad(m, cx, cz, r0, r1, a0, a1, y, k0, k1) {
  const [x00, z00] = noArco(cx, cz, r0, a0);
  const [x01, z01] = noArco(cx, cz, r0, a1);
  const [x11, z11] = noArco(cx, cz, r1, a1);
  const [x10, z10] = noArco(cx, cz, r1, a0);
  const i0 = m.v(x00, y, z00, 0, 1, 0, x00, z00, k0);
  const i1 = m.v(x01, y, z01, 0, 1, 0, x01, z01, k0);
  const i2 = m.v(x11, y, z11, 0, 1, 0, x11, z11, k1);
  const i3 = m.v(x10, y, z10, 0, 1, 0, x10, z10, k1);
  m.tri(i0, i1, i2);
  m.tri(i0, i2, i3);
}

/** Medidas do pé dos anéis, em metros a partir do vidro: canaleta, canteiro (com a sebe dentro) e passeio. */
export const PE_ANEL = Object.freeze({ canaleta: 1.4, canteiro: 5.2, sebe0: 1.8, sebe1: 4.8, passeio: 9, alturaCanteiro: 0.45, alturaSebe: 1.35 });

/**
 * O pé de uma face de anel (sinal 1 a de fora, -1 a de dentro), de a0 a a1: a canaleta de pedra escura colada no
 * vidro (mais escura junto dele, a oclusão do pé), o tampo do canteiro com a folhagem e o passeio. Plano (o LOD1); a
 * sebe em volume é do LOD0 (sebeDoPe).
 */
function basePlantada(m, cx, cz, yb, r, sinal, a0, a1) {
  const P = PE_ANEL;
  const em = (d) => r + sinal * d;
  const faixa = (d0, d1, y, k0, k1 = k0) => {
    const [ri, re, ki, ke] = sinal > 0 ? [em(d0), em(d1), k0, k1] : [em(d1), em(d0), k1, k0];
    faixaArcoGrad(m, cx, cz, ri, re, a0, a1, y, ki, ke);
  };
  faixa(-0.4, P.canaleta, yb + 0.14, K.canaletaPe, K.canaleta);
  faixa(P.canaleta, P.canteiro, yb + P.alturaCanteiro, K.sebe);
  faixa(P.canteiro, P.passeio, yb + 0.16, K.passeio);
}

/** A sebe do pé em volume (LOD0): a frente do canteiro em granito e a sebe com o topo e as duas faces. */
function sebeDoPe(m, cx, cz, yb, r, sinal, a0, a1) {
  const P = PE_ANEL;
  const em = (d) => r + sinal * d;
  testaArco(m, cx, cz, em(P.canteiro), a0, a1, yb, yb + P.alturaCanteiro, K.meioFio, sinal);
  testaArco(m, cx, cz, em(P.canaleta), a0, a1, yb, yb + P.alturaCanteiro, K.meioFio, -sinal);
  const [ri, re] = sinal > 0 ? [em(P.sebe0), em(P.sebe1)] : [em(P.sebe1), em(P.sebe0)];
  faixaArco(m, cx, cz, ri, re, a0, a1, yb + P.alturaSebe, K.sebe, true);
  testaArco(m, cx, cz, em(P.sebe1), a0, a1, yb + P.alturaCanteiro, yb + P.alturaSebe, K.sebe, sinal);
  testaArco(m, cx, cz, em(P.sebe0), a0, a1, yb + P.alturaCanteiro, yb + P.alturaSebe, K.sebe, -sinal);
}

/**
 * Trecho de anel (Apple Park, McLaren): vidro curvo do chão ao teto por fora e por dentro (o vidro do eixo a fundo/2),
 * a marquise branca em cada laje (2,4 m de balanço), a faixa de LED de um terço dos andares no terço do meio da altura
 * (D93, no shader), o pé assentado no jardim (a canaleta escura, o canteiro com a sebe e o passeio), a cobertura com a
 * borda branca, os painéis solares e, no Horizon Ring, a pista de 4,6 km no eixo com as quadras e as piscinas; no
 * Meridian, a faixa de jardim no meio. Onde uma avenida cruza, o anel passa por cima num pórtico de vao por pe metros.
 * Hanging Gardens (D97): a face de dentro recua `terracos.recuo` m a cada linha de `terracos.linhas` (a faixa de LED
 * fica num degrau só), e em cada degrau o terraço leva o passeio, o canteiro e a planta pendente da marquise; nas janelas
 * das Dream Falls (`quedas`) a face de dentro segue reta até o cais. A face de fora segue vidro e marquise branca.
 * Casca no LOD1 (g.lod = 1); as marquises e a sebe do pé por setor no LOD0.
 */
function anel(g, p) {
  const { cx, cz, raio, fundo, altura: H, andares, de, ate, portais = [], vao = 40, pe: pePortal = 18, led, teto, terracos, quedas = [] } = p;
  const lod = g.lod ?? 1;
  const peA = H / andares;
  const meio = (led.y0 + led.y1) / 2;
  const nLed = led.andares ?? andaresLed(andares);
  const meiaLed = 0.5 * nLed * peA;
  const rF = raio + fundo / 2;
  const rD = raio - fundo / 2;
  const bal = 2.4;
  const am = (de + ate) / 2;
  const yb = g.chao(...noArco(cx, cz, raio, am));
  const sem = hashF(Math.round(raio), Math.round(de), 13);
  const kv = (a) => vidAnel(VIDRO.anel, sem, meio, peA, setorDoAnel(p, a), nLed);
  const kvIn = (a) => vidAnel(VIDRO.anelDentro, sem, meio, peA, setorDoAnel(p, a), nLed);
  const passoParede = 2;
  const passoTeto = 3;
  // as marquises do LOD0 em trechos de 3 graus: a corda passa no máximo 26 cm para dentro do vidro (no Horizon), que
  // a esconde, e a borda do balanço não mostra quina
  const passoMarquise = 3;
  // Hanging Gardens: os grupos de andares da face de dentro, cada um com o recuo dele (dr) em metros
  const linhas = terracos?.linhas ?? [];
  const recuo = terracos?.recuo ?? 0;
  const grupos = [];
  {
    let y0 = 0;
    linhas.forEach((l, i) => {
      grupos.push({ y0, y1: l * peA, dr: i * recuo });
      y0 = l * peA;
    });
    grupos.push({ y0, y1: H, dr: linhas.length * recuo });
  }
  const rDt = rD + grupos[grupos.length - 1].dr;
  // as janelas das quedas: a face de dentro reta, sem terraço; as bordas entram na lista de ângulos
  const meiaJanela = (q) => q.meia / rD / RAD;
  const janela = (a) => quedas.some((q) => Math.abs(difGraus(a, q.angulo)) < meiaJanela(q));
  const extras = quedas.flatMap((q) => [q.angulo - meiaJanela(q), q.angulo + meiaJanela(q)]);
  // o raio da face de dentro na laje l (a do grupo de baixo dela) e se a laje l é um terraço
  const drDaLaje = (l) => grupos.find((gr) => l * peA > gr.y0 + 1e-6 && l * peA <= gr.y1 + 1e-6)?.dr ?? 0;
  const ehTerraco = (l) => linhas.includes(l);

  if (lod === 0) {
    // marquises em geometria (o LOD0 de cada setor): topo branco, forro e testa, por fora e por dentro, em todas as
    // lajes (as duas da faixa de LED a emolduram); nos pórticos, só acima da passagem; na face de dentro, a laje dos
    // terraços é a do terraço (casca) e cada laje usa o raio do grupo dela
    for (const [r, sinal] of [[rF, 1], [rD, -1]]) {
      const { A, meio: mp } = angulosDoArco(r, de, ate, passoMarquise, portais, vao, sinal < 0 ? extras : []);
      for (let i = 0; i + 1 < A.length; i++) {
        const a0 = A[i];
        const a1 = A[i + 1];
        const mid = (a0 + a1) / 2;
        const alvo = g.setor ? g.setor(setorDoAnel(p, mid)).opaco : g.opaco;
        const portal = noPortal(mid, portais, mp);
        const naJanela = sinal < 0 && janela(mid);
        for (let l = 1; l < andares; l++) {
          const yl = l * peA;
          if (Math.abs(yl - meio) < meiaLed - 0.01) continue;
          if (portal && yl < pePortal + 0.5) continue;
          if (sinal < 0 && !naJanela && ehTerraco(l)) continue;
          const rl = sinal < 0 && !naJanela ? rD + drDaLaje(l) : r;
          const rb = rl + sinal * bal;
          const [ri, re] = sinal > 0 ? [rl, rb] : [rb, rl];
          // uv ao longo do arco: as juntas das chapas (o padrão marquise) radiais, a cada 1,5 m
          faixaArco(alvo, cx, cz, ri, re, a0, a1, yb + yl + 0.25, K.marquiseTopo, true, true);
          faixaArco(alvo, cx, cz, ri, re, a0, a1, yb + yl - 0.25, K.forro, false);
          testaArco(alvo, cx, cz, rb, a0, a1, yb + yl - 0.25, yb + yl + 0.25, K.testa, sinal);
        }
      }
      // a sebe do pé em volume (o canteiro elevado com o meio-fio e a folhagem): de perto o anel assenta no jardim; na
      // face de dentro do Horizon Ring é o cais do Halo Lake, e nas janelas das quedas o cais de pedra
      if (sinal < 0 && p.peDeDentro === 'cais') continue;
      const pp = angulosDoArco(r, de, ate, passoParede, portais, vao, sinal < 0 ? extras : []);
      for (let i = 0; i + 1 < pp.A.length; i++) {
        const a0 = pp.A[i];
        const a1 = pp.A[i + 1];
        if (noPortal((a0 + a1) / 2, portais, pp.meio + 1.2)) continue;
        if (sinal < 0 && janela((a0 + a1) / 2)) continue;
        const alvo = g.setor ? g.setor(setorDoAnel(p, (a0 + a1) / 2)).opaco : g.opaco;
        sebeDoPe(alvo, cx, cz, yb, r, sinal, a0, a1);
      }
    }
    return;
  }

  if (g.sombra) {
    // volume fechado: as duas paredes e o teto, em trechos de 4 graus
    const n = Math.max(1, Math.ceil((ate - de) / 4));
    const rDs = rD + (rDt - rD) / 2;
    for (let i = 0; i < n; i++) {
      const a0 = de + ((ate - de) * i) / n;
      const a1 = de + ((ate - de) * (i + 1)) / n;
      paredeArco(g.opaco, cx, cz, yb, rF, a0, a1, 0, H, K.marquise, 1);
      paredeArco(g.opaco, cx, cz, yb, rDs, a0, a1, 0, H, K.marquise, -1);
      faixaArco(g.opaco, cx, cz, rDs, rF, a0, a1, yb + H, K.marquise, true);
    }
    return;
  }

  const yTeto = H - 1.0; // o forro da cobertura (a laje de 1 m com a borda branca)
  // vidro curvo das duas faces; nos pórticos, só acima da passagem. No fantasma, só a face de fora: o holograma é
  // transparente e de dois lados, e a de dentro dobrava a sobreposição de pixels de um anel de 1,5 km na vista aberta
  {
    const { A, meio: mp } = angulosDoArco(rF, de, ate, passoParede, portais, vao);
    for (let i = 0; i + 1 < A.length; i++) {
      const a0 = A[i];
      const a1 = A[i + 1];
      const portal = noPortal((a0 + a1) / 2, portais, mp);
      paredeArco(g.vidro, cx, cz, yb, rF, a0, a1, portal ? pePortal : 0, yTeto, kv((a0 + a1) / 2), 1);
      if (g.fantasma) continue;
      // o pé da face de fora assentado no jardim (a Apple Park e a McLaren), nunca a faixa clara de maquete: a canaleta
      // escura colada no vidro, o canteiro e o passeio, fora das passagens
      if (!portal && !noPortal((a0 + a1) / 2, portais, mp + 1.2)) basePlantada(g.opaco, cx, cz, yb, rF, 1, a0, a1);
    }
  }
  if (!g.fantasma) {
    // a face de dentro, em degraus (os Hanging Gardens); passo de 3 graus nos degraus (a normal radial por vértice lê redondo)
    const { A, meio: mp } = angulosDoArco(rD, de, ate, linhas.length ? 3 : passoParede, portais, vao, extras);
    for (let i = 0; i + 1 < A.length; i++) {
      const a0 = A[i];
      const a1 = A[i + 1];
      const mid = (a0 + a1) / 2;
      const portal = noPortal(mid, portais, mp);
      const naJanela = janela(mid);
      if (naJanela || !linhas.length) paredeArco(g.vidro, cx, cz, yb, rD, a0, a1, portal ? pePortal : 0, yTeto, kvIn(mid), -1);
      else {
        for (const gr of grupos) {
          const y0 = Math.max(gr.y0 > 0 ? gr.y0 + 0.25 : 0, portal ? pePortal : 0);
          const y1 = gr.y1 >= H ? yTeto : gr.y1 - 0.25;
          if (y1 - y0 > 0.05) paredeArco(g.vidro, cx, cz, yb, rD + gr.dr, a0, a1, y0, y1, kvIn(mid), -1);
        }
      }
      // o pé da face de dentro: o cais do Halo Lake (Horizon), a pedra das enseadas (nas janelas) ou o jardim
      if (portal || noPortal(mid, portais, mp + 1.2)) continue;
      if (naJanela) faixaArco(g.opaco, cx, cz, rD - 4.5, rD, a0, a1, yb + 0.16, K.granito, true);
      else if (p.peDeDentro === 'cais') faixaArco(g.opaco, cx, cz, rD - p.cais, rD, a0, a1, yb + 0.16, K.passeio, true);
      else basePlantada(g.opaco, cx, cz, yb, rD, -1, a0, a1);
    }
    // os terraços: o passeio, o canteiro com a planta e a planta pendente da laje, em passos de 4 graus; árvores de 3,5 a 6 m
    // a cada 9 m (a vegetação desenha), fora dos corredores das avenidas (a Canopy Bridge pousa ali)
    linhas.forEach((l, i) => {
      const yl = yb + l * peA;
      const rLow = rD + i * recuo;
      const rUp = rLow + recuo;
      const rTip = rLow - bal;
      const { A: T } = angulosDoArco(rLow, de, ate, 4, [], vao, extras);
      for (let k = 0; k + 1 < T.length; k++) {
        const a0 = T[k];
        const a1 = T[k + 1];
        const mid = (a0 + a1) / 2;
        if (janela(mid)) continue;
        const sag = rUp * (1 - Math.cos(((a1 - a0) * RAD) / 2)) + 0.03;
        faixaArco(g.opaco, cx, cz, rTip, rUp + sag, a0, a1, yl + 0.25, K.terraco, true);
        faixaArco(g.opaco, cx, cz, rTip + 0.5, rTip + 2.3, a0, a1, yl + 0.95, K.folhagemTerraco, true);
        testaArco(g.opaco, cx, cz, rTip + 0.2, a0, a1, yl - 2.6, yl + 0.8, hashF(k, i, 3) < 0.5 ? K.pendente : K.pendente2, -1);
      }
      if (!g.arvores) return;
      const rA = rTip + 1.4;
      const nA = Math.max(1, Math.floor(((ate - de) * RAD * rA) / 9));
      for (let k = 0; k < nA; k++) {
        const a = de + ((ate - de) * (k + 0.5 + 0.3 * (hashF(k, i, Math.round(de)) - 0.5))) / nA;
        if (janela(a)) continue;
        if (AVENIDAS.some((q) => Math.abs(difGraus(a, q)) * RAD * rA < 19)) continue;
        const [x, z] = noArco(cx, cz, rA, a);
        const h = hashF(k, i + 7, Math.round(de));
        g.arvores.push({ x, y: yl + 0.96, z, especie: h < 0.62 ? 'oiti' : h < 0.82 ? 'mata3' : 'palmeira', altura: 3.5 + 2.5 * hashF(k, i, 5), giro: hashF(k, i, 9) * 6.28 });
      }
    });
  }
  // cobertura: as faixas em trechos de 3 graus; o balanço com o forro aceso por baixo e a testa branca. A borda de dentro
  // acompanha o degrau do alto (rDt) e volta a rD nas janelas das quedas
  {
    const { A } = angulosDoArco(rF, de, ate, passoTeto, [], vao, extras);
    const esporte = teto === 'esporte';
    for (let i = 0; i + 1 < A.length; i++) {
      const a0 = A[i];
      const a1 = A[i + 1];
      const rI = janela((a0 + a1) / 2) ? rD : rDt;
      const faixas = esporte
        ? [[rI - bal, rI + 3, K.marquise], [rI + 3, raio - 4.66, K.solar], [raio - 4.66, raio - 3.66, K.marquise], [raio + 3.66, raio + 4.66, K.marquise], [raio + 4.66, rF - 3, K.solar], [rF - 3, rF + bal, K.marquise]]
        : [[rI - bal, rI + 3, K.marquise], [rI + 3, raio - 4, K.solar], [raio - 4, raio + 4, K.telhadoVerde], [raio + 4, rF - 3, K.solar], [rF - 3, rF + bal, K.marquise]];
      if (g.fantasma) {
        faixaArco(g.vidro, cx, cz, rI - bal, rF + bal, a0, a1, yb + H, K.marquise, true);
        continue;
      }
      for (const [r0, r1, k] of faixas) faixaArco(g.opaco, cx, cz, r0, r1, a0, a1, yb + H - (k === K.solar ? 0.05 : 0), k, true);
      // a pista de atletismo no eixo (uv: metros ao longo dela, distância à borda de dentro)
      if (esporte) faixaArco(g.opaco, cx, cz, raio - 3.66, raio + 3.66, a0, a1, yb + H, K.pista, true, true);
      testaArco(g.opaco, cx, cz, rF + bal, a0, a1, yb + yTeto, yb + H + 0.6, K.marquise, 1);
      testaArco(g.opaco, cx, cz, rI - bal, a0, a1, yb + yTeto, yb + H + 0.6, K.marquise, -1);
      faixaArco(g.opaco, cx, cz, rF, rF + bal, a0, a1, yb + yTeto, K.forro, false);
      faixaArco(g.opaco, cx, cz, rI - bal, rI, a0, a1, yb + yTeto, K.forro, false);
    }
    // no fantasma, só a silhueta: as quadras e as piscinas eram retângulos claros sobrepostos ao véu da cobertura
    if (esporte && !g.fantasma) quadrasEPiscinas(g, p, yb + H, rDt + 3, raio - 4.66, raio + 4.66, rF - 3);
  }
  // pórticos: os lados da passagem em vidro de saguão e o teto aceso a pe metros
  const mF = Math.asin(vao / 2 / rF) / RAD;
  const mD = Math.asin(vao / 2 / rD) / RAD;
  const qs = portais.flatMap((q0) => [q0 - 360, q0, q0 + 360]).filter((v) => v > de - mF + 1e-6 && v < ate + mF - 1e-6);
  for (const q of qs) {
    for (const s of [-1, 1]) {
      const aF = q + s * mF;
      const aD = q + s * mD;
      if (aF < de - 1e-6 || aF > ate + 1e-6) continue;
      const [xF, zF] = noArco(cx, cz, rF, aF);
      const [xD, zD] = noArco(cx, cz, rD, aD);
      // a normal olha para dentro da passagem (para o eixo)
      const nx = Math.sin(q * RAD) * s;
      const nz = -Math.cos(q * RAD) * s;
      const L = Math.hypot(xD - xF, zD - zF);
      g.vidro.quad([xF, yb, zF], [xD, yb, zD], [xD, yb + pePortal, zD], [xF, yb + pePortal, zF], [nx, 0, nz], [0, 0], [L, 0], [L, pePortal], [0, pePortal], vid(VIDRO.saguao, sem));
    }
    if (g.fantasma) continue;
    // o teto da passagem (a parte dele que cabe neste trecho)
    const t0 = Math.max(de, q - mF);
    const t1 = Math.min(ate, q + mF);
    const u0 = Math.max(de, q - mD);
    const u1 = Math.min(ate, q + mD);
    if (t1 - t0 < 1e-6) continue;
    const P = [];
    for (let i = 0; i <= 4; i++) P.push(...noArco(cx, cz, rF, t0 + ((t1 - t0) * i) / 4));
    for (let i = 4; i >= 0; i--) P.push(...noArco(cx, cz, rD, u0 + ((u1 - u0) * i) / 4));
    tampa(g.opaco, P, yb + pePortal, K.forroAceso, false);
  }
  // caixas de seleção que seguem a curva (~70 m cada)
  const L = ((ate - de) * RAD) * raio;
  const nC = Math.max(2, Math.round(L / 70));
  const passoC = (ate - de) / nC;
  const meiaC = Math.max(fundo / 2 + bal, raio * Math.sin((passoC * RAD) / 2)) + 2;
  for (let q = 0; q < nC; q++) {
    const [mx, mz] = noArco(cx, cz, raio, de + passoC * (q + 0.5));
    g.caixa([mx, yb, mz], meiaC, H, meiaC, p.id);
  }
}

/**
 * Teto esportivo do Horizon Ring: quadras de tênis (36,6 x 18,3 m com a área em volta) e piscinas de 50 m (com o deck),
 * em sequência ao longo das duas faixas ao lado da pista, entre campos de painéis solares. Cada peça é um retângulo
 * tangente ao arco, 6 a 8 cm acima da cobertura.
 */
function quadrasEPiscinas(g, p, y, rA0, rA1, rB0, rB1) {
  const { cx, cz, de, ate } = p;
  const ret = (r, a, L, W, yy, k, uvLocal) => {
    const t = [-Math.sin(a * RAD), Math.cos(a * RAD)];
    const n = [Math.cos(a * RAD), Math.sin(a * RAD)];
    const [ox, oz] = noArco(cx, cz, r, a);
    const c = (sl, sw) => [ox + t[0] * sl * L / 2 + n[0] * sw * W / 2, yy, oz + t[1] * sl * L / 2 + n[1] * sw * W / 2];
    const P = [c(-1, -1), c(1, -1), c(1, 1), c(-1, 1)];
    const uv = uvLocal ? [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]] : P.map((q) => [q[0], q[2]]);
    g.opaco.quad(...P, [0, 1, 0], ...uv, k);
  };
  // padrões das duas faixas (Q quadra, P piscina, S campo solar de 60 m): a de dentro com as piscinas, a de fora com as
  // quadras e, com a faixa de dentro estreita pelos terraços dos Hanging Gardens (D97), também as piscinas
  const estreita = rA1 - rA0 < 14;
  const seq = { dentro: ['Q', 'Q', 'P', 'S', 'Q', 'P', 'S'], fora: estreita ? ['Q', 'P', 'Q', 'S', 'Q', 'P', 'S', 'Q'] : ['Q', 'Q', 'Q', 'S', 'Q', 'Q', 'S'] };
  const comp = { Q: 36.6, P: 54, S: 60 };
  for (const [faixa, r0, r1] of [['dentro', rA0, rA1], ['fora', rB0, rB1]]) {
    if (faixa === 'dentro' && estreita) continue;
    const r = (r0 + r1) / 2;
    const W = r1 - r0 - 2;
    const margem = (48 / r) / RAD; // longe dos pórticos
    let s = 0;
    let k = Math.floor(hashF(Math.round(de), faixa === 'dentro' ? 1 : 2) * 3);
    let a = de + margem;
    while (true) {
      const tipo = seq[faixa][k % seq[faixa].length];
      const L = comp[tipo];
      const da = (L / r) / RAD;
      if (a + da > ate - margem) break;
      const ac = a + da / 2;
      if (tipo === 'Q') ret(r, ac, L, Math.min(W, 18.3), y + 0.06, K.quadra, true);
      else if (tipo === 'P') {
        ret(r, ac, L, Math.min(W, 20), y + 0.05, K.deck, false);
        ret(r, ac, 50, Math.min(W - 4, 15), y + 0.08, K.piscina, false);
      }
      a += da + (8 / r) / RAD;
      k++;
      if (++s > 40) break;
    }
  }
}

// ------------------------------------------------------------------------------------------------ o pódio

/**
 * Pódio redondo das torres (D89, as Petronas): tambor de 40 m com o vidro curvo e as marquises do shader (a mesma
 * língua dos anéis), embasamento de granito que sai da água do anel do pódio, a cornija branca com a linha de LED, a praça no
 * topo com as jardineiras, o guarda-corpo de vidro e, nos arcos das Dream Falls, a parede de granito escuro e o canal
 * raso de onde a água escorre. Quatro escadas rolantes em tubos de vidro sobem da praça do chão (raio 146) ao topo.
 */
function podio(g, p) {
  const { cx, cz, raio: R, altura: H, escadas = [], cachoeiras = [], abertura = 60 } = p;
  const y = g.chao(cx, cz);
  const yBase = y - 0.4; // o anel d'água do pódio é uma bacia à altura do chão (D97): o embasamento começa no chão
  const n = 96;
  const naQueda = (a) => cachoeiras.some((q) => Math.abs(difGraus(a, q)) < abertura / 2);
  if (g.sombra) {
    cilindro(g.opaco, cx, cz, y, y + H, R, R, 32, K.granito, { topo: true });
    return;
  }
  const kv = vidAnel(VIDRO.anel, 0.41, 900, 5, SETOR_SEM);
  for (let i = 0; i < n; i++) {
    const a0 = (360 * i) / n;
    const a1 = (360 * (i + 1)) / n;
    if (naQueda((a0 + a1) / 2) && !g.fantasma) {
      paredeArco(g.opaco, cx, cz, yBase, R, a0, a1, 0, y + H - yBase, K.granitoEscuro, 1);
      continue;
    }
    if (!g.fantasma) paredeArco(g.opaco, cx, cz, yBase, R, a0, a1, 0, y + 1.2 - yBase, K.granito, 1);
    paredeArco(g.vidro, cx, cz, y, R - 0.4, a0, a1, 1.2, H - 1.6, kv, 1);
  }
  if (!g.fantasma) {
    // cornija branca com a linha de LED, o mesmo traço dos anéis
    cilindro(g.opaco, cx, cz, y + H - 1.6, y + H + 0.3, R + 0.6, R + 0.6, n, K.marquise, { topo: false });
    cilindro(g.opaco, cx, cz, y + H - 1.0, y + H - 0.6, R + 0.65, R + 0.65, n, K.led, { topo: false });
  }
  // a praça do topo (a pedra clara das Petronas) e as jardineiras com árvores em volta das torres
  tampa(g.opaco, aoMundo(elipse(R + 0.6, R + 0.6, n), cx, cz, 0), y + H + 0.3, g.fantasma ? K.marquise : K.pisoClaro, true);
  if (g.fantasma) {
    g.caixa([cx, y, cz], R, H);
    return;
  }
  const noPar = (x, z) => {
    const c = Math.cos(PAR.rot);
    const s = Math.sin(PAR.rot);
    const dx = x - cx;
    const dz = z - cz;
    const lx = c * dx - s * dz;
    const lz = s * dx + c * dz;
    return Math.abs(lx) < 54 && Math.abs(lz) < 30;
  };
  const nJ = 48;
  for (let i = 0; i < nJ; i++) {
    const a0 = (360 * i) / nJ;
    const a1 = (360 * (i + 0.72)) / nJ;
    const am = (a0 + a1) / 2;
    if (escadas.some((q) => Math.abs(difGraus(am, q)) < 6) || naQueda(am)) continue;
    const [mx, mz] = noArco(cx, cz, 69, am);
    if (noPar(mx, mz)) continue;
    paredeArco(g.opaco, cx, cz, y + H + 0.3, 73, a0, a1, 0, 0.7, K.pedra, 1);
    paredeArco(g.opaco, cx, cz, y + H + 0.3, 65, a0, a1, 0, 0.7, K.pedra, -1);
    faixaArco(g.opaco, cx, cz, 65, 73, a0, a1, y + H + 0.95, K.jardim, true);
    g.arvores?.push({ x: mx, y: y + H + 1, z: mz, especie: 'oiti', altura: 8 + 2 * hashF(i, 3), giro: hashF(i, 5) * 6.28 });
  }
  // guarda-corpo de vidro na borda (fora dos canais das quedas)
  for (let i = 0; i < n; i++) {
    const a0 = (360 * i) / n;
    const a1 = (360 * (i + 1)) / n;
    if (naQueda((a0 + a1) / 2)) continue;
    paredeArco(g.vidro, cx, cz, y + H + 0.3, R - 0.2, a0, a1, 0, 1.2, vid(VIDRO.parapeito, 0.5), 1);
  }
  // canais das Dream Falls: o espelho raso de onde a água escorre para a borda e a soleira de bronze
  for (const q of cachoeiras) {
    const a0 = q - abertura / 2;
    const a1 = q + abertura / 2;
    const m = 12;
    for (let i = 0; i < m; i++) {
      const b0 = a0 + ((a1 - a0) * i) / m;
      const b1 = a0 + ((a1 - a0) * (i + 1)) / m;
      faixaArco(g.opaco, cx, cz, 70, R, b0, b1, y + H + 0.32, K.aguaRasa, true);
      faixaArco(g.opaco, cx, cz, R, R + 0.6, b0, b1, y + H + 0.1, K.bronze, true);
      testaArco(g.opaco, cx, cz, 70, b0, b1, y + H + 0.3, y + H + 0.6, K.granito, -1);
    }
  }
  // escadas rolantes: tubos de vidro do chão (raio 146) ao topo (raio 80), com a viga branca por baixo e o pavilhão de
  // entrada
  for (const q of escadas) {
    const t = [Math.cos(q * RAD), Math.sin(q * RAD)];
    const lat = [-t[1], t[0]];
    const ra = 146; // a praça acaba em 150, onde o Mirror Lake grande começa (D97): o pavilhão fica dentro dela
    const rb = 80;
    const ya = y + 0.3;
    const yt = y + H + 0.3;
    const L = Math.hypot(ra - rb, yt - ya);
    const P = (r, yy, w, h) => [cx + t[0] * r + lat[0] * w, yy + h, cz + t[1] * r + lat[1] * w];
    const w = 2.1;
    const h = 3.6;
    const kE = vid(VIDRO.escada, 0.3);
    // as duas laterais e o teto do tubo (uv: metros ao longo dele, altura acima do piso)
    for (const s of [-1, 1]) g.vidro.quad(P(ra, ya, s * w, 0), P(rb, yt, s * w, 0), P(rb, yt, s * w, h), P(ra, ya, s * w, h), [lat[0] * s, 0, lat[1] * s], [0, 0], [L, 0], [L, h], [0, h], kE);
    const nTeto = [t[0] * (yt - ya) / L, (ra - rb) / L, t[1] * (yt - ya) / L];
    g.vidro.quad(P(ra, ya, -w, h), P(rb, yt, -w, h), P(rb, yt, w, h), P(ra, ya, w, h), nTeto, [0, h], [L, h], [L, h], [0, h], kE);
    // a viga branca por baixo e as bordas
    const nBaixo = nTeto.map((v) => -v);
    g.opaco.quad(P(ra, ya - 0.9, -w - 0.2, 0), P(rb, yt - 0.9, -w - 0.2, 0), P(rb, yt - 0.9, w + 0.2, 0), P(ra, ya - 0.9, w + 0.2, 0), nBaixo, [0, 0], [L, 0], [L, 4], [0, 4], K.marquise);
    for (const s of [-1, 1]) g.opaco.quad(P(ra, ya - 0.9, s * (w + 0.2), 0), P(rb, yt - 0.9, s * (w + 0.2), 0), P(rb, yt, s * (w + 0.2), 0), P(ra, ya, s * (w + 0.2), 0), [lat[0] * s, 0, lat[1] * s], [0, 0], [L, 0], [L, 1], [0, 1], K.marquise);
    // dois pilares finos (na praça e na floresta) e o pavilhão de vidro da entrada
    for (const r of [134, 108]) {
      const yy = ya + ((yt - ya) * (ra - r)) / (ra - rb);
      cilindro(g.opaco, cx + t[0] * r, cz + t[1] * r, y - 0.5, yy - 0.9, 0.7, 0.7, 8, K.marquise, { topo: false });
    }
    const [px, pz] = noArco(cx, cz, ra - 3, q);
    caixa(g.vidro, px, pz, 5, 4.5, y + 0.3, y + 5, vid(VIDRO.saguao, 0.6), { ux: t[0], uz: t[1], topo: false });
    caixa(g.opaco, px, pz, 5.6, 5.1, y + 5, y + 5.6, K.marquise, { ux: t[0], uz: t[1] });
  }
  g.caixa([cx, y, cz], R, H);
}

// ------------------------------------------------------------------------------------------------ água

/**
 * Dream Falls (D89): duas quedas de 40 m da borda do pódio para o Mirror Lake, em arcos de `abertura` graus. A lâmina
 * cai numa curva que se afasta da parede, a película corre no canal do topo até a borda, a névoa sobe onde a água bate e
 * a espuma se espalha no lago. Tudo no material 'cascata' (o shader anima).
 */
function cachoeira(g, p) {
  const { cx, cz, raio: R, altura: H, angulos, abertura } = p;
  const y = g.chao(cx, cz);
  const nivel = g.nivelAgua ?? y + BACIA.nivel;
  if (g.fantasma || g.sombra || !g.efeitos) {
    for (const q of angulos) {
      const [x, z] = noArco(cx, cz, R + 6, q);
      g.caixa([x, nivel, z], 10, H, 10);
    }
    return;
  }
  const lod = g.lod ?? 1;
  for (const [k, q] of angulos.entries()) {
    const a0 = q - abertura / 2;
    const a1 = q + abertura / 2;
    const nA = 30;
    const nV = 7;
    const fase = 0.37 * k;
    // a lâmina: do topo (y + H) ao lago; o raio cresce com o quadrado da queda (a parábola da água que sai da borda)
    const base = g.efeitos.vertices;
    for (let j = 0; j <= nV; j++) {
      const t = j / nV;
      const yy = y + H + 0.2 - (y + H + 0.2 - nivel) * t;
      const r = R + 0.7 + 2.2 * t * t;
      for (let i = 0; i <= nA; i++) {
        const a = a0 + ((a1 - a0) * i) / nA;
        const c = Math.cos(a * RAD);
        const s = Math.sin(a * RAD);
        g.efeitos.v(cx + r * c, yy, cz + r * s, c, 0, s, R * a * RAD, y + H + 0.2 - yy, [CASCATA.lamina, fase, 0, 0]);
      }
    }
    const Lv = nA + 1;
    for (let j = 0; j < nV; j++) for (let i = 0; i < nA; i++) {
      const a = base + j * Lv + i;
      g.efeitos.tri(a, a + 1, a + Lv + 1);
      g.efeitos.tri(a, a + Lv + 1, a + Lv);
    }
    // a película do canal do topo e a espuma no lago (uv: metros ao longo, distância à linha de partida)
    for (let i = 0; i < 12; i++) {
      const b0 = a0 + ((a1 - a0) * i) / 12;
      const b1 = a0 + ((a1 - a0) * (i + 1)) / 12;
      const w = [CASCATA.faixa, fase, 0, 0];
      const P = [[70, b0], [70, b1], [R + 0.7, b1], [R + 0.7, b0]].map(([r, a]) => noArco(cx, cz, r, a));
      g.efeitos.quad(...P.map(([x, z]) => [x, y + H + 0.42, z]), [0, 1, 0], [70 * b0 * RAD, 0], [70 * b1 * RAD, 0], [70 * b1 * RAD, R + 0.7 - 70], [70 * b0 * RAD, R + 0.7 - 70], w);
      const e = [CASCATA.espuma, fase, 0, 0];
      const Q = [[R + 0.3, b0], [R + 0.3, b1], [R + 13, b1], [R + 13, b0]].map(([r, a]) => noArco(cx, cz, r, a));
      g.efeitos.quad(...Q.map(([x, z]) => [x, nivel + 0.06, z]), [0, 1, 0], [R * b0 * RAD, -2.6], [R * b1 * RAD, -2.6], [R * b1 * RAD, 10.1], [R * b0 * RAD, 10.1], e);
    }
    // a névoa: duas cascas que se abrem para fora
    cascaEfeito(g.efeitos, cx, cz, nivel, nivel + 18, R + 1.6, R + 10, lod === 0 ? 24 : 16, CASCATA.nevoa, 3, fase, a0 * RAD, a1 * RAD);
    cascaEfeito(g.efeitos, cx, cz, nivel, nivel + 9, R + 3, R + 13, 16, CASCATA.nevoa, 2, fase + 0.5, a0 * RAD, a1 * RAD);
    const [x, z] = noArco(cx, cz, R + 6, q);
    g.caixa([x, nivel, z], R * Math.sin((abertura / 2) * RAD) + 6, H + 2, R * Math.sin((abertura / 2) * RAD) + 6);
  }
}

/**
 * Fontes dançantes no Mirror Lake (Dubai Fountain): os jatos grandes no meio do anel de água, os pequenos 3,5 m para
 * dentro e para fora, intercalados, fora das quedas e das escadas rolantes. A coreografia é do sombreador (torre.js).
 */
function fontes(g, p) {
  const { cx, cz, r, n, evitar = [] } = p;
  const livre = (a) => !evitar.some(([a0, a1]) => a >= a0 - 1e-6 && a <= a1 + 1e-6);
  const angs = [];
  for (let i = 0; i < n; i++) {
    const a = (360 * (i + 0.5)) / n;
    if (livre(a)) angs.push(a);
  }
  const lista = [];
  angs.forEach((a, i) => {
    const f = angs.length > 1 ? i / (angs.length - 1) : 0.5;
    const [x, z] = noArco(cx, cz, r, a);
    lista.push({ x, z, f, tipo: 0 });
    if (i % 2 === 0) {
      const [x2, z2] = noArco(cx, cz, r + (i % 4 === 0 ? 3.5 : -3.5), a + 180 / n);
      lista.push({ x: x2, z: z2, f, tipo: 1 });
    }
  });
  if (g.jatos && !g.fantasma) g.jatos.push(...lista);
  // caixas de seleção em volta do anel de água (uma por grupo de jatos)
  const y = g.chao(cx, cz);
  for (let q = 0; q < 8; q++) {
    const [x, z] = noArco(cx, cz, r, 22.5 + 45 * q);
    g.caixa([x, y - 1, z], 14, 20, 14);
  }
}

// ------------------------------------------------------------------------------------------------ as torres do bosque

/**
 * Codex Tower (D89): 300 m de prisma facetado de vidro quase preto (o Black Diamond de Copenhague), em seis lances que
 * giram e afinam, cada um torcido contra o de baixo, e a crista no alto; as arestas dos lances com a linha de LED. Na
 * base, 36 m de átrio de livros (a Biblioteca de Tianjin Binhai): os terraços de estantes em curva, abertos para o
 * centro sob o balanço do prisma, com a esfera acesa no meio, e o vidro escuro atrás.
 */
function codex(g, p) {
  const { x, z, altura: H, rot = 0 } = p;
  const y = g.chao(x, z);
  const sem = hashF(Math.round(x), Math.round(z), 21);
  const kv = vid(VIDRO.codex, sem);
  const local = (lx, lz) => [x + Math.cos(rot) * lx + Math.sin(rot) * lz, z - Math.sin(rot) * lx + Math.cos(rot) * lz];
  // os lances: planta hexagonal alongada (58 x 36), cada um girado e encolhido, com o lado de dentro (o -z local) mais
  // recuado no alto: a silhueta lê como um cristal que se inclina para o parque
  const BASE = 36;
  const niveis = [BASE, 92, 150, 204, 252, 284];
  const escala = [1, 0.95, 0.88, 0.8, 0.7, 0.58];
  const giro = [0, 6, -4, 7, -5, 8];
  const hexa = (k) => {
    const s = escala[k];
    const a = giro[k] * RAD;
    const pts = [[29, 0], [14, 18], [-14, 18], [-29, 0], [-14, -18], [14, -18]];
    return pts.map(([px, pz]) => {
      const lx = px * s;
      const lz = pz * s;
      return [Math.cos(a) * lx - Math.sin(a) * lz + 2.5 * k, Math.sin(a) * lx + Math.cos(a) * lz - 1.5 * k];
    });
  };
  const aneis = niveis.map((_, k) => hexa(k));
  // faceta: triângulo com a normal dele (vértices próprios), u ao longo do perímetro, v a altura acima do pé
  const faceta = (m, A, B, C, uA, uB, uC, k) => {
    const pA = [...local(A[0], A[2])], pB = [...local(B[0], B[2])], pC = [...local(C[0], C[2])];
    const P = [[pA[0], y + A[1], pA[1]], [pB[0], y + B[1], pB[1]], [pC[0], y + C[1], pC[1]]];
    const e1 = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]];
    const e2 = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
    let nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const l = Math.hypot(...nn) || 1;
    nn = nn.map((v) => v / l);
    // virada para fora: o eixo do prisma fica atrás (5 m abaixo, para as facetas da crista olharem para cima)
    const [ccx, ccz] = local(6.25, -3.75);
    const mx = (P[0][0] + P[1][0] + P[2][0]) / 3 - ccx;
    const my = (P[0][1] + P[1][1] + P[2][1]) / 3 - ((P[0][1] + P[1][1] + P[2][1]) / 3 - 5);
    const mz = (P[0][2] + P[1][2] + P[2][2]) / 3 - ccz;
    if (nn[0] * mx + nn[1] * my + nn[2] * mz < 0) nn = nn.map((v) => -v);
    const i0 = m.v(...P[0], ...nn, uA, A[1] - BASE, k);
    const i1 = m.v(...P[1], ...nn, uB, B[1] - BASE, k);
    const i2 = m.v(...P[2], ...nn, uC, C[1] - BASE, k);
    m.tri(i0, i1, i2);
  };
  const perim = (k, i) => {
    let u = 0;
    for (let j = 0; j < i; j++) {
      const [ax, az] = aneis[k][j];
      const [bx, bz] = aneis[k][(j + 1) % 6];
      u += Math.hypot(bx - ax, bz - az);
    }
    return u;
  };
  const alvo = g.sombra ? g.opaco : g.vidro;
  const kk = g.sombra ? K.granito : kv;
  for (let k = 0; k + 1 < aneis.length; k++) {
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      const A = [aneis[k][i][0], niveis[k], aneis[k][i][1]];
      const B = [aneis[k][j][0], niveis[k], aneis[k][j][1]];
      const C = [aneis[k + 1][i][0], niveis[k + 1], aneis[k + 1][i][1]];
      const D = [aneis[k + 1][j][0], niveis[k + 1], aneis[k + 1][j][1]];
      const uA = perim(k, i), uB = j ? perim(k, j) : perim(k, 6);
      faceta(alvo, A, B, D, uA, uB, uB, kk);
      faceta(alvo, A, D, C, uA, uB, uA, kk);
    }
  }
  // a crista: o último lance fecha numa aresta de 22 m a 300 m
  const top = aneis[aneis.length - 1];
  const yTop = niveis[niveis.length - 1];
  const R1 = [-11 + 12.5, H, -7.5];
  const R2 = [11 + 12.5, H, -7.5];
  // cada vértice do último lance sobe para a ponta mais perto da crista; onde a ponta muda, a faceta é um quadrilátero
  const ponta = [R2, R2, R1, R1, R1, R2];
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    const A = [top[i][0], yTop, top[i][1]];
    const B = [top[j][0], yTop, top[j][1]];
    const uA = perim(5, i);
    const uB = j ? perim(5, j) : perim(5, 6);
    faceta(alvo, A, B, ponta[j], uA, uB, uB, kk);
    if (ponta[i] !== ponta[j]) faceta(alvo, A, ponta[j], ponta[i], uA, uB, uA, kk);
  }
  // o fundo do prisma (o forro aceso sobre o átrio)
  const base = aneis[0].flatMap(([px, pz]) => local(px, pz));
  tampa(g.opaco, base, y + BASE, g.sombra ? K.granito : K.forroAceso, false);
  if (g.sombra) {
    // o átrio como um bloco
    tampa(g.opaco, aoMundo(elipse(28.3, 15, 16), x, z, rot), y, K.granito, false);
    return;
  }
  if (!g.fantasma) {
    // linhas de LED nas arestas de cada lance (os cortes do cristal acesos à noite)
    for (let k = 1; k < aneis.length; k++) {
      for (let i = 0; i < 6; i++) {
        const j = (i + 1) % 6;
        const [ax, az] = local(...aneis[k][i]);
        const [bx, bz] = local(...aneis[k][j]);
        const [mx, mz] = local(2.5 * k, -1.5 * k);
        const ox = (ax + bx) / 2 - mx;
        const oz = (az + bz) / 2 - mz;
        const ol = Math.hypot(ox, oz) || 1;
        const d = 0.25;
        const yy = y + niveis[k];
        g.opaco.quad([ax + (ox / ol) * d, yy - 0.3, az + (oz / ol) * d], [bx + (ox / ol) * d, yy - 0.3, bz + (oz / ol) * d], [bx + (ox / ol) * d, yy + 0.3, bz + (oz / ol) * d], [ax + (ox / ol) * d, yy + 0.3, az + (oz / ol) * d], [ox / ol, 0, oz / ol], [0, 0], [1, 0], [1, 30], [0, 30], K.led);
      }
    }
  }
  // o átrio: vidro escuro atrás (a metade +z local, para o anel de fora) e os terraços de livros abertos para o centro. Com
  // o pórtico de 40 x 18 m da D97 (a avenida passa pelo átrio, no eixo local z), o átrio tem 28,3 m de semi-eixo: a
  // abertura cai nos segmentos de 45 a 135 graus de cada metade (x de -20 a +20)
  const A0 = 28.3;
  const B0 = 15;
  const nE = 24;
  const pass = p.passagem ?? null;
  const naAbertura = (i) => !!pass && i >= 6 && i < 18;
  const pE = (a, b, t) => local(a * Math.cos(t), b * Math.sin(t));
  for (let i = 0; i < nE; i++) {
    const t0 = (Math.PI * i) / nE;
    const t1 = (Math.PI * (i + 1)) / nE;
    const [x0, z0] = pE(A0, B0, t0);
    const [x1, z1] = pE(A0, B0, t1);
    const L = Math.hypot(x1 - x0, z1 - z0);
    const nx = (z1 - z0) / L;
    const nz = -(x1 - x0) / L;
    const [cx0, cz0] = local(0, 0);
    const fora = ((x0 + x1) / 2 - cx0) * nx + ((z0 + z1) / 2 - cz0) * nz > 0 ? 1 : -1;
    const yb = naAbertura(i) ? pass.pe : 0;
    g.vidro.quad([x0, y + yb, z0], [x1, y + yb, z1], [x1, y + BASE, z1], [x0, y + BASE, z0], [nx * fora, 0, nz * fora], [i * L, yb], [(i + 1) * L, yb], [(i + 1) * L, BASE], [i * L, BASE], kv);
  }
  if (pass) {
    // o pórtico: os dois lados da passagem em vidro de saguão e o teto aceso a pe metros
    const x0 = pass.vao / 2;
    const zf = B0 * Math.sqrt(1 - (x0 / A0) ** 2);
    for (const sd of [-1, 1]) {
      const [ax, az] = local(sd * x0, -zf);
      const [bx, bz] = local(sd * x0, zf);
      const [nx, nz] = [-sd * Math.cos(rot), sd * Math.sin(rot)];
      g.vidro.quad([ax, y, az], [bx, y, bz], [bx, y + pass.pe, bz], [ax, y + pass.pe, az], [nx, 0, nz], [0, 0], [2 * zf, 0], [2 * zf, pass.pe], [0, pass.pe], vid(VIDRO.saguao, 0.43));
    }
    if (!g.fantasma) tampa(g.opaco, [local(-x0, -zf), local(x0, -zf), local(x0, zf), local(-x0, zf)].flat(), y + pass.pe, K.forroAceso, false);
  }
  if (!g.fantasma) {
    const nT = 7;
    for (let k = 0; k < nT; k++) {
      const a = A0 - 1 - 2.4 * k;
      const b = B0 - 1 - 1.7 * k;
      const a2 = a - 2.4;
      const b2 = b - 1.7;
      const y0 = y + 4.5 * k;
      const y1 = y0 + 4.5;
      for (let i = 0; i < nE; i++) {
        // sob o pórtico (a abertura de 18 m) não há terraço: a avenida passa
        if (pass && i >= 6 && i < 18 && 4.5 * k < pass.pe - 1e-6) continue;
        const t0 = Math.PI + (Math.PI * i) / nE;
        const t1 = Math.PI + (Math.PI * (i + 1)) / nE;
        const [x0, z0] = pE(a, b, t0);
        const [x1, z1] = pE(a, b, t1);
        const [cx0, cz0] = local(0, 0);
        const L = Math.hypot(x1 - x0, z1 - z0) || 1;
        let nx = (z1 - z0) / L;
        let nz = -(x1 - x0) / L;
        if (((x0 + x1) / 2 - cx0) * nx + ((z0 + z1) / 2 - cz0) * nz < 0) {
          nx = -nx;
          nz = -nz;
        }
        // a estante (o espelho do terraço, virado para fora) e o piso do terraço de cima
        g.opaco.quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], [nx, 0, nz], [i * L, 0], [(i + 1) * L, 0], [(i + 1) * L, 4.5], [i * L, 4.5], K.livros);
        const [x2, z2] = pE(a2, b2, t0);
        const [x3, z3] = pE(a2, b2, t1);
        g.opaco.quad([x0, y1, z0], [x1, y1, z1], [x3, y1, z3], [x2, y1, z2], [0, 1, 0], [x0, z0], [x1, z1], [x3, z3], [x2, z2], K.marquise);
      }
    }
    // o piso do átrio e a esfera acesa no meio (o "olho" de Tianjin)
    // o piso do átrio abaixo das pistas da avenida (que passa por baixo do pórtico); o globo (o "olho" de Tianjin) sobe
    // acima do teto do pórtico quando a avenida passa pelo átrio
    tampa(g.opaco, aoMundo(elipse(A0, B0, nE * 2), x, z, rot), y + (pass ? 0.06 : 0.15), K.pisoClaro, true);
    const [sx, sz] = local(0, -12);
    const perfil = [];
    const yGlobo = pass ? 28 : 10;
    for (let i = 0; i <= 10; i++) {
      const t = -Math.PI / 2 + (Math.PI * i) / 10;
      perfil.push([Math.max(0.01, 8 * Math.cos(t)), y + yGlobo + 8 * Math.sin(t)]);
    }
    torno(g.vidro, sx, sz, perfil, 18, [VIDRO.lanterna, 0.4, 0, 0]);
  }
  g.caixa([x, y, z], 32, H, 32);
}

/** Pé-direito das torres ovais: a régua do Horizon Ring (6,4 m), para a faixa de LED cair na mesma altura e espessura. */
export const PE_OVAL = HORIZON.altura / HORIZON.andares;
/** Balanço da marquise das torres ovais (m); o shader do vidro usa o mesmo no LOD1. */
export const BAL_OVAL = 1.2;

/**
 * Corpos de uma torre oval, de baixo para cima: { y0, y1, e0, e1 (escala da planta no pé e no topo), gira (a torção
 * corre neste corpo), podio }. A Helix Labs (a Torre Generali de Zaha Hadid, em Milão): o pódio de 3 andares (o pórtico de 18 m da D97 cabe nele) e o fuste
 * que gira `torcao` graus e afina até `afina` no topo, coroado pela lanterna de vidro de corte inclinado. A Compass Tower
 * (o Simpson Querrey de Chicago): o pódio de 3 andares e o fuste em três corpos que recuam com terraços plantados
 * (a 115,2 e a 147,2 m, acima da faixa de LED), coroado pela grelha das máquinas e pela agulha. Os cortes caem em
 * lajes da régua de 6,4 m.
 */
export function corposDaOval(p) {
  const H = p.altura;
  if (p.torcao) {
    return [
      { y0: 0, y1: 3 * PE_OVAL, e0: 1.45, e1: 1.45, podio: true },
      { y0: 3 * PE_OVAL, y1: H, e0: 1, e1: p.afina ?? 1, gira: true },
    ];
  }
  // os recuos acima da faixa de LED (de 51,2 a 108,8 m): ela corre inteira no primeiro corpo
  const a1 = 18 * PE_OVAL;
  const a2 = 23 * PE_OVAL;
  const recuo = 1 - (p.afina ?? 0.84);
  return [
    { y0: 0, y1: 3 * PE_OVAL, e0: 1.5, e1: 1.5, podio: true },
    { y0: 3 * PE_OVAL, y1: a1, e0: 1, e1: 1 },
    { y0: a1, y1: a2, e0: 1 - 0.9 * recuo, e1: 1 - 0.9 * recuo },
    { y0: a2, y1: H, e0: 1 - 1.75 * recuo, e1: 1 - 1.75 * recuo },
  ];
}

/**
 * Torre oval (Helix Labs e Compass Tower, D89): torre de verdade, não silo. Planta elíptica com o vidro do chão ao teto
 * e a marquise branca em cada laje (a língua dos anéis), a faixa de LED de um terço dos andares na faixa de altura da do
 * Horizon Ring (D93), o pódio largo com o jardim no teto, e o resto pelo desenho de cada uma (corposDaOval): a Helix gira e
 * afina com as duas espinhas de bronze que mostram a torção e a lanterna inclinada no alto; a Compass recua em terraços
 * com jardim e guarda-corpo de vidro e termina na grelha das máquinas com a agulha. Casca no LOD1 (o fuste que gira em
 * faixas de 2 andares), as marquises no LOD0 do setor dela.
 */
function oval(g, p, setor) {
  const { x, z, altura: H, a, b, torcao = 0, rot = 0, led, coroa } = p;
  const y = g.chao(x, z);
  const pe = PE_OVAL;
  const meio = (led.y0 + led.y1) / 2;
  // a faixa de LED na mesma faixa de altura da do Horizon Ring (a mesma régua de 6,4 m e o mesmo número de andares)
  const nLed = andaresLed(HORIZON.andares);
  const meiaLed = faixaLed(pe, HORIZON.andares);
  const lod = g.lod ?? 1;
  // a marquise das ovais é mais curta que a dos anéis (1,2 m): na torre a leitura é vertical, de vidro, com as linhas
  // brancas finas (com 2,2 m o topo das marquises visto do alto fazia a torre listrada de branco, um silo)
  const bal = BAL_OVAL;
  const corpos = corposDaOval(p);
  const fuste = corpos.find((c) => c.gira);
  // a grade de ângulos da planta: 48 passos e, com o pórtico na base (D97), as quatro bordas dele no pódio, para a abertura
  // de 40 m cair exata (a passagem corre no eixo local z, o da avenida: x de -vao/2 a +vao/2)
  const pass = p.passagem ?? null;
  const podioC = corpos.find((c) => c.podio);
  const angs = Array.from({ length: 48 }, (_, i) => (2 * Math.PI * i) / 48);
  if (pass && podioC) {
    const t0 = Math.acos(Math.min(1, pass.vao / 2 / (a * podioC.e0)));
    angs.push(t0, Math.PI - t0, Math.PI + t0, 2 * Math.PI - t0);
    angs.sort((u, v) => u - v);
  }
  const nE = angs.length;
  const ang = (i) => (i >= nE ? 2 * Math.PI : angs[i]);
  // o segmento i do contorno do pódio está na abertura da passagem (e abaixo do pé dela)
  const naPassagem = (c, i) => !!pass && !g.sombra && c.podio && Math.abs(a * c.e0 * Math.cos((ang(i) + ang(i + 1)) / 2)) < pass.vao / 2 - 1e-6;
  const giroEm = (c, yy) => rot + (c.gira ? torcao * RAD * Math.min(1, Math.max(0, (yy - c.y0) / (c.y1 - c.y0))) : 0);
  const escEm = (c, yy) => c.e0 + (c.e1 - c.e0) * Math.min(1, Math.max(0, (yy - c.y0) / (c.y1 - c.y0)));
  const pto = (c, t, yy, d = 0) => {
    const th = giroEm(c, yy);
    const e = escEm(c, yy);
    const lx = (a * e + d) * Math.cos(t);
    const lz = (b * e + d) * Math.sin(t);
    return [x + Math.cos(th) * lx + Math.sin(th) * lz, y + yy, z - Math.sin(th) * lx + Math.cos(th) * lz];
  };
  const nrm = (c, t, yy) => {
    const th = giroEm(c, yy);
    let nx = Math.cos(t) / a;
    let nz = Math.sin(t) / b;
    const l = Math.hypot(nx, nz);
    nx /= l;
    nz /= l;
    return [Math.cos(th) * nx + Math.sin(th) * nz, 0, -Math.sin(th) * nx + Math.cos(th) * nz];
  };
  // u ao longo do contorno (metros, na escala 1)
  const U = [0];
  for (let i = 1; i <= nE; i++) {
    const t0 = ang(i - 1);
    const t1 = ang(i);
    U.push(U[i - 1] + Math.hypot(a * (Math.cos(t1) - Math.cos(t0)), b * (Math.sin(t1) - Math.sin(t0))));
  }
  if (lod === 0) {
    const alvo = g.setor ? g.setor(setor).opaco : g.opaco;
    for (const c of corpos) {
      for (let l = Math.ceil(c.y0 / pe + 1e-6); l * pe < c.y1 - 1; l++) {
        const yl = l * pe;
        if (Math.abs(yl - meio) < meiaLed - 0.01 || yl <= c.y0 + 0.5) continue;
        for (let i = 0; i < nE; i++) {
          if (yl < pass?.pe + 0.5 && naPassagem(c, i)) continue;
          const t0 = ang(i);
          const t1 = ang(i + 1);
          for (const [dy, k, cima] of [[0.25, K.marquiseTopo, true], [-0.25, K.forro, false]]) {
            const P = [pto(c, t0, yl + dy), pto(c, t1, yl + dy), pto(c, t1, yl + dy, bal), pto(c, t0, yl + dy, bal)];
            alvo.quad(...P, [0, cima ? 1 : -1, 0], [U[i], 0], [U[i + 1], 0], [U[i + 1], bal], [U[i], bal], k);
          }
          const P = [pto(c, t0, yl - 0.25, bal), pto(c, t1, yl - 0.25, bal), pto(c, t1, yl + 0.25, bal), pto(c, t0, yl + 0.25, bal)];
          alvo.quad(...P, nrm(c, (t0 + t1) / 2, yl), [U[i], 0], [U[i + 1], 0], [U[i + 1], 0.5], [U[i], 0.5], K.testa);
        }
      }
    }
    return;
  }
  const kv = vidAnel(VIDRO.oval, hashF(Math.round(x), Math.round(z), 31), meio, pe, setor, nLed);
  const alvo = g.sombra ? g.opaco : g.vidro;
  // a casca de cada corpo (o vidro; na sombra, o volume), em faixas de 2 andares no que gira
  for (const c of corpos) {
    const faixas = c.gira ? Math.ceil((c.y1 - c.y0) / (2 * pe)) : 1;
    const topoCasca = c === corpos[corpos.length - 1] ? c.y1 - 1 : c.y1;
    const ys = Array.from({ length: faixas + 1 }, (_, j) => c.y0 + ((topoCasca - c.y0) * j) / faixas);
    const base = alvo.vertices;
    for (const yy of ys) for (let i = 0; i <= nE; i++) alvo.v(...pto(c, ang(i), yy), ...nrm(c, ang(i), yy), U[i] * escEm(c, yy), yy, g.sombra ? K.granito : kv);
    const L = nE + 1;
    for (let j = 0; j < faixas; j++) for (let i = 0; i < nE; i++) {
      // na abertura do pórtico o vidro só começa a pe metros do chão (o resto do segmento é a passagem)
      if (naPassagem(c, i)) {
        const y0 = Math.max(ys[j], pass.pe);
        const y1 = ys[j + 1];
        if (y1 - y0 > 0.05) {
          const t0 = ang(i);
          const t1 = ang(i + 1);
          const n = nrm(c, (t0 + t1) / 2, y0);
          alvo.quad(pto(c, t0, y0), pto(c, t1, y0), pto(c, t1, y1), pto(c, t0, y1), n, [U[i], y0], [U[i + 1], y0], [U[i + 1], y1], [U[i], y1], kv);
        }
        continue;
      }
      const q = base + j * L + i;
      alvo.tri(q, q + 1, q + L + 1);
      alvo.tri(q, q + L + 1, q + L);
    }
  }
  // o pórtico: os lados da passagem em vidro de saguão e o teto aceso a pe metros (a avenida passa pelo pé da torre)
  if (pass && podioC && !g.sombra) {
    const x0 = pass.vao / 2;
    const zf = b * podioC.e0 * Math.sqrt(Math.max(0, 1 - (x0 / (a * podioC.e0)) ** 2));
    const loc = (lx, ly, lz) => [x + Math.cos(rot) * lx + Math.sin(rot) * lz, y + ly, z - Math.sin(rot) * lx + Math.cos(rot) * lz];
    for (const s of [-1, 1]) {
      const n = [-s * Math.cos(rot), 0, s * Math.sin(rot)];
      g.vidro.quad(loc(s * x0, 0, -zf), loc(s * x0, 0, zf), loc(s * x0, pass.pe, zf), loc(s * x0, pass.pe, -zf), n, [0, 0], [2 * zf, 0], [2 * zf, pass.pe], [0, pass.pe], vid(VIDRO.saguao, 0.57));
    }
    if (!g.fantasma) {
      const teto = [loc(-x0, 0, -zf), loc(x0, 0, -zf), loc(x0, 0, zf), loc(-x0, 0, zf)].flatMap((q) => [q[0], q[2]]);
      tampa(g.opaco, teto, y + pass.pe, K.forroAceso, false);
    }
  }
  // o teto de cada corpo: a coroa entre o contorno dele (com o balanço) e o do corpo de cima, ou a tampa no último
  const ultimo = corpos[corpos.length - 1];
  const topoTorre = [];
  for (let i = 0; i < nE; i++) {
    const q = pto(ultimo, ang(i), H, bal);
    topoTorre.push(q[0], q[2]);
  }
  tampa(g.opaco, topoTorre, y + H, g.fantasma || g.sombra ? K.marquise : K.solar, true);
  for (let k = 0; k + 1 < corpos.length; k++) {
    const c = corpos[k];
    const s = corpos[k + 1];
    const fora = [];
    const dentro = [];
    for (let i = 0; i < nE; i++) {
      const f = pto(c, ang(i), c.y1, bal);
      const d = pto(s, ang(i), c.y1);
      fora.push(f[0], f[2]);
      dentro.push(d[0], d[2]);
    }
    faixaEntre(g.opaco, fora, dentro, y + c.y1, g.fantasma || g.sombra ? K.marquise : K.jardim, true);
    if (g.sombra || g.fantasma) continue;
    // o terraço: o guarda-corpo de vidro na borda, a testa branca da laje e árvores pequenas no jardim
    for (let i = 0; i < nE; i++) {
      const t0 = ang(i);
      const t1 = ang(i + 1);
      const P = [pto(c, t0, c.y1, bal - 0.3), pto(c, t1, c.y1, bal - 0.3), pto(c, t1, c.y1 + 1.1, bal - 0.3), pto(c, t0, c.y1 + 1.1, bal - 0.3)];
      g.vidro.quad(...P, nrm(c, (t0 + t1) / 2, c.y1), [U[i], 0], [U[i + 1], 0], [U[i + 1], 1.1], [U[i], 1.1], vid(VIDRO.parapeito, 0.4));
      const T = [pto(c, t0, c.y1 - 0.6, bal), pto(c, t1, c.y1 - 0.6, bal), pto(c, t1, c.y1 + 0.1, bal), pto(c, t0, c.y1 + 0.1, bal)];
      g.opaco.quad(...T, nrm(c, (t0 + t1) / 2, c.y1), [U[i], 0], [U[i + 1], 0], [U[i + 1], 0.7], [U[i], 0.7], K.testa);
      if (i % 4 === 1 && g.arvores) {
        const [ax, , az] = pto(c, (t0 + t1) / 2, c.y1, -(a * (escEm(c, c.y1) - escEm(s, c.y1)) - bal) / 2);
        g.arvores.push({ x: ax, y: y + c.y1 + 0.1, z: az, especie: 'oiti', altura: 5 + 2 * hashF(i, k, 9), giro: hashF(i, k, 3) * 6.28 });
      }
    }
  }
  if (g.sombra) return;
  if (fuste && !g.fantasma) {
    // Helix: as duas espinhas de bronze nas pontas do eixo comprido, que sobem com a torção (mostram que ela gira)
    const passo = Math.ceil((fuste.y1 - fuste.y0) / (2 * pe));
    for (const t of [0, Math.PI]) {
      for (let j = 0; j < passo; j++) {
        const ya = fuste.y0 + ((fuste.y1 - fuste.y0) * j) / passo;
        const yc = fuste.y0 + ((fuste.y1 - fuste.y0) * (j + 1)) / passo;
        // a frente da espinha (1,7 m de largura, 1,2 m para fora do vidro) e os dois lados
        const dt = 0.85 / a;
        const F = [pto(fuste, t - dt, ya, 1.2), pto(fuste, t + dt, ya, 1.2), pto(fuste, t + dt, yc, 1.2), pto(fuste, t - dt, yc, 1.2)];
        g.opaco.quad(...F, nrm(fuste, t, (ya + yc) / 2), [0, ya], [1.7, ya], [1.7, yc], [0, yc], K.bronze);
        for (const s of [-1, 1]) {
          const tt = t + s * dt;
          const P = [pto(fuste, tt, ya, 0), pto(fuste, tt, ya, 1.2), pto(fuste, tt, yc, 1.2), pto(fuste, tt, yc, 0)];
          const nn = nrm(fuste, tt + s * Math.PI / 2, (ya + yc) / 2);
          g.opaco.quad(...P, nn, [0, ya], [1.2, ya], [1.2, yc], [0, yc], K.bronze);
        }
      }
    }
  }
  if (!g.fantasma) {
    // a borda do teto: a testa branca alta com o forro (a última marquise)
    for (let i = 0; i < nE; i++) {
      const t0 = ang(i);
      const t1 = ang(i + 1);
      const P = [pto(ultimo, t0, H - 1, bal), pto(ultimo, t1, H - 1, bal), pto(ultimo, t1, H + 1.4, bal), pto(ultimo, t0, H + 1.4, bal)];
      g.opaco.quad(...P, nrm(ultimo, (t0 + t1) / 2, H), [U[i], 0], [U[i + 1], 0], [U[i + 1], 2.4], [U[i], 2.4], K.testa);
      const F = [pto(ultimo, t0, H - 1), pto(ultimo, t1, H - 1), pto(ultimo, t1, H - 1, bal), pto(ultimo, t0, H - 1, bal)];
      g.opaco.quad(...F, [0, -1, 0], ...F.map((q) => [q[0], q[2]]), K.forro);
    }
    // a praça de pedra em volta do pódio
    tampa(g.opaco, aoMundo(elipse(a * 1.5 + 18, b * 1.5 + 18, 40), x, z, rot), y + 0.16, K.pisoClaro, true);
  }
  if (fuste) {
    // a lanterna da Helix: o vidro sobe além do teto num corte inclinado (mais alto do lado do parque), acesa à noite
    const base = g.vidro.vertices;
    const hl = (t) => 6 + 14 * (0.5 + 0.5 * Math.cos(t - Math.PI / 2));
    for (let i = 0; i <= nE; i++) {
      const t = ang(i);
      for (const hh of [0, hl(t)]) g.vidro.v(...pto(ultimo, t, H + hh, bal - 0.6), ...nrm(ultimo, t, H), U[i], hh, vid(VIDRO.lanterna, 0.6, 0, 1));
    }
    for (let i = 0; i < nE; i++) {
      const q = base + 2 * i;
      g.vidro.tri(q, q + 2, q + 3);
      g.vidro.tri(q, q + 3, q + 1);
    }
    // a face de dentro (vista do alto, o outro lado da lanterna)
    const dentro = g.vidro.vertices;
    for (let i = 0; i <= nE; i++) {
      const t = ang(i);
      const n = nrm(ultimo, t, H).map((v) => -v);
      for (const hh of [0, hl(t)]) g.vidro.v(...pto(ultimo, t, H + hh, bal - 0.7), ...n, U[i], hh, vid(VIDRO.lanterna, 0.6, 0, 1));
    }
    for (let i = 0; i < nE; i++) {
      const q = dentro + 2 * i;
      g.vidro.tri(q, q + 2, q + 3);
      g.vidro.tri(q, q + 3, q + 1);
    }
  } else {
    // a Compass: a grelha das máquinas (lâminas brancas verticais, o padrão da marquise), recuada da borda
    for (let i = 0; i < nE; i++) {
      const t0 = ang(i);
      const t1 = ang(i + 1);
      const P = [pto(ultimo, t0, H, -3), pto(ultimo, t1, H, -3), pto(ultimo, t1, H + 8, -3), pto(ultimo, t0, H + 8, -3)];
      const n = nrm(ultimo, (t0 + t1) / 2, H);
      g.opaco.quad(...P, n, [U[i], 0], [U[i + 1], 0], [U[i + 1], 8], [U[i], 8], K.marquise);
      if (!g.fantasma) g.opaco.quad(...P, n.map((v) => -v), [U[i], 0], [U[i + 1], 0], [U[i + 1], 8], [U[i], 8], K.marquise);
    }
  }
  if (coroa === 'agulha') {
    cilindro(g.opaco, x, z, y + H + 8, y + H + 46, 2.4, 0.18, 8, K.metalClaro, { topo: false });
    if (!g.fantasma) cilindro(g.opaco, x, z, y + H + 45, y + H + 46.5, 0.5, 0.3, 6, K.obstaculo, { topo: true });
  }
  g.caixa([x, y, z], a * 1.5 + bal + 2, H + (coroa === 'agulha' ? 46 : 15), a * 1.5 + bal + 2);
}

// ------------------------------------------------------------------------------------------------ o parque

/**
 * Anel de floresta em volta do lago (D88): o chão de mata escura; as árvores (a mata densa de copa redonda, as
 * emergentes e as embaúbas) vão para a vegetação (g.arvores), marcadas `mata` (o domínio deixa de fora as que a grade
 * da mata já desenha).
 */
function floresta(g, p) {
  const { cx, cz, r0, r1 } = p;
  // na cota do centro do pódio: a cava do lago desce o chão até uns 24 m além da borda, e o anel de floresta fica como
  // um deque plano sobre ela (do coroamento do lago à praça), sem degrau
  const y = g.chao(cx, cz);
  if (g.sombra || g.fantasma) return;
  const n = 64;
  for (let i = 0; i < n; i++) faixaArco(g.opaco, cx, cz, r0, r1, (360 * i) / n, (360 * (i + 1)) / n, y + 0.12, K.gramaEscura, true);
  if (!g.arvores) return;
  const passo = 6.5;
  for (let r = r0 + passo / 2; r < r1; r += passo) {
    const nA = Math.floor((2 * Math.PI * r) / passo);
    for (let i = 0; i < nA; i++) {
      const t = ((i + 0.6 * hashF(i, Math.round(r), 3)) / nA) * 360;
      const rr = r + (hashF(i, Math.round(r), 4) - 0.5) * passo * 0.5;
      const [x, z] = noArco(cx, cz, rr, t);
      const h = hashF(i, Math.round(r), 5);
      const especie = h < 0.12 ? 'embauba' : h < 0.3 ? 'mata1' : h < 0.75 ? 'mata2' : 'mata3';
      g.arvores.push({ x, y: y + 0.1, z, especie, mata: true });
    }
  }
}

/** Disco plano de raio R em (x, z) na cota y, com a borda de pedra de largura bw. */
function disco(m, x, z, R, y, k, bw = 0, kb = K.pedra, seg = 40) {
  tampa(m, aoMundo(elipse(R, R, seg), x, z, 0), y, k, true);
  if (bw > 0) faixaEntre(m, aoMundo(elipse(R, R, seg), x, z, 0), aoMundo(elipse(R + bw, R + bw, seg), x, z, 0), y + 0.01, kb, true);
}

/** Bosques de Supertrees: as que ficam a menos de `perto` metros umas das outras, com o centro e o raio de cada grupo. */
export function gruposDeSupertrees(pecas, perto = 90) {
  const st = pecas.filter((q) => q.tipo === 'supertree');
  const grupo = st.map((_, i) => i);
  const raiz = (i) => (grupo[i] === i ? i : (grupo[i] = raiz(grupo[i])));
  for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) if (Math.hypot(st[i].x - st[j].x, st[i].z - st[j].z) < perto) grupo[raiz(i)] = raiz(j);
  const mapa = new Map();
  st.forEach((q, i) => {
    const r = raiz(i);
    if (!mapa.has(r)) mapa.set(r, []);
    mapa.get(r).push(q);
  });
  return [...mapa.values()].map((l) => {
    const x = l.reduce((s, q) => s + q.x, 0) / l.length;
    const z = l.reduce((s, q) => s + q.z, 0) / l.length;
    const raio = Math.max(...l.map((q) => Math.hypot(q.x - x, q.z - z) + q.altura * 0.3)) + 10;
    return { x, z, raio, n: l.length };
  });
}

/**
 * Desenho do parque da margem do lago (D97): o passeio em anel de 6 m a 358 m, que a margem d'água interrompe nas 4
 * enseadas, com as palmeiras-imperiais dos dois lados; a praça de pedra clara dos bosques de Supertrees (a de pedra
 * portuguesa só na fita da borda), no máximo de `pracaMax` m de raio para não tocar a água nem o anel. O gramado, as
 * clareiras e a mata densa são do chão (mataDaSede e o uso do solo da sede), não de malha.
 */
export const PARQUE = Object.freeze({
  anel: { r: PASSEIO_DO_PARQUE.r, largura: PASSEIO_DO_PARQUE.largura },
  pracaMax: 30,
  // o passeio some onde a margem d'água chega a esta folga do eixo dele (m)
  folgaDaAgua: 8,
});

/**
 * O parque na margem do Mirror Lake grande (Burle Marx, o Aterro do Flamengo e o Ibirapuera; Gardens by the Bay): o
 * passeio em anel de 6 m com as palmeiras-imperiais dos dois lados, cortado onde a água chega nas enseadas (a Dream Fall
 * cai ali, e o passeio acaba num mirante de pedra), as praças de pedra clara com a fita de pedra portuguesa (o desenho de
 * ondas de Copacabana) em volta dos bosques de Supertrees e as copas em volta delas. Os bosques densos (a mata do parque,
 * mataDaSede) vêm da grade da mata pintada; sem ela, das árvores marcadas `mata`, de 7 em 7 m.
 */
function jardim(g, p, mata, pecas = []) {
  const { cx, cz, r0, r1 } = p;
  const y = g.chao(cx, cz);
  // no fantasma o gramado não entra: um véu transparente de 800 m sobre o parque só custaria pixel
  if (g.sombra || g.fantasma) return;
  const A = PARQUE;
  const livres = []; // [x, z, raio] onde não vai árvore (praças e mirantes)
  const pracas = [];
  const dentroDe = (L, x, z, folga = 0) => L.some(([qx, qz, qr]) => Math.hypot(x - qx, z - qz) < qr + folga);
  // o passeio em anel, em passos de 3 graus, onde a água deixa (mais as folgas do eixo das avenidas)
  const passo = 2;
  const naAgua = (g0) => raioDaMargem(g0) > A.anel.r - A.folgaDaAgua;
  // o vão das avenidas (16 m de cada lado do eixo): o passeio chega às calçadas e para
  const meiaAvenida = (Math.asin(16 / A.anel.r) / RAD) + passo / 2;
  for (let k = 0; k < 360 / passo; k++) {
    const a0 = k * passo;
    const a1 = a0 + passo;
    if (naAgua(a0) || naAgua(a1) || naAgua((a0 + a1) / 2)) continue;
    if (AVENIDAS.some((q) => Math.abs(difGraus((a0 + a1) / 2, q)) < meiaAvenida)) continue;
    faixaArco(g.opaco, cx, cz, A.anel.r - A.anel.largura / 2, A.anel.r + A.anel.largura / 2, a0, a1, y + 0.2, K.caminho, true);
  }
  // as praças dos bosques de Supertrees: o piso de pedra clara com a fita de pedra portuguesa na borda (o desenho de
  // Burle Marx como acento, não o chão inteiro)
  for (const b of gruposDeSupertrees(pecas)) {
    const R = Math.min(b.raio - 3.5, A.pracaMax);
    disco(g.opaco, b.x, b.z, R, y + 0.24, K.caminho, 3.5, K.portuguesa);
    pracas.push([b.x, b.z, R + 3.5]);
  }
  // os mirantes das enseadas: uma praça de pedra no fim do passeio, de frente para a queda
  for (const q of QUEDAS_ANGULOS) {
    for (const lado of [-1, 1]) {
      let a = q;
      while (a > q - 40 && a < q + 40 && raioDaMargem(a) > A.anel.r - A.folgaDaAgua) a += lado * passo;
      const [mx, mz] = noArco(cx, cz, A.anel.r, a + lado * 3);
      disco(g.opaco, mx, mz, 9, y + 0.23, K.caminho, 1.2, K.portuguesa, 24);
      livres.push([mx, mz, 10.2]);
    }
  }
  if (!g.arvores) return;
  // as palmeiras-imperiais dos dois lados do passeio (o Aterro do Flamengo), fora das praças e dos corredores das avenidas
  for (const rr of [A.anel.r - A.anel.largura / 2 - 3, A.anel.r + A.anel.largura / 2 + 3]) {
    const n = Math.floor((2 * Math.PI * rr) / 16);
    for (let i = 0; i < n; i++) {
      const t = (360 * (i + 0.5)) / n;
      if (naAgua(t)) continue;
      if (AVENIDAS.some((a) => Math.abs(difGraus(t, a)) * RAD * rr < 22)) continue;
      const [x, z] = noArco(cx, cz, rr, t);
      if (dentroDe(pracas, x, z, 2) || dentroDe(livres, x, z, 1)) continue;
      g.arvores.push({ x, y: y + 0.2, z, especie: 'palmeira', altura: 18 + 4 * hashF(i, Math.round(rr), 11), giro: hashF(i, 7, Math.round(rr)) * 6.28 });
    }
  }
  // as copas em volta das praças dos bosques de Supertrees (a sombra das bordas, como em Gardens by the Bay)
  for (const [px, pz, pr] of pracas) {
    if (pr < 20) continue;
    const n = Math.floor((2 * Math.PI * (pr + 6)) / 13);
    for (let i = 0; i < n; i++) {
      const t = (2 * Math.PI * (i + 0.3 * hashF(i, Math.round(px), 4))) / n;
      const x = px + Math.cos(t) * (pr + 6);
      const z = pz + Math.sin(t) * (pr + 6);
      if (Math.hypot(x - cx, z - cz) > r1 + 3 || dentroDe(livres, x, z) || raioDaMargem((Math.atan2(z - cz, x - cx) / RAD + 360) % 360) > Math.hypot(x - cx, z - cz) - 12) continue;
      const h = hashF(i, Math.round(pz), 13);
      g.arvores.push({ x, y: y + 0.2, z, especie: h < 0.5 ? 'oiti' : h < 0.8 ? 'mata2' : 'mata1', giro: h * 6.28 });
    }
  }
  // os bosques densos (a mata do parque) como árvores, para quando a grade da mata não os desenha: de 7 em 7 m. As grandes
  // (a emergente de guarda-chuva a 32 a 40 m, o jequitibá, e a copa redonda larga a 24 a 30 m, a figueira) em 1 de cada 9
  if (mata) {
    for (let r = r0 + 5; r < r1 - 4; r += 7) {
      const nA = Math.floor((2 * Math.PI * r) / 7);
      for (let i = 0; i < nA; i++) {
        const t = ((i + 0.7 * hashF(i, Math.round(r), 6)) / nA) * 360;
        const [x, z] = noArco(cx, cz, r + (hashF(i, Math.round(r), 7) - 0.5) * 4, t);
        if ((mata(x, z) ?? 0) < 0.6 || dentroDe(pracas, x, z, 2) || dentroDe(livres, x, z)) continue;
        g.arvores.push({ x, y: y + 0.1, z, ...arvoreDaMata(hashF(i, Math.round(r), 8), hashF(i, 3, Math.round(r))), mata: true });
      }
    }
  }
}

/**
 * Uma árvore da Mata Atlântica pelo sorteio h (0 a 1): a vegetação da R2b tem a emergente de copa em guarda-chuva (mata1:
 * o jequitibá-rosa, de 30 a 50 m), a de copa redonda (mata2: a figueira, larga), a estreita (mata3), a embaúba, o oiti e
 * a palmeira (a juçara, de 5 a 20 m). O tamanho vem de `v`: as grandes de 25 a 40 m são 1 em cada 9.
 */
export function arvoreDaMata(h, v) {
  if (h < 0.11) return { especie: 'mata1', altura: 28 + 12 * v, giro: v * 6.28 };
  if (h < 0.22) return { especie: 'mata2', altura: 22 + 8 * v, giro: v * 6.28 };
  if (h < 0.34) return { especie: 'embauba' };
  if (h < 0.5) return { especie: 'mata1' };
  if (h < 0.85) return { especie: 'mata2' };
  if (h < 0.93) return { especie: 'palmeira', altura: 7 + 5 * v };
  return { especie: 'mata3' };
}

/**
 * Supertree (Gardens by the Bay, Singapura): o tronco é um jardim vertical (samambaias, bromélias e orquídeas) atrás da
 * treliça de aço em losangos, com 8 barras em diagonal cruzadas por fora; a copa larga em funil é uma malha de aço
 * (nervuras, anéis e diagonais) com parte das células plantadas e o resto aberto, o céu passando por ela (as duas faces
 * do funil, o padrão malha corta as células abertas de perto); 16 nervuras grossas desenham a silhueta e o aro fecha o
 * alto. De 25 a 50 m, em grupos (o dado); a malha e a treliça acendem à noite no espetáculo de luz. Nunca varetas: de
 * longe o funil lê cheio, como a copa de verdade.
 */
function supertree(g, p) {
  const y = g.chao(p.x, p.z);
  const h = p.altura;
  const lod = g.lod ?? 1;
  const rb = Math.max(2.6, h * 0.075);
  const rm = rb * 0.62;
  const tronco = [[rb, 0], [rb * 0.86, 0.1], [rm, 0.36], [rm * 1.08, 0.56], [rm * 1.55, 0.66]].map(([r, t]) => [r, y + h * t]);
  const R = h * 0.3;
  // o funil: do pescoço ao aro, abrindo em curva (a copa de verdade é mais funda no meio e larga em cima)
  const funil = [[rm * 1.55, 0.66], [h * 0.09, 0.72], [h * 0.15, 0.8], [h * 0.22, 0.89], [R, 1.0]];
  if (lod === 0) {
    // de perto (o setor do parque): as 8 barras em diagonal por fora do tronco, as 16 nervuras grossas do funil (a
    // silhueta de lado) e o anel do meio
    const m = g.setor ? g.setor(SETOR_PARQUE).opaco : g.opaco;
    const raioEm = (t) => {
      for (let j = 0; j + 1 < tronco.length; j++) {
        const [ra, ya] = tronco[j];
        const [rbb, yb2] = tronco[j + 1];
        if (y + h * t <= yb2 + 1e-6) return ra + ((rbb - ra) * (y + h * t - ya)) / Math.max(1e-6, yb2 - ya);
      }
      return tronco[tronco.length - 1][0];
    };
    for (let s = 0; s < 8; s++) {
      const sentido = s % 2 ? 1 : -1;
      const pts = [0.04, 0.24, 0.44, 0.64].map((t, j) => {
        const ang = (s / 8) * Math.PI * 2 + sentido * j * 0.55;
        const r = raioEm(t) + 0.35;
        return [p.x + Math.cos(ang) * r, y + h * t, p.z + Math.sin(ang) * r];
      });
      for (let j = 0; j + 1 < pts.length; j++) barra(m, pts[j], pts[j + 1], 0.2, 3, K.trelica);
    }
    for (let s = 0; s < 16; s++) {
      const ang = ((s + 0.5) / 16) * Math.PI * 2;
      const pts = funil.map(([r, t]) => [p.x + Math.cos(ang) * (r + 0.25), y + h * t, p.z + Math.sin(ang) * (r + 0.25)]);
      for (let j = 0; j + 1 < pts.length; j++) barra(m, pts[j], pts[j + 1], 0.22, 3, K.trelica);
    }
    torno(m, p.x, p.z, [[h * 0.22 + 0.3, y + h * 0.89 - 0.3], [h * 0.22 + 0.3, y + h * 0.89 + 0.3]], 16, K.trelica);
    return;
  }
  const m = g.opaco;
  if (g.sombra) {
    torno(m, p.x, p.z, tronco, 8, K.granito);
    torno(m, p.x, p.z, funil.map(([r, t]) => [r, y + h * t]), 12, K.granito);
    return;
  }
  if (g.fantasma) {
    // o holograma da Supertree é o esqueleto dela: o tronco, 8 nervuras do funil e o aro do topo. O funil cheio, num
    // véu claro visto do alto, lia como um cogumelo
    torno(m, p.x, p.z, tronco, 8, K.tronco);
    for (let s = 0; s < 8; s++) {
      const ang = (s / 8) * Math.PI * 2;
      const pts = funil.map(([r, t]) => [p.x + Math.cos(ang) * r, y + h * t, p.z + Math.sin(ang) * r]);
      for (let j = 0; j + 1 < pts.length; j++) barra(m, pts[j], pts[j + 1], 0.3, 3, K.trelica);
    }
    torno(m, p.x, p.z, [[R, y + h - 0.6], [R, y + h + 0.6]], 16, K.trelica);
    g.caixa([p.x, y, p.z], R, h);
    return;
  }
  // o tronco vivo (o jardim vertical com a treliça em losangos no shader)
  torno(m, p.x, p.z, tronco, 12, K.tronco);
  // a copa: a malha em funil nas duas faces (uv: x em nervuras, uma a cada 15 graus; y em anéis de 2,5 m da inclinação)
  const nS = 16;
  const fp = funil.map(([r, t]) => [r, y + h * t]);
  const sl = [0];
  for (let j = 1; j < fp.length; j++) sl.push(sl[j - 1] + Math.hypot(fp[j][0] - fp[j - 1][0], fp[j][1] - fp[j - 1][1]));
  for (const face of [1, -1]) {
    const base = m.vertices;
    for (let j = 0; j < fp.length; j++) {
      const [r, yy] = fp[j];
      const ja = Math.max(0, j - 1);
      const jb = Math.min(fp.length - 1, j + 1);
      const dr = fp[jb][0] - fp[ja][0];
      const dy = fp[jb][1] - fp[ja][1];
      const l = Math.hypot(dr, dy) || 1;
      for (let s = 0; s <= nS; s++) {
        const ang = (s / nS) * Math.PI * 2;
        const c = Math.cos(ang);
        const sn = Math.sin(ang);
        // a normal de fora do funil aponta para baixo e para fora; a de dentro, para cima e para o eixo
        m.v(p.x + c * r, yy, p.z + sn * r, ((c * dy) / l) * face, (-dr / l) * face, ((sn * dy) / l) * face, (s / nS) * 24, sl[j] / 2.5, K.copa);
      }
    }
    const L = nS + 1;
    for (let j = 0; j + 1 < fp.length; j++) for (let s = 0; s < nS; s++) {
      const q = base + j * L + s;
      m.tri(q, q + 1, q + L + 1);
      m.tri(q, q + L + 1, q + L);
    }
  }
  // o aro do topo e o jardim do pé
  torno(m, p.x, p.z, [[R + 0.3, y + h - 0.6], [R + 0.3, y + h + 0.5]], 20, K.trelica);
  cilindro(m, p.x, p.z, y - 0.2, y + 0.6, rb + 2.4, rb + 2.4, 16, K.pedra, { topo: false });
  tampa(m, aoMundo(elipse(rb + 2.4, rb + 2.4, 16), p.x, p.z, 0), y + 0.55, K.jardim, true);
  g.caixa([p.x, y, p.z], R, h);
}

/**
 * Passarela entre as Supertrees (a OCBC Skyway): tabuleiro de 2,6 m a `cota` metros, com a viga branca, o piso de
 * madeira e o guarda-corpo de vidro, de tronco em tronco.
 */
function passarela(g, p) {
  const { pontos, cota, largura } = p;
  if (g.sombra) return;
  const w = largura / 2;
  for (let i = 0; i + 3 < pontos.length; i += 2) {
    const ax = pontos[i], az = pontos[i + 1], bx = pontos[i + 2], bz = pontos[i + 3];
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 1e-6) continue;
    const ux = (bx - ax) / L;
    const uz = (bz - az) / L;
    const ya = g.chao(ax, az) + cota;
    const yb = g.chao(bx, bz) + cota;
    const ym = (ya + yb) / 2;
    caixa(g.opaco, (ax + bx) / 2, (az + bz) / 2, L / 2, w, ym - 0.8, ym, K.marquise, { ux, uz, base: true });
    g.caixa([(ax + bx) / 2, ym - 1, (az + bz) / 2], L / 2 + 2, 3, L / 2 + 2);
    if (g.fantasma) continue;
    caixa(g.opaco, (ax + bx) / 2, (az + bz) / 2, L / 2, w - 0.1, ym, ym + 0.05, K.deck, { ux, uz });
    for (const s of [-1, 1]) {
      const ox = -uz * s * (w - 0.05);
      const oz = ux * s * (w - 0.05);
      g.vidro.quad([ax + ox, ym, az + oz], [bx + ox, ym, bz + oz], [bx + ox, ym + 1.1, bz + oz], [ax + ox, ym + 1.1, az + oz], [-uz * s, 0, ux * s], [0, 0], [L, 0], [L, 1.1], [0, 1.1], vid(VIDRO.parapeito, 0.2));
    }
  }
}

/** Tipos de peça que viram volumes aqui (a água é do lagos.js e a ponte do pontes.js; a torre, do torre.js). */
export const PECAS = Object.freeze({ podio, anel, cachoeira, fontes, codex, oval, floresta, jardim, supertree, passarela, ponte, ...PECAS_DE_AGUA });

/** Peças com detalhe em geometria no LOD0 (por setor: as marquises e as Supertrees); as outras iguais nos dois LODs. */
export const PECAS_COM_LOD = Object.freeze(new Set(['anel', 'oval', 'supertree']));

/**
 * Monta as peças de uma parte nas malhas do destino.
 * @param {{ id: string, pecas: object[] }} parte
 * @param {{ chao: (x: number, z: number) => number, vidro: Malha, opaco: Malha, efeitos?: Malha, jatos?: object[],
 *   arvores?: object[], nivelAgua?: number, lod?: 0 | 1, sombra?: boolean, fantasma?: boolean, so?: (p) => boolean,
 *   setor?: (s: number) => { opaco: Malha }, mata?: (x, z) => number | null }} destino
 *   lod 1: a casca e o resto; lod 0: só as marquises dos setores (em setor(s), ou em opaco). sombra: só o volume que
 *   projeta. arvores: a lista de árvores para a vegetação ({ x, y, z, especie, altura?, mata? }).
 * @returns {{ caixas: number[][], trechos: (string | null)[] }}  caixas [x0, y0, z0, x1, y1, z1] por peça (a seleção e a
 *   câmera usam) e o id do trecho de cada uma (os do Horizon Ring)
 */
export function montarParte(parte, destino) {
  const caixas = [];
  const trechos = [];
  const g = {
    lod: 1,
    ...destino,
    // caixa alinhada aos eixos: meia largura em x (e em z, se meiaZ não vier), altura h a partir de c[1]
    caixa: (c, meia, h, meiaZ = meia, trecho = null) => {
      caixas.push([c[0] - meia, c[1], c[2] - meiaZ, c[0] + meia, c[1] + h, c[2] + meiaZ]);
      trechos.push(trecho?.startsWith?.('horizon.') ? trecho : null);
    },
  };
  for (const p of parte.pecas) {
    if (destino.so && !destino.so(p)) continue;
    const fn = PECAS[p.tipo];
    if (!fn) continue;
    if (g.lod === 0 && !PECAS_COM_LOD.has(p.tipo)) continue;
    if (fn === oval) fn(g, p, SETOR_OVAL[parte.id] ?? SETOR_SEM);
    else if (fn === jardim) fn(g, p, destino.mata ?? null, parte.pecas);
    else fn(g, p);
  }
  return { caixas, trechos };
}

/** Malhas novas para montar partes (atalho dos testes e do fantasma). */
export function malhasNovas() {
  return { vidro: new Malha('vidro'), opaco: new Malha('opaco'), efeitos: new Malha('cascata'), agua: new Malha('agua'), jatos: [], arvores: [] };
}
