// A sede v3 no render (D88 a D90) e o domínio 'arcologia': o Park of Future Dreams no disco da gleba, com a Blade
// Tower e a Legacy Tower no pódio (torre.js), o Mirror Lake (lago.js), as partes (partes.js: os dois anéis, as torres
// do bosque, as Dream Falls, as fontes e o parque) e a paisagem do disco (a praça do pódio, os caminhos em anel, os
// bosques, o anel viário, as 8 avenidas e os portões). No jogo, cada parte aparece pronta quando as etapas dela ficam
// prontas no espelho (a obra por etapas é da X1b) e, antes disso, como fantasma com a silhueta de verdade (D26); o lago
// só aparece de verdade quando o chão já foi cavado (o aplainar). As cenas pedem outras vistas pelo domínio:
//   ctx.dominio('arcologia').vitrine({ modo: 'torre' })   o par no pódio, pronto (sem o resto da sede)
//   ctx.dominio('arcologia').vitrine({ modo: 'plano' })   a sede inteira construída, com a paisagem e as vias internas
//   ctx.dominio('arcologia').vitrine({ modo: 'jogo', etapas, vias })   o jogo com estas etapas (a obra, as prontas e
//                                                         os fantasmas); vias desenha as vias internas do plano
//   ctx.dominio('arcologia').vitrine(null)                volta ao jogo
// A obra (X1b, obra.js): com o par em obra, as torres aparecem cortadas por lado (a Legacy um passo atrás, a Dream Bridge
// só quando as duas passam de 330 m), o pódio sobe com elas, o fantasma fica só acima do corte e as gruas acompanham;
// com a lago.e1 em obra, o leito de terra, o tapume e o canteiro. Com o lago pronto, os portões e a praça do pódio.
// LOD por setor (D66): os 8 trechos do Horizon Ring, os 8 oitavos do Meridian Ring e as duas torres ovais trocam as
// marquises do shader pelas de geometria quando a câmera chega perto de cada um (o uniforme uLodSetor avisa o vidro).
// Desempenho: um material por tipo (o conjunto fixo de torre.js), todos compilados na carga (criarAquecimento); nada
// muda de programa entre o dia, a noite, os LODs e o fantasma.
import * as THREE from 'three';
import { alturaEm } from '../../comum/altura.js';
import { ETAPA } from '../../contratos/flags.js';
import {
  PLANOS, PLANO_ESCOLHIDO, PLANO_PADRAO, PARTES_ORDEM, GLEBA_ENVELOPE, TORRE_LAMINA, ANEL_VIARIO, AVENIDAS, mataDaSede,
  TRECHOS_HORIZON, TORRE_IRMA, MIRROR, HALO, raioDaMargem, pontoDoArco, PRACA,
} from '../../data/arcologia-plano.js';
import {
  criarPar, atualizarArcologia, estadoDoCeu, materiais, descartarMateriais, geometriaDe, Malha, acab, PADRAO, tampa,
  caixa, malhasPar, criarJatos, criarAquecimento, DIST_EFEITOS, UNIFORMES, orientar, hashF, MEIO_VAO_CORTE, SETORES,
} from './torre.js';
import { montarParte, setorDoAnel, SETOR_OVAL, SETOR_PARQUE, difGraus, arvoreDaMata } from './partes.js';
import { materialAgua, quadroAgua } from './lago.js';
import { materialFantasma, malhaFantasma, criarFantasma } from './fantasma.js';
import { estadoObra, criarObra, alturaVidro } from './obra.js';

const RAD = Math.PI / 180;

/** Plano que o jogo mostra: o do espelho, o escolhido ou o padrão (a sede v3). */
export function planoDoJogo(esp) {
  const id = esp?.arcologia?.plano ?? PLANO_ESCOLHIDO ?? PLANO_PADRAO;
  return PLANOS[id] ? id : PLANO_PADRAO;
}

/** Estado de uma etapa no espelho (ETAPA.*), TRANCADA se não existir. */
export function estadoEtapa(esp, id) {
  return esp?.arcologia?.etapas?.find((e) => e.id === id)?.estado ?? ETAPA.TRANCADA;
}

/**
 * Partes prontas no espelho (ids de PARTES_ORDEM e dos trechos do Horizon Ring): a torre com a torre.e4 (D49), o lago
 * com a lago.e1; as outras quando todas as etapas delas (id igual ou que começa com "<id>.") estão prontas.
 * @returns {Set<string>}
 */
export function partesProntas(esp) {
  const etapas = esp?.arcologia?.etapas ?? [];
  const prontas = new Set();
  if (estadoEtapa(esp, 'torre.e4') === ETAPA.PRONTA) prontas.add('torre');
  if (estadoEtapa(esp, 'lago.e1') === ETAPA.PRONTA) prontas.add('lago');
  const ids = [...PARTES_ORDEM.filter((p) => p !== 'torre' && p !== 'lago' && p !== 'horizon'), ...TRECHOS_HORIZON.map((t) => t.id)];
  for (const id of ids) {
    const delas = etapas.filter((e) => e.id === id || e.id.startsWith(`${id}.`));
    if (delas.length && delas.every((e) => e.estado === ETAPA.PRONTA)) prontas.add(id);
  }
  return prontas;
}

/** Cota do chão num ponto: a do terreno (a plataforma do aplainar), ou a da gleba sem terreno. */
export function cotaEm(T, x, z) {
  return T?.altura ? alturaEm(T, x, z) : GLEBA_ENVELOPE.cota;
}

/** Centro do plano (o do pódio). A cota da gleba se mede ali: o centro do pódio fica fora da cava do lago. */
export const centroDoPlano = (P) => P.centro;

/** O anel d'água do pódio (a bacia do Mirror Lake, com as fontes) de um plano. */
export const reservatorioDe = (P) => P.partes.find((p) => p.id === 'lago').pecas.find((p) => p.tipo === 'reservatorio');

/** O Mirror Lake grande (a cava) de um plano. */
export const lagoDe = (P) => P.partes.find((p) => p.id === 'lago').pecas.find((p) => p.tipo === 'lago');

/** Um ponto na água do anel do pódio (no meio do anel, ao sul do pódio). */
export function pontoNaAgua(res) {
  return [res.cx, res.cz + (res.r0 + res.r1) / 2];
}

/**
 * Um ponto no Mirror Lake grande, fora das avenidas, das ilhas e das enseadas (a 67,5 graus, a 240 m do centro): lá o chão
 * cavado fica a 2,6 m do nível da gleba, e é por ele que o domínio sabe se a cava já foi feita. (Nas avenidas, no jogo, o
 * aplainar da via deixa o aterro.)
 */
export function pontoNoLago(lago) {
  return pontoDoArco(lago.cx, lago.cz, 240, 67.5);
}

// ================================================================================================ paisagem

const KP = {
  pisoClaro: acab('#c4baa8', { rugo: 0.78, padrao: PADRAO.piso }),
  piso: acab('#b1a797', { rugo: 0.8, padrao: PADRAO.piso }),
  gramaEscura: acab('#46532f', { rugo: 0.95, padrao: PADRAO.grama }),
  asfalto: acab('#2c2e31', { rugo: 0.85 }),
  calcada: acab('#a39c90', { rugo: 0.8, padrao: PADRAO.piso }),
  canteiro: acab('#46532f', { rugo: 0.95, padrao: PADRAO.grama }),
  pedra: acab('#c3b79f', { rugo: 0.72, padrao: PADRAO.pedra }),
  champanhe: acab('#b8a684', { rugo: 0.32, metal: 1, padrao: PADRAO.metal }),
};

/** Coroa plana de r0 a r1 entre os ângulos a0 e a1 (graus), na cota y, em n trechos. uv = (x, z). */
function coroa(m, cx, cz, r0, r1, y, k, n = 96, a0 = 0, a1 = 360) {
  for (let i = 0; i < n; i++) {
    const t0 = (a0 + ((a1 - a0) * i) / n) * RAD;
    const t1 = (a0 + ((a1 - a0) * (i + 1)) / n) * RAD;
    const P = [[r0, t0], [r0, t1], [r1, t1], [r1, t0]].map(([r, t]) => [cx + r * Math.cos(t), y, cz + r * Math.sin(t)]);
    m.quad(...P, [0, 1, 0], ...P.map((q) => [q[0], q[2]]), k);
  }
}

/**
 * Faixa reta de largura w do raio r0 ao r1 no eixo da avenida de ângulo a (graus), deslocada o metros para o lado, na
 * cota y. uv = (x, z).
 */
function faixaRadial(m, cx, cz, a, r0, r1, w, o, y, k) {
  const ux = Math.cos(a * RAD);
  const uz = Math.sin(a * RAD);
  const P = [[r0, o - w / 2], [r1, o - w / 2], [r1, o + w / 2], [r0, o + w / 2]].map(([r, l]) => [cx + ux * r - uz * l, y, cz + uz * r + ux * l]);
  m.quad(...P, [0, 1, 0], ...P.map((q) => [q[0], q[2]]), k);
}

/**
 * Coroa de r0 a r1 com os vãos das 8 avenidas radiais (meia largura `meia` em volta de cada eixo): o chão dos bosques,
 * os caminhos e o gramado não cobrem as pistas.
 */
export function coroaEntreAvenidas(m, cx, cz, r0, r1, y, k, meia = 16) {
  const d = Math.asin(Math.min(1, meia / r0)) / RAD;
  for (const a of AVENIDAS) {
    const a0 = a + d;
    const a1 = a + 45 - d;
    if (a1 - a0 < 0.5) continue;
    coroa(m, cx, cz, r0, r1, y, k, Math.max(1, Math.ceil(((a1 - a0) * RAD * r1) / 45)), a0, a1);
  }
}

/** Faixas de raio onde as avenidas passam sob os anéis (sem palmeiras: a copa bateria nas marquises). */
function sobAneis(plano) {
  const raios = new Map();
  for (const p of plano.partes.flatMap((q) => q.pecas)) if (p.tipo === 'anel') raios.set(p.raio, p.fundo);
  return [...raios].map(([r, f]) => [r - f / 2 - 10, r + f / 2 + 10]);
}

/** Faixas de raio onde a avenida de ângulo a passa pelo pórtico de uma torre do bosque (sem palmeiras sob o teto de 18 m). */
function sobTorres(plano, a) {
  const [cx, cz] = plano.centro;
  return plano.partes
    .flatMap((q) => q.pecas)
    .filter((p) => (p.tipo === 'codex' || p.tipo === 'oval') && p.passagem)
    .filter((p) => Math.abs(((Math.atan2(p.z - cz, p.x - cx) / RAD - a + 540) % 360) - 180) < 1)
    .map((p) => {
      const r = Math.hypot(p.x - cx, p.z - cz);
      return [r - 34, r + 34];
    });
}

/** O intervalo [a, b] sem os cortes (lista de [c0, c1] ordenada ou não): os pedaços que sobram. */
export function recortar([a, b], cortes) {
  let sobra = [[a, b]];
  for (const [c0, c1] of cortes) {
    sobra = sobra.flatMap(([x0, x1]) => (c1 <= x0 || c0 >= x1 ? [[x0, x1]] : [[x0, Math.min(x1, c0)], [Math.max(x0, c1), x1]].filter(([u, w]) => w - u > 0.5)));
  }
  return sobra;
}

/**
 * Avenida de 24 m (calçada 3, pista 7, canteiro 4 com palmeiras-imperiais, pista 7, calçada 3): em arco (o anel viário,
 * de `de` a `ate`, com o canteiro parando 16 m antes das avenidas radiais) ou radial (de r0 a r1, com o canteiro
 * parando 16 m antes do anel viário e as palmeiras fora dos pórticos dos anéis e das torres, `semPalmas`; `semVia` são os
 * trechos de raio que a ponte baixa do lago veste).
 */
function avenida(m, arvores, cx, cz, y, v, semPalmas = [], semVia = []) {
  const w = v.largura ?? 24;
  const calc = 3;
  const cant = 4;
  const pista = (w - 2 * calc - cant) / 2;
  const off = cant / 2 + pista / 2;
  const palma = (x, z, s) => arvores?.push({ x, y: y + 0.2, z, especie: 'palmeira', altura: 17 + 4 * hashF(Math.round(x), Math.round(z), s), giro: hashF(Math.round(z), Math.round(x), 3) * 6.28 });
  if (v.arco) {
    const { r, de, ate } = v.arco;
    const n = Math.max(4, Math.ceil(((ate - de) * RAD * r) / 14));
    coroa(m, cx, cz, r - w / 2, r + w / 2, y + 0.1, KP.calcada, n, de, ate);
    coroa(m, cx, cz, r - off - pista / 2, r - off + pista / 2, y + 0.13, KP.asfalto, n, de, ate);
    coroa(m, cx, cz, r + off - pista / 2, r + off + pista / 2, y + 0.13, KP.asfalto, n, de, ate);
    const folga = (16 / r) / RAD;
    const a0 = de + folga;
    const a1 = ate - folga;
    coroa(m, cx, cz, r - cant / 2, r + cant / 2, y + 0.16, KP.canteiro, Math.max(1, Math.ceil(((a1 - a0) * RAD * r) / 14)), a0, a1);
    for (let s = 7; s < (a1 - a0) * RAD * r - 3; s += 14) {
      const t = (a0 + (s / r) / RAD) * RAD;
      palma(cx + r * Math.cos(t), cz + r * Math.sin(t), 1);
    }
    return;
  }
  const { a, r0, r1 } = v;
  const ra = Math.min(r0, r1);
  const rb = Math.max(r0, r1);
  // a avenida sobre o lago e a ponte baixa (a ponte tem a própria pista): só os pedaços fora do lago
  const trechos = recortar([ra, rb], semVia);
  for (const [t0, t1] of trechos) {
    faixaRadial(m, cx, cz, a, t0, t1, w, 0, y + 0.1, KP.calcada);
    faixaRadial(m, cx, cz, a, t0, t1, pista, -off, y + 0.13, KP.asfalto);
    faixaRadial(m, cx, cz, a, t0, t1, pista, off, y + 0.13, KP.asfalto);
    const c1 = Math.min(t1, ANEL_VIARIO.raio - 16);
    if (c1 - t0 >= 2) faixaRadial(m, cx, cz, a, t0, c1, cant, 0, y + 0.16, KP.canteiro);
  }
  const c1 = Math.min(rb, ANEL_VIARIO.raio - 16);
  for (let s = ra + 7; s < c1 - 3; s += 14) {
    if (semPalmas.some(([q0, q1]) => s > q0 && s < q1)) continue;
    if (!trechos.some(([t0, t1]) => s > t0 + 1 && s < t1 - 1)) continue;
    palma(cx + Math.cos(a * RAD) * s, cz + Math.sin(a * RAD) * s, 2);
  }
}

/** Portão: dois pilares de pedra e a verga champanhe sobre a avenida, de frente para quem chega (ângulo a, graus). */
function portao(m, x, z, a, y) {
  const tx = Math.cos(a * RAD);
  const tz = Math.sin(a * RAD);
  const rx = -tz;
  const rz = tx;
  for (const s of [-1, 1]) caixa(m, x + rx * 17 * s, z + rz * 17 * s, 2.2, 2.2, y - 1, y + 16, KP.pedra, { ux: tx, uz: tz });
  caixa(m, x, z, 1.2, 19.5, y + 13.8, y + 15.2, KP.champanhe, { ux: tx, uz: tz, base: true });
}

/**
 * Árvores de um bosque em anel (de r0 a r1): grade polar mexida, uma árvore onde a mata do parque (mataDaSede) passa
 * de 0,6. Marcadas `mata`: quando a grade da mata já tem o parque pintado, o domínio deixa de fora.
 */
function bosque(arvores, cx, cz, r0, r1, densidade, y) {
  const passo = 1 / Math.sqrt(densidade);
  for (let r = r0 + passo / 2; r < r1; r += passo) {
    const n = Math.floor((2 * Math.PI * r) / passo);
    for (let i = 0; i < n; i++) {
      const t = ((i + 0.7 * hashF(i, Math.round(r), 3)) / n) * 360;
      const rr = r + (hashF(i, Math.round(r), 4) - 0.5) * passo * 0.6;
      const x = cx + rr * Math.cos(t * RAD);
      const z = cz + rr * Math.sin(t * RAD);
      if ((mataDaSede(x, z) ?? 0) < 0.6) continue;
      arvores?.push({ x, y: y + 0.1, z, ...arvoreDaMata(hashF(i, Math.round(r), 5), hashF(i, 3, Math.round(r))), mata: true });
    }
  }
}

/**
 * As vias internas do plano (só nas cenas; no jogo são do grafo): o anel viário e as avenidas, com o canteiro e as palmeiras
 * fora dos pórticos dos anéis e das torres; com o lago pronto (`lago`), as avenidas saem do desenho no trecho em que a
 * ponte baixa de pedra do Mirror Lake as veste.
 */
function viasDoPlano(plano, { cota, opaco, arvores, lago }) {
  const [cx, cz] = plano.centro;
  const aneis = sobAneis(plano);
  for (const v of plano.vias) {
    if (v.anel) {
      avenida(opaco, arvores, cx, cz, cota, v);
      continue;
    }
    const ra = Math.hypot(v.pontos[0] - cx, v.pontos[1] - cz);
    const rb = Math.hypot(v.pontos[2] - cx, v.pontos[3] - cz);
    const a = Math.atan2(v.pontos[1] - cz, v.pontos[0] - cx) / RAD;
    const ang = (a + 360) % 360;
    const semVia = lago ? [[MIRROR.r0 - 0.5, raioDaMargem(ang) + 8]] : [];
    avenida(opaco, arvores, cx, cz, cota, { ...v, a, r0: ra, r1: rb }, [...aneis, ...sobTorres(plano, ang)], semVia);
  }
}

/**
 * Paisagem da sede: a praça de pedra clara do pódio (onde as avenidas acabam), os caminhos em anel do modelo (480 e
 * 688 m), o chão e as árvores dos bosques (entre os anéis e atrás do Horizon Ring), os portões nas 8 avenidas e, com
 * `vias`, o anel viário e as avenidas (só nas cenas: no jogo as vias internas são do grafo, ligadas pela X1b). Tudo na
 * cota da gleba (o platô é plano). As árvores vão para a lista (a vegetação desenha).
 */
export function montarPaisagem(plano, { cota, opaco, arvores = null, vias = true, lago = false }) {
  const P = plano.paisagem;
  const [cx, cz] = plano.centro;
  const y = cota;
  // praça do pódio, com a faixa de pedra na borda
  coroa(opaco, cx, cz, P.praca.r0, P.praca.r1, y + 0.2, KP.pisoClaro, 128);
  coroa(opaco, cx, cz, P.praca.r1 - 2, P.praca.r1, y + 0.22, KP.pedra, 128);
  for (const c of P.caminhos) coroaEntreAvenidas(opaco, cx, cz, c.r - c.largura / 2, c.r + c.largura / 2, y + 0.22, KP.piso);
  for (const b of P.bosques) {
    // o chão de mata escura, em coroas de até 60 m entre as avenidas (o lado de cada quadrilátero fica abaixo de 45 m)
    const nr = Math.max(1, Math.ceil((b.r1 - b.r0) / 60));
    for (let j = 0; j < nr; j++) {
      const ra = b.r0 + ((b.r1 - b.r0) * j) / nr;
      const rb = b.r0 + ((b.r1 - b.r0) * (j + 1)) / nr;
      coroaEntreAvenidas(opaco, cx, cz, ra, rb, y + 0.14, KP.gramaEscura);
    }
    bosque(arvores, cx, cz, b.r0, b.r1, b.densidade, y);
  }
  for (const g of plano.portoes) portao(opaco, g.x, g.z, g.angulo, y);
  if (!vias) return;
  viasDoPlano(plano, { cota: y, opaco, arvores, lago });
}

/**
 * O que a lago.e1 entrega da paisagem (X1b): a praça de pedra do pódio, onde as avenidas internas acabam, e os portões
 * nas 8 avenidas; com `vias`, as vias internas do plano (nas cenas, que não têm o grafo do jogo).
 */
export function montarPortoes(plano, { cota, opaco, arvores = null, vias = false, lago = false }) {
  const P = plano.paisagem;
  const [cx, cz] = plano.centro;
  coroa(opaco, cx, cz, P.praca.r0, P.praca.r1, cota + 0.2, KP.pisoClaro, 128);
  coroa(opaco, cx, cz, P.praca.r1 - 2, P.praca.r1, cota + 0.22, KP.pedra, 128);
  for (const g of plano.portoes) portao(opaco, g.x, g.z, g.angulo, cota);
  if (!vias) return;
  viasDoPlano(plano, { cota, opaco, arvores, lago });
}

// ================================================================================================ o plano em malhas

/**
 * Onde cada setor do LOD0 fica (para a distância da câmera): os trechos de anel são arcos, as torres ovais pontos.
 * @returns {Map<number, { arco?: number[], ponto?: number[], y0: number, y1: number }>}
 */
export function alvosDosSetores(plano, cota = GLEBA_ENVELOPE.cota) {
  const alvos = new Map();
  for (const parte of plano.partes) {
    for (const p of parte.pecas) {
      if (p.tipo === 'anel') {
        for (let de = p.de; de < p.ate - 1e-6; de += 45) {
          const s = setorDoAnel(p, de + 1);
          alvos.set(s, { arco: [p.cx, p.cz, p.raio, de, Math.min(p.ate, de + 45)], y0: cota, y1: cota + p.altura });
        }
      } else if (p.tipo === 'oval' && SETOR_OVAL[parte.id] != null) alvos.set(SETOR_OVAL[parte.id], { ponto: [p.x, p.z], y0: cota, y1: cota + p.altura });
      else if (p.tipo === 'supertree' && !alvos.has(SETOR_PARQUE)) alvos.set(SETOR_PARQUE, { ponto: [...plano.centro], y0: cota, y1: cota + 50 });
    }
  }
  return alvos;
}

/** Distância de (px, py, pz) ao alvo de um setor (o arco ou o ponto, entre o pé e o topo). */
export function distAoSetor(alvo, px, py, pz) {
  let qx;
  let qz;
  if (alvo.arco) {
    const [cx, cz, r, de, ate] = alvo.arco;
    const a = Math.atan2(pz - cz, px - cx) / RAD;
    const meio = (de + ate) / 2;
    const meia = (ate - de) / 2;
    const t = (meio + Math.max(-meia, Math.min(meia, difGraus(a, meio)))) * RAD;
    qx = cx + r * Math.cos(t);
    qz = cz + r * Math.sin(t);
  } else [qx, qz] = alvo.ponto;
  const dy = py < alvo.y0 ? alvo.y0 - py : py > alvo.y1 ? py - alvo.y1 : 0;
  return Math.hypot(px - qx, pz - qz, dy);
}

/** Os trechos do Horizon Ring como grupos de peças: o anel, o pedaço do Halo Lake e a ponte de cada trecho (campo `trecho`). */
export function gruposDoHorizon(pecas) {
  const por = new Map();
  for (const p of pecas) {
    const id = p.trecho ?? p.id;
    if (!por.has(id)) por.set(id, []);
    por.get(id).push(p);
  }
  return [...por].map(([id, ps]) => ({ id, pecas: ps }));
}

/**
 * Malhas de um plano (sem o par de torres, que é do torre.js): as partes prontas em material de verdade (a casca no
 * comum, as marquises do LOD0 por setor), as outras no fantasma, o lago e, se pedida, a paisagem.
 * @param {string} id
 * @param {{ chao: Function, prontas?: Set<string> | 'todas', lagoReal?: boolean, paisagem?: boolean, vias?: boolean,
 *   so?: Set<string> | null, mata?: Function | null }} op  so: só estas partes (as outras nem em fantasma)
 * @returns {{ comum: { vidro: Malha, opaco: Malha }, setores: Map<number, Malha>, agua: Malha, efeitos: Malha,
 *   jatos: object[], arvores: object[], fantasma: { vidro: Malha, opaco: Malha }, sombra: { vidro: Malha, opaco: Malha },
 *   caixas: { parte: string, idx: number, trecho: string | null, caixa: number[] }[], nivelAgua: number, cota: number }}
 */
export function malhasDoPlano(id, { chao, prontas = 'todas', lagoReal = true, paisagem = true, vias = paisagem, so = null, mata = mataDaSede, podioObra = false, lagoObra = false } = {}) {
  const plano = PLANOS[id];
  const pronta = (pid) => prontas === 'todas' || prontas.has(pid);
  const comum = { vidro: new Malha('vidro'), opaco: new Malha('opaco') };
  const setores = new Map();
  const setor = (s) => {
    if (!setores.has(s)) setores.set(s, new Malha('opaco'));
    return { opaco: setores.get(s) };
  };
  const agua = new Malha('agua');
  const efeitos = new Malha('cascata');
  const jatos = [];
  const arvores = [];
  const fant = { vidro: new Malha('vidro'), opaco: new Malha('opaco') };
  const sombra = { vidro: new Malha('vidro'), opaco: new Malha('opaco') };
  const caixas = [];
  // o pódio da obra do par (nos materiais das torres, cortado com elas)
  const podio = podioObra ? { vidro: new Malha('vidro'), opaco: new Malha('opaco') } : null;
  const [cx, cz] = plano.centro;
  const cota = chao(cx, cz);
  const res = reservatorioDe(plano);
  const lagoP = lagoDe(plano);
  // o anel d'água do pódio é uma bacia à altura do chão; o lago grande, cavado
  const nivelAgua = cota + res.nivel;
  const nivelLago = cota + lagoP.nivel;
  // a água do parque e das pontes vai na malha do lago: o mesmo material, nenhuma chamada a mais
  const base = { chao, nivelAgua, nivelBacia: nivelAgua, nivelLago, mata, agua };
  const juntar = (parteId, r) => r.caixas.forEach((c, k) => caixas.push({ parte: parteId, idx: PARTES_ORDEM.indexOf(parteId), trecho: r.trechos[k], caixa: c }));
  for (const parte of plano.partes) {
    if (so && !so.has(parte.id)) continue;
    // o par de torres é do torre.js; o resto da parte (o pódio, a água, as quedas) sai aqui
    const pecas = parte.pecas.filter((p) => p.tipo !== 'torre');
    if (parte.id === 'lago') {
      // pronto o lago, a bacia do pódio, as quedas do pódio e as fontes são de verdade; o lago grande e as Dream Falls só
      // depois que o chão foi cavado (o aplainar do jogo ou a cena); o resto é o espelho prometido em holograma (na obra,
      // o leito de terra no lugar dele)
      const real = pronta('lago');
      const dependeDaCava = (q) => q.tipo === 'lago' || q.tipo === 'queda';
      const reais = real ? pecas.filter((q) => lagoReal || !dependeDaCava(q)) : [];
      const fantasmas = pecas.filter((q) => !reais.includes(q) && !(lagoObra && (q.tipo === 'lago' || q.tipo === 'reservatorio')));
      if (reais.length) juntar('lago', montarParte({ id: 'lago', pecas: reais }, { ...base, ...comum, efeitos, jatos, arvores, lod: 1 }));
      if (fantasmas.length) juntar('lago', montarParte({ id: 'lago', pecas: fantasmas }, { ...base, ...fant, fantasma: true }));
      continue;
    }
    if (parte.id === 'torre' && podio && !pronta('torre')) {
      juntar('torre', montarParte({ id: 'torre', pecas }, { ...base, vidro: podio.vidro, opaco: podio.opaco, efeitos, jatos, arvores, lod: 1 }));
      continue;
    }
    // o Horizon Ring fica pronto trecho a trecho (D89), cada um com a ponte e o pedaço do Halo Lake dele; as outras partes inteiras
    const grupos = parte.id === 'horizon' ? gruposDoHorizon(pecas) : [{ id: parte.id, pecas }];
    for (const g of grupos) {
      const sub = { id: parte.id, pecas: g.pecas };
      if (!pronta(g.id)) {
        juntar(parte.id, montarParte(sub, { ...base, ...fant, fantasma: true }));
        continue;
      }
      juntar(parte.id, montarParte(sub, { ...base, ...comum, efeitos, jatos, arvores, lod: 1 }));
      montarParte(sub, { ...base, ...comum, setor, lod: 0 });
      montarParte(sub, { ...base, vidro: sombra.vidro, opaco: sombra.opaco, sombra: true });
    }
  }
  const lagoDesenhado = pronta('lago') && lagoReal;
  if (paisagem === 'portoes') montarPortoes(plano, { cota, opaco: comum.opaco, arvores, vias, lago: lagoDesenhado });
  else if (paisagem) montarPaisagem(plano, { cota, opaco: comum.opaco, arvores, vias, lago: lagoDesenhado });
  return { comum, setores, agua, efeitos, jatos, arvores, fantasma: fant, sombra, caixas, nivelAgua, nivelLago, cota, podio };
}

/** Caixa de seleção do par no espaço do par: as duas torres (a Blade em x = -32, a Legacy em +32), do pódio ao mastro. */
const CAIXA_PAR = Object.freeze([-51, 0, -27, 51, TORRE_LAMINA.mastro.topo, 27]);

/** Folga em volta do disco da gleba (a calçada e a transição do platô), em metros. */
const FOLGA_GLEBA = 60;

/**
 * true se algum retângulo sujo do terreno ([x0, z0, x1, z1]) toca o disco da gleba com a folga: a cidade em volta
 * mexe no chão o tempo todo (vias, lotes) e não pede refazer a sede.
 */
export function tocaGleba(rets) {
  if (!rets?.length) return false;
  const [gx, gz] = GLEBA_ENVELOPE.centro;
  const r = GLEBA_ENVELOPE.raio + FOLGA_GLEBA;
  return rets.some(([x0, z0, x1, z1]) => {
    const dx = Math.max(x0 - gx, 0, gx - x1);
    const dz = Math.max(z0 - gz, 0, gz - z1);
    return dx * dx + dz * dz <= r * r;
  });
}

/**
 * Distância (m) da câmera a um setor em que as marquises dele saem do shader para a geometria: elas têm 0,5 m e cobrem
 * ~meio pixel ali, em 1080p (de longe o shader do vidro as desenha filtradas).
 */
export const DIST_PARTES_LOD0 = Object.freeze({ leve: 300, media: 500, alta: 800, ultra: 1100, pc: 800 });

/** Liga (1) ou desliga (0) a geometria das marquises do setor s no uniforme do vidro. */
function lodSetor(s, v) {
  if (!(s >= 0 && s < SETORES)) return;
  const q = UNIFORMES.uLodSetor.value[s >> 2];
  if (q) q.setComponent(s & 3, v);
}

/** Densidade da mata (0 a 1) na grade espelho.floresta, 0 sem ela. */
function mataNaGrade(F, x, z) {
  if (!F?.dens) return 0;
  const i = Math.floor((x - F.origem[0]) / F.passo);
  const j = Math.floor((z - F.origem[1]) / F.passo);
  if (i < 0 || j < 0 || i >= F.n || j >= F.n) return 0;
  return F.dens[j * F.n + i] / 255;
}

// ================================================================================================ domínio

function criarDominio(ctx) {
  const raiz = new THREE.Group();
  raiz.name = 'arcologia';
  ctx.cena.add(raiz);
  // o conjunto fixo de materiais: todos existem desde a carga (D66)
  const mats = materiais(ctx);
  const matAgua = materialAgua(ctx.ganchos);
  const matFantasma = materialFantasma(ctx.ganchos);
  // o fantasma do par na obra: o mesmo programa, só acima do corte (uAcima)
  const matFantasmaObra = materialFantasma(ctx.ganchos);
  matFantasmaObra.uniforms.uAcima.value = 1;
  const aquecer = criarAquecimento(ctx, [...mats.lista, matAgua, matFantasma, matFantasmaObra]);
  raiz.add(aquecer.grupo);
  const obra = criarObra(ctx, mats.opaco);
  raiz.add(obra.grupo);
  let obraTorre = false; // o par está em obra na montagem atual
  const corte = { blade: -1, legacy: -1, vao: -1 }; // o corte aplicado (alisado de quadro em quadro)
  let tAnterior = 0;
  let torre = null;
  let torrePerfil = null; // perfil do LOD0 montado (a troca de qualidade refaz a geometria, nunca o programa)
  let torreFantasma = null;
  let partes = null; // { grupo, setores, efeitos, jatos, caixas, volume, plano, arvores, centro }
  let vitrine = null; // { modo }
  let chave = '';
  let sujo = true;
  const estadoCeu = {};

  const limparPartes = () => {
    if (!partes) return;
    raiz.remove(partes.grupo);
    if (partes.volume) ctx.sombra?.soltar(partes.volume);
    partes.grupo.traverse((o) => o.geometry?.dispose());
    // o InstancedMesh dos jatos guarda o buffer das matrizes e o VAO fora da geometria: só o dispose() dele os solta
    partes.jatos?.dispose();
    for (const s of partes.setores) lodSetor(s.id, 0);
    ctx.vegetacao?.plantar('arcologia', null);
    partes = null;
  };

  /** Etapas que valem: as de uma vitrine de jogo (cena) ou as do espelho. */
  const etapasAtuais = (esp = ctx.sim?.espelho) => (vitrine?.modo === 'jogo' && vitrine.etapas ? vitrine.etapas : esp?.arcologia?.etapas ?? []);

  function montar(esp) {
    const modo = vitrine?.modo ?? 'jogo';
    const plano = planoDoJogo(esp);
    const P = PLANOS[plano];
    const T = esp?.terreno;
    const chao = (x, z) => cotaEm(T, x, z);
    const etapas = etapasAtuais(esp);
    const prontas = modo === 'jogo' ? partesProntas({ arcologia: { etapas } }) : 'todas';
    const torrePronta = prontas === 'todas' || prontas.has('torre');
    const est = modo === 'jogo' ? estadoObra(etapas) : null;
    const emObra = !!est?.torre && !torrePronta;
    const lagoObra = !!est?.lago;
    const lagoP = lagoDe(P);
    // o Mirror Lake grande só aparece de verdade quando o chão já foi cavado (o aplainar do jogo ou a cena)
    const [ccx, ccz] = centroDoPlano(P);
    const cota = chao(ccx, ccz);
    const [ax, az] = pontoNoLago(lagoP);
    const cavado = chao(ax, az) < cota + lagoP.nivel - 0.5;
    const chaveProntas = prontas === 'todas' ? 'todas' : [...prontas].sort().join(',');
    const nova = `${modo}|${plano}|${chaveProntas}|${cavado}|${ctx.perfil?.id}|${T?.altura?.length ?? 0}|${emObra}|${lagoObra}|${!!vitrine?.vias}`;
    if (nova === chave && !sujo) return;
    chave = nova;
    sujo = false;

    // o par: pronto (LOD0 e LOD1) ou fantasma; o LOD0 é do perfil, então a troca de qualidade refaz a geometria
    if (torre && torrePerfil !== ctx.perfil?.id) {
      torre.descartar();
      torre = null;
    }
    if (!torre) {
      torre = criarPar(ctx);
      torrePerfil = ctx.perfil?.id;
      raiz.add(torre.grupo);
    }
    torre.posicionar(P.torre.x, cota, P.torre.z, P.torre.rot);
    // na obra o par aparece cortado (o quadro sobe o corte); pronto ou antes da obra, inteiro ou em fantasma
    obraTorre = emObra;
    torre.mostrar(torrePronta || emObra);
    if (!emObra) torre.corte();
    corte.blade = corte.legacy = corte.vao = -1;
    if (torreFantasma) {
      raiz.remove(torreFantasma);
      torreFantasma.geometry.dispose();
      torreFantasma = null;
    }
    if (!torrePronta) {
      const m1 = malhasPar({ lod: 1 });
      torreFantasma = criarFantasma(ctx, malhaFantasma(m1.vidro, m1.opaco), emObra ? matFantasmaObra : matFantasma);
      torreFantasma.position.set(P.torre.x, cota, P.torre.z);
      torreFantasma.rotation.y = P.torre.rot;
      raiz.add(torreFantasma);
    }

    // as partes; no modo 'torre', só o pódio (as torres nascem nele)
    limparPartes();
    const parqueVivo = prontas === 'todas' || prontas.has('parque');
    const lagoPronto = prontas === 'todas' || prontas.has('lago');
    // no jogo, o parque pronto traz a paisagem inteira; antes dele, o lago pronto traz a praça e os portões
    const paisagem = modo === 'plano' || (modo === 'jogo' && parqueVivo) ? true : modo === 'jogo' && lagoPronto ? 'portoes' : false;
    const m = malhasDoPlano(plano, {
      chao, prontas, lagoReal: cavado, paisagem, vias: modo === 'plano' || !!vitrine?.vias,
      so: modo === 'torre' ? new Set(['torre']) : null, podioObra: emObra, lagoObra,
    });
    const grupo = new THREE.Group();
    grupo.name = `arcologia:plano-${plano}`;
    const add = (malha, mat, fam, nome, ordem = 0) => {
      if (!malha?.triangulos) return null;
      const o = new THREE.Mesh(geometriaDe(malha), mat);
      o.name = nome;
      o.renderOrder = ordem;
      ctx.medidas?.familia(o, fam);
      grupo.add(o);
      return o;
    };
    add(m.comum.vidro, mats.vidroLod1, 'arcologia', 'plano:vidro');
    add(m.comum.opaco, mats.opaco, 'arcologia', 'plano:opaco');
    // o pódio da obra nos materiais das torres: sobe com o corte delas
    if (m.podio) {
      add(m.podio.vidro, mats.torreVidroLod1, 'arcologia', 'obra:podio:vidro');
      add(m.podio.opaco, mats.torreOpaco, 'arcologia', 'obra:podio:opaco');
    }
    const alvos = alvosDosSetores(P, cota);
    const setores = [];
    for (const [s, malha] of m.setores) {
      const o = add(malha, mats.opaco, 'arcologia', `plano:setor${s}`);
      if (!o) continue;
      o.visible = false;
      setores.push({ id: s, malha: o, alvo: alvos.get(s), lod0: false });
    }
    add(m.agua, matAgua, 'resto', 'plano:agua');
    const efeitos = add(m.efeitos, mats.cascata, 'arcologia', 'plano:efeitos', 11);
    let jatos = null;
    if (m.jatos.length) {
      jatos = criarJatos(ctx, m.jatos, m.nivelAgua, mats.jato);
      grupo.add(jatos);
    }
    const f = criarFantasma(ctx, malhaFantasma(m.fantasma.vidro, m.fantasma.opaco), matFantasma);
    if (f) grupo.add(f);
    // volume de sombra das partes prontas (as cascas, sem o chão nem as árvores)
    let volume = null;
    const vs = malhaFantasma(m.sombra.vidro, m.sombra.opaco);
    if (vs.triangulos && ctx.sombra) {
      volume = new THREE.Mesh(geometriaDe(vs), mats.opaco);
      volume.visible = false;
      volume.name = 'plano:sombra';
      grupo.add(volume);
      ctx.medidas?.familia(ctx.sombra.projetor(volume), 'sombra');
    }
    raiz.add(grupo);
    grupo.updateMatrixWorld(true);
    ctx.sombra?.marcar();
    // as árvores do parque e das avenidas vão para a vegetação; as da mata, só onde a grade não tem o parque pintado
    const F = esp?.floresta;
    const arvores = m.arvores.filter((a) => !a.mata || mataNaGrade(F, a.x, a.z) < 0.5);
    ctx.vegetacao?.plantar('arcologia', arvores);
    partes = { grupo, setores, efeitos, jatos, caixas: m.caixas, volume, plano, arvores: arvores.length, centro: new THREE.Vector3(ccx, cota + 20, ccz) };
    obra.montar(P, cota);
    quadroPartes();
    quadroObra(0);
  }

  /**
   * A obra a cada quadro: o corte por lado das torres e do fantasma sobe até as alturas das etapas (alisado: a obra
   * anda de tique em tique, a câmera vê subir sem degraus), as gruas acompanham e os canteiros aparecem.
   */
  function quadroObra(tMs) {
    const est = (vitrine?.modo ?? 'jogo') === 'jogo' ? estadoObra(etapasAtuais()) : null;
    const dt = Math.min(0.5, Math.max(0, (tMs - tAnterior) / 1000));
    tAnterior = tMs;
    if (obraTorre && torre && est) {
      const k = corte.blade < 0 || dt === 0 ? 1 : Math.min(1, dt * 3);
      const mover = (atual, alvo) => (atual < 0 ? alvo : atual + (alvo - atual) * k);
      const nb = mover(corte.blade, est.blade);
      const nl = mover(corte.legacy, est.legacy);
      const nv = est.ponte ? Math.min(nb, nl) : Math.min(nb, nl, est.vao);
      if (Math.abs(nb - corte.blade) > 0.02 || Math.abs(nl - corte.legacy) > 0.02 || Math.abs(nv - corte.vao) > 0.02) {
        corte.blade = nb;
        corte.legacy = nl;
        corte.vao = nv;
        // o vidro para abaixo da frente de obra (o esqueleto de concreto de 3 pavimentos no topo, obra.js)
        torre.cortePorLado(alturaVidro(nb, TORRE_LAMINA), alturaVidro(nl, TORRE_IRMA), nv);
        const g = torre.grupo;
        const u = matFantasmaObra.uniforms;
        u.uCorteEixo.value.set(g.position.x, g.position.z, Math.cos(g.rotation.y), -Math.sin(g.rotation.y));
        u.uCorteH.value.set(g.position.y + nb, g.position.y + nl, g.position.y + nv, MEIO_VAO_CORTE);
      }
    }
    obra.quadro(tMs, obraTorre ? { ...est, blade: corte.blade, legacy: corte.legacy } : { ...est, torre: false });
  }

  /** O LOD de cada setor pela distância da câmera a ele (histerese de 5%) e os efeitos de água só de perto. */
  function quadroPartes() {
    if (!partes) return;
    const c = ctx.camera.position;
    const lim = DIST_PARTES_LOD0[ctx.perfil?.id] ?? 800;
    for (const s of partes.setores) {
      const perto = dom.forcarLodPartes != null
        ? dom.forcarLodPartes === 0
        : !!s.alvo && distAoSetor(s.alvo, c.x, c.y, c.z) < lim * (s.lod0 ? 1.05 : 0.95);
      if (perto !== s.lod0) {
        s.lod0 = perto;
        s.malha.visible = perto;
        lodSetor(s.id, perto ? 1 : 0);
      }
    }
    const d = c.distanceTo(partes.centro);
    if (partes.efeitos) partes.efeitos.visible = d < DIST_EFEITOS;
    if (partes.jatos) partes.jatos.visible = d < DIST_EFEITOS;
  }

  const dom = {
    nome: 'arcologia',
    /** Força o LOD das partes (0: todos os setores com a geometria; 1: nenhum) ou volta ao automático (null). */
    forcarLodPartes: null,
    /**
     * Refaz a escolha dos LODs e dos efeitos com a câmera do momento: uma cena que põe a câmera depois dos domínios
     * (as vistas fixas) chama no quadro dela, antes do desenho.
     */
    atualizarLods() {
      torre?.quadro();
      quadroPartes();
    },
    aplicar(d, esp) {
      // o chão refaz tudo só quando mexe na gleba; o sinal 'arcologia' (progresso das etapas a cada tique) só remonta
      // quando a chave muda (parte pronta, plano escolhido); a troca de qualidade refaz as torres e as partes
      if (d.tudo?.terreno || tocaGleba(d.terreno) || ctx.perfil?.id !== torrePerfil) sujo = true;
      if (sujo || d.arcologia || !chave) montar(esp);
    },
    quadro(tMs, c) {
      aquecer.quadro();
      estadoDoCeu(c, estadoCeu);
      atualizarArcologia(c, tMs, estadoCeu);
      quadroAgua(tMs);
      matFantasma.uniforms.uNoiteF.value = estadoCeu.noite;
      matFantasmaObra.uniforms.uNoiteF.value = estadoCeu.noite;
      quadroObra(tMs);
      torre?.quadro();
      quadroPartes();
    },
    /** As etapas que o domínio desenha (as do espelho ou as da vitrine de jogo): o helicóptero lê. */
    etapas: () => etapasAtuais(),
    /** A obra (gruas e canteiros): as cenas e os testes leem. */
    get obra() {
      return obra;
    },
    /** O corte de agora (metros acima da gleba) da Blade, da Legacy e do vão, ou null fora da obra. */
    get corte() {
      return obraTorre ? { ...corte } : null;
    },
    /** Vista pedida por uma cena (null volta ao jogo). */
    vitrine(v) {
      vitrine = v ?? null;
      sujo = true;
      montar(ctx.sim?.espelho);
    },
    /** Refaz tudo (a cena mexeu no chão ou na mata). */
    refazer() {
      sujo = true;
      montar(ctx.sim?.espelho);
    },
    get torre() {
      return torre;
    },
    get partes() {
      return partes;
    },
    /** 0 se algum setor está com as marquises em geometria, 1 se nenhum. */
    get lodPartes() {
      return partes?.setores.some((s) => s.lod0) ? 0 : 1;
    },
    /** Os materiais da Arcologia (o conjunto fixo, a água e o fantasma): o teste de programas e a bancada leem. */
    get materiais() {
      return [...mats.lista, matAgua, matFantasma, matFantasmaObra];
    },
    /**
     * Raio da tela contra as caixas das partes e as torres: { tipo: 'arcologia', ref (o id do trecho do Horizon Ring,
     * ou null), idx da parte, ponto, dist }.
     */
    selecionar(raio) {
      const o = raio.origem;
      const dv = raio.dir;
      let melhor = null;
      // raio contra uma caixa [x0, y0, z0, x1, y1, z1]; oo e dd são o raio no espaço da caixa (o mundo, ou o do par,
      // que só gira e desloca: a distância t é a mesma nos dois)
      const testar = (b, idx, ref, oo = o, dd = dv) => {
        let t0 = 0;
        let t1 = Infinity;
        for (let e = 0; e < 3; e++) {
          const lo = b[e];
          const hi = b[e + 3];
          if (Math.abs(dd[e]) < 1e-9) {
            if (oo[e] < lo || oo[e] > hi) return;
            continue;
          }
          let a = (lo - oo[e]) / dd[e];
          let bb = (hi - oo[e]) / dd[e];
          if (a > bb) [a, bb] = [bb, a];
          t0 = Math.max(t0, a);
          t1 = Math.min(t1, bb);
          if (t0 > t1) return;
        }
        if (!melhor || t0 < melhor.dist) melhor = { tipo: 'arcologia', ref, idx, dist: t0, ponto: [o[0] + dv[0] * t0, o[1] + dv[1] * t0, o[2] + dv[2] * t0] };
      };
      if (torre?.grupo) {
        // as torres: o raio levado ao espaço do par (girado pelo plano) contra a caixa do pódio ao mastro
        const g = torre.grupo;
        const c = Math.cos(g.rotation.y);
        const sn = Math.sin(g.rotation.y);
        const ox = o[0] - g.position.x;
        const oz = o[2] - g.position.z;
        testar(CAIXA_PAR, PARTES_ORDEM.indexOf('torre'), null, [c * ox - sn * oz, o[1] - g.position.y, sn * ox + c * oz], [c * dv[0] - sn * dv[2], dv[1], sn * dv[0] + c * dv[2]]);
      }
      for (const c of partes?.caixas ?? []) testar(c.caixa, c.idx, c.trecho ?? null);
      return melhor;
    },
    descartar() {
      torre?.descartar();
      limparPartes();
      obra.descartar();
      if (torreFantasma) torreFantasma.geometry.dispose();
      aquecer.descartar();
      matAgua.dispose();
      matFantasma.dispose();
      matFantasmaObra.dispose();
      // os materiais da Arcologia são deste render
      descartarMateriais(ctx);
      ctx.cena.remove(raiz);
    },
  };
  return dom;
}

export function registrar(api) {
  api.registrarDominio('arcologia', criarDominio);
  api.registrarSelecionavel('arcologia', (raio, ctx) => ctx.dominio('arcologia')?.selecionar?.(raio) ?? null);
}
