// Perfil transversal das vias (desenho do render 4.1 a 4.4, D22, seção 2.3), puro: roda no Node, no worker `oficina`
// e na thread principal (prévia da X2). Lê os tipos de data/vias.js e devolve, para cada tipo:
//   tiras    a seção como uma linha poligonal da esquerda para a direita (olhando de a para b), em tiras com material:
//            saia, calçada (com o meio-fio de 0,15 m dentro), face do meio-fio, pista com abaulamento de 1,5%, canteiro
//            elevado, barreira New Jersey, acostamento, talude e chão batido; cada tira tem os seus vértices (aresta
//            viva no meio-fio) e a distância na banda (b) para o shader (sarjeta, meio-fio, juntas das placas)
//   linhas   as marcas do CTB no eixo lateral u: amarela seccionada no eixo da rua de mão dupla (LFO-2), branca
//            seccionada entre faixas do mesmo sentido (LMS-2), bordo branco e amarelo contínuos na rodovia, a linha do
//            estacionamento; traço e espaço por velocidade
//   regras   de postes, árvores de rua, semáforos e vagas de estacionamento (as posições saem de malhaVia.js)
// Alturas em metros acima do chão (alturaEm): a pista fica 0,15 m acima (o aplainar põe o chão 0,15 abaixo, D5), a
// calçada 0,15 m acima da pista (meio-fio, seção 2.3) e cai 2% para a rua.
import { VIAS, VIAS_ORDEM, MEIO_FIO } from '../../data/vias.js';

/** Materiais das tiras (aDados.x no shader). */
export const MAT = Object.freeze({
  PISTA: 0, MEIO_FIO: 1, CALCADA: 2, CANTEIRO: 3, BARREIRA: 4, ACOSTAMENTO: 5, TALUDE: 6, TERRA: 7, SAIA: 8, TABULEIRO: 9,
});

/** Alturas da seção acima do chão (m). */
export const ALTURA = Object.freeze({
  pista: 0.15,
  meioFio: MEIO_FIO.altura,
  calcada: 0.15 + MEIO_FIO.altura,
  caimentoCalcada: 0.02,
  abaulamento: 0.015,
  saia: -1,
  taludeFora: -0.25,
  terraBorda: 0.03,
  barreira: 0.81,
});

/** Estilo das linhas (aDados no shader e as tabelas constantes do GLSL). */
export const ESTILO = Object.freeze({ CONTINUA: 0, TRACEJADA: 1, ESTACIONAMENTO: 2 });
export const COR_LINHA = Object.freeze({ BRANCA: 0, AMARELA: 1 });

/** Raio do meio-fio nas esquinas (m, desenho 4.3) e o que cada tipo põe na rua. */
const RAIO_ESQUINA = Object.freeze({ rua: 5, ruaMao: 5, avenida: 8, avenidaG: 10, rodovia: 15, terra: 4 });

/** Traço e espaço das linhas seccionadas por tipo (m): urbano 2/4, avenida grande 3/6, rodovia 4/12. */
const TRACEJADO = Object.freeze({ rua: [2, 4], ruaMao: [2, 4], avenida: [2, 4], avenidaG: [3, 6], rodovia: [4, 12], terra: [2, 4] });
const LARGURA_LINHA = Object.freeze({ rua: 0.1, ruaMao: 0.1, avenida: 0.1, avenidaG: 0.12, rodovia: 0.15, terra: 0.1 });

/**
 * Regras dos objetos da rua por tipo (m):
 *   postes    onde: 'alternado' (calçadas, um de cada lado), 'canteiro' (duplo no meio), 'lado' (só à direita)
 *   arvores   especie 'copa' (oiti, sibipiruna) ou 'palmeira' (palmeira-imperial); prob: parte das ruas arborizadas
 *   calcadaArv  árvores também nas calçadas (avenidas), com a probabilidade
 */
const REGRAS = Object.freeze({
  rua: { postes: { onde: 'alternado', espaco: 32, altura: 8, braco: 1.8, modelo: 'simples' }, arvores: { onde: 'calcadas', espaco: 11, especie: 'copa', prob: 0.6 } },
  ruaMao: { postes: { onde: 'alternado', espaco: 32, altura: 8, braco: 1.8, modelo: 'simples' }, arvores: { onde: 'calcadas', espaco: 11, especie: 'copa', prob: 0.55 } },
  avenida: {
    postes: { onde: 'canteiro', espaco: 36, altura: 10, braco: 2.4, modelo: 'duplo' },
    arvores: { onde: 'canteiro', espaco: 12, especie: 'palmeira', prob: 1 },
    calcadaArv: { espaco: 14, especie: 'copa', prob: 0.45 },
  },
  avenidaG: {
    postes: { onde: 'canteiro', espaco: 36, altura: 12, braco: 3, modelo: 'duplo' },
    arvores: { onde: 'canteiro', espaco: 12, especie: 'copa', prob: 1 },
    calcadaArv: { espaco: 14, especie: 'copa', prob: 0.5 },
  },
  rodovia: { postes: { onde: 'canteiro', espaco: 50, altura: 12, braco: 3, modelo: 'duplo' }, arvores: null },
  terra: { postes: { onde: 'lado', espaco: 40, altura: 7, braco: 1, modelo: 'rural' }, arvores: null },
});

const partesDe = (tipo) => (typeof tipo === 'number' ? VIAS[VIAS_ORDEM[tipo]] : VIAS[tipo]);
const idDe = (tipo) => (typeof tipo === 'number' ? VIAS_ORDEM[tipo] : tipo);

const cache = new Map();

/**
 * Perfil compilado de um tipo (id ou índice em VIAS_ORDEM). Guardado: o mesmo objeto para o mesmo tipo.
 * @returns {{ id, idx, largura, meia, tiras: object[], partes: object[], pistas: object[], linhas: object[],
 *   calcadas: object[], canteiro: object | null, barreira: object | null, bordas: { e, d }, meioFio: boolean,
 *   raioEsquina: number, tracejado: number[], larguraLinha: number, faixas: object[], vagas: object[], regras: object }}
 */
export function perfilVia(tipo) {
  const id = idDe(tipo);
  let p = cache.get(id);
  if (!p) {
    p = compilar(id);
    cache.set(id, p);
  }
  return p;
}

function compilar(id) {
  const t = partesDe(id);
  if (!t) throw new Error(`perfilVia: tipo desconhecido (${id})`);
  const meia = t.largura / 2;
  // partes com u0, u1
  const partes = [];
  let u = -meia;
  for (const q of t.perfil) {
    partes.push({ ...q, u0: u, u1: u + q.largura });
    u += q.largura;
  }
  if (Math.abs(u - meia) > 1e-6) throw new Error(`perfilVia: ${id} soma ${u + meia} m, largura ${t.largura}`);
  const asfalto = (q) => q.parte === 'faixa' || q.parte === 'estacionamento' || q.parte === 'acostamento';
  // pistas: partes de asfalto (ou de terra) seguidas
  const pistas = [];
  for (let i = 0; i < partes.length; ) {
    if (!asfalto(partes[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < partes.length && asfalto(partes[j + 1])) j++;
    const viz = (k) => partes[k]?.parte ?? null;
    const lim = (k) => viz(k) === 'calcada' || viz(k) === 'canteiro';
    pistas.push({ u0: partes[i].u0, u1: partes[j].u1, partes: partes.slice(i, j + 1), meioFioE: lim(i - 1), meioFioD: lim(j + 1), terra: partes[i].piso === 'terra' });
    i = j + 1;
  }
  const calcadas = partes.filter((q) => q.parte === 'calcada').map((q) => ({ lado: q.u0 < 0 ? -1 : 1, u0: q.u0, u1: q.u1, largura: q.largura }));
  const can = partes.find((q) => q.parte === 'canteiro');
  const bar = partes.find((q) => q.parte === 'barreira');
  const terra = pistas.length === 1 && pistas[0].terra;
  const faixas = partes.filter((q) => q.parte === 'faixa').map((q) => ({ u0: q.u0, u1: q.u1, sentido: q.sentido ?? 1, meio: (q.u0 + q.u1) / 2 }));
  const vagas = partes.filter((q) => q.parte === 'estacionamento').map((q) => ({ u0: q.u0, u1: q.u1, meio: (q.u0 + q.u1) / 2 }));
  const P = {
    id,
    idx: VIAS_ORDEM.indexOf(id),
    largura: t.largura,
    meia,
    partes,
    pistas,
    calcadas,
    canteiro: can ? { u0: can.u0, u1: can.u1, detalhe: can.detalhe ?? null } : null,
    barreira: bar ? { u0: bar.u0, u1: bar.u1 } : null,
    // bordas da pista (onde o meio-fio encontra a pista; sem meio-fio, a borda do asfalto): o desenho das esquinas
    bordas: { e: pistas[0]?.u0 ?? -meia, d: pistas[pistas.length - 1]?.u1 ?? meia },
    meioFio: calcadas.length > 0,
    terra,
    raioEsquina: RAIO_ESQUINA[id] ?? 5,
    tracejado: TRACEJADO[id] ?? [2, 4],
    larguraLinha: LARGURA_LINHA[id] ?? 0.1,
    faixas,
    vagas,
    regras: REGRAS[id] ?? { postes: null, arvores: null },
    velocidade: t.velocidade,
    mao: t.mao,
  };
  P.linhas = linhasDoPerfil(P);
  P.tiras = tirasDoPerfil(P);
  return P;
}

// ------------------------------------------------------------------------------------------------ marcas

/** Marcas do CTB de um perfil compilado: [{ u, largura, cor, estilo }]. */
function linhasDoPerfil(P) {
  const L = [];
  const w = P.larguraLinha;
  if (P.terra) return L;
  for (const pista of P.pistas) {
    const fx = pista.partes;
    for (let k = 0; k + 1 < fx.length; k++) {
      const a = fx[k];
      const b = fx[k + 1];
      const uu = a.u1;
      if (a.parte === 'faixa' && b.parte === 'faixa') {
        // sentidos opostos: eixo amarelo seccionado (LFO-2); mesmo sentido: branca seccionada (LMS-2)
        if ((a.sentido ?? 1) !== (b.sentido ?? 1)) L.push({ u: uu, largura: w, cor: COR_LINHA.AMARELA, estilo: ESTILO.TRACEJADA });
        else L.push({ u: uu, largura: w, cor: COR_LINHA.BRANCA, estilo: ESTILO.TRACEJADA });
      } else if (a.parte === 'acostamento' || b.parte === 'acostamento') {
        // bordo da pista na rodovia (LBO): branco contínuo
        L.push({ u: uu, largura: w, cor: COR_LINHA.BRANCA, estilo: ESTILO.CONTINUA });
      } else if (a.parte === 'estacionamento' || b.parte === 'estacionamento') {
        L.push({ u: uu, largura: w, cor: COR_LINHA.BRANCA, estilo: ESTILO.ESTACIONAMENTO });
      }
    }
    // rodovia: bordo esquerdo amarelo contínuo junto da barreira
    if (P.barreira) {
      const junto = pista.u1 <= P.barreira.u0 + 1e-6 ? pista.u1 - 0.35 : pista.u0 + 0.35;
      L.push({ u: junto, largura: w, cor: COR_LINHA.AMARELA, estilo: ESTILO.CONTINUA });
    }
  }
  return L;
}

// ------------------------------------------------------------------------------------------------ tiras

/**
 * Tiras da seção, da esquerda para a direita: { u0, y0, u1, y1, mat, b0, b1 }. y acima do chão; b é a distância na
 * banda (m) que o shader usa: na calçada, do meio-fio (0) para fora; na pista, da borda (0) para o meio; no canteiro,
 * da borda esquerda. As tiras formam uma linha poligonal contínua, com a saia de 1 m descendo nas duas pontas.
 */
function tirasDoPerfil(P) {
  const T = [];
  const A = ALTURA;
  const add = (u0, y0, u1, y1, mat, b0 = 0, b1 = 0, extra = null) => T.push({ u0, y0, u1, y1, mat, b0, b1, ...(extra ?? {}) });
  const partes = P.partes;
  // altura da pista em u (abaulada no meio de cada pista; na rodovia, caimento de 2% para fora a partir da barreira)
  const yPista = (pista, uu) => {
    if (pista.terra) {
      const c = (pista.u0 + pista.u1) / 2;
      const h = (pista.u1 - pista.u0) / 2;
      return A.terraBorda + (A.pista - A.terraBorda) * (1 - Math.abs(uu - c) / h);
    }
    if (P.barreira) {
      const dentro = pista.u1 <= P.barreira.u0 + 1e-6 ? pista.u1 : pista.u0;
      return A.pista + 0.02 * (pista.u1 - pista.u0 - Math.abs(uu - dentro));
    }
    const c = (pista.u0 + pista.u1) / 2;
    return A.pista + A.abaulamento * ((pista.u1 - pista.u0) / 2 - Math.abs(uu - c));
  };
  const primeira = partes[0];
  const ultima = partes[partes.length - 1];
  // saia à esquerda (sobe do fundo até a borda de fora); o talude não tem saia (fica enterrado)
  const yBorda = (q, lado) => {
    if (q.parte === 'calcada') return A.calcada + A.caimentoCalcada * q.largura;
    if (q.parte === 'talude') return A.taludeFora;
    const pista = P.pistas.find((p) => p.u0 <= q.u0 + 1e-6 && p.u1 >= q.u1 - 1e-6);
    return pista ? yPista(pista, lado < 0 ? q.u0 : q.u1) : A.pista;
  };
  if (primeira.parte !== 'talude') add(primeira.u0, A.saia, primeira.u0, yBorda(primeira, -1), MAT.SAIA);
  for (let i = 0; i < partes.length; i++) {
    const q = partes[i];
    if (q.parte === 'calcada') {
      const fora = A.calcada + A.caimentoCalcada * q.largura;
      if (q.u0 < 0) {
        // esquerda: de fora (u0) para o meio-fio (u1), depois a face do meio-fio desce até a pista
        add(q.u0, fora, q.u1, A.calcada, MAT.CALCADA, q.largura, 0);
        add(q.u1, A.calcada, q.u1, A.pista, MAT.MEIO_FIO, 0, A.meioFio);
      } else {
        add(q.u0, A.pista, q.u0, A.calcada, MAT.MEIO_FIO, A.meioFio, 0);
        add(q.u0, A.calcada, q.u1, fora, MAT.CALCADA, 0, q.largura);
      }
    } else if (q.parte === 'canteiro') {
      add(q.u0, A.pista, q.u0, A.calcada, MAT.MEIO_FIO, A.meioFio, 0, { alto: 'canteiro' });
      add(q.u0, A.calcada, q.u1, A.calcada, MAT.CANTEIRO, 0, q.largura, { alto: 'canteiro' });
      add(q.u1, A.calcada, q.u1, A.pista, MAT.MEIO_FIO, 0, A.meioFio, { alto: 'canteiro' });
    } else if (q.parte === 'barreira') {
      // faixa de concreto na altura da pista e o perfil New Jersey no meio (base 0,61, topo 0,15, 0,81 de altura)
      const c = (q.u0 + q.u1) / 2;
      const yb = yPista(P.pistas.find((p) => Math.abs(p.u1 - q.u0) < 1e-6) ?? P.pistas[0], q.u0);
      const nj = [[-0.305, 0], [-0.24, 0.075], [-0.09, 0.33], [-0.075, A.barreira], [0.075, A.barreira], [0.09, 0.33], [0.24, 0.075], [0.305, 0]];
      add(q.u0, yb, c + nj[0][0], yb, MAT.BARREIRA, 0, c + nj[0][0] - q.u0);
      for (let k = 0; k + 1 < nj.length; k++) add(c + nj[k][0], yb + nj[k][1], c + nj[k + 1][0], yb + nj[k + 1][1], MAT.BARREIRA, 1, 1, { alto: 'barreira' });
      add(c + nj[nj.length - 1][0], yb, q.u1, yb, MAT.BARREIRA, q.u1 - c - nj[nj.length - 1][0], 0);
    } else if (q.parte === 'talude') {
      // do chão (enterrado) até a borda do acostamento, ou de volta
      const pista = P.pistas[q.u0 < 0 ? 0 : P.pistas.length - 1];
      if (q.u0 < 0) add(q.u0, A.taludeFora, q.u1, yPista(pista, q.u1), MAT.TALUDE, q.largura, 0);
      else add(q.u0, yPista(pista, q.u0), q.u1, A.taludeFora, MAT.TALUDE, 0, q.largura);
    }
    // pistas: a primeira parte de cada pista desenha a pista inteira
    const pista = P.pistas.find((p) => Math.abs(p.u0 - q.u0) < 1e-6);
    if (pista) {
      // o acostamento é tira própria (asfalto mais velho); o resto só quebra no abaulamento
      const pts = [pista.u0, pista.u1];
      for (let k = 0; k + 1 < pista.partes.length; k++) {
        const a = pista.partes[k];
        const b = pista.partes[k + 1];
        if ((a.parte === 'acostamento') !== (b.parte === 'acostamento')) pts.push(a.u1);
      }
      if (!P.barreira) pts.push((pista.u0 + pista.u1) / 2);
      pts.sort((a, b) => a - b);
      const larg = pista.u1 - pista.u0;
      const bDe = (uu) => (P.barreira ? (pista.u1 <= P.barreira.u0 + 1e-6 ? uu - pista.u0 : pista.u1 - uu) : Math.min(uu - pista.u0, pista.u1 - uu));
      for (let k = 0; k + 1 < pts.length; k++) {
        const a = pts[k];
        const b = pts[k + 1];
        if (b - a < 1e-6) continue;
        const acost = pista.partes.some((f) => f.parte === 'acostamento' && f.u0 <= a + 1e-6 && f.u1 >= b - 1e-6);
        const mat = pista.terra ? MAT.TERRA : acost ? MAT.ACOSTAMENTO : MAT.PISTA;
        add(a, yPista(pista, a), b, yPista(pista, b), mat, Math.min(bDe(a), larg), Math.min(bDe(b), larg));
      }
    }
  }
  if (ultima.parte !== 'talude') add(ultima.u1, yBorda(ultima, 1), ultima.u1, A.saia, MAT.SAIA);
  return T;
}

// ------------------------------------------------------------------------------------------------ seção

/**
 * Pontos da seção num lugar: para cada tira, os dois vértices (u, y acima do chão). É o que a varredura e a boca do
 * cruzamento usam, na mesma ordem, para as juntas saírem exatas.
 */
export function pontosDaSecao(P) {
  const pts = [];
  for (const t of P.tiras) pts.push([t.u0, t.y0], [t.u1, t.y1]);
  return pts;
}

/**
 * Pontos da pista na borda de um perfil (na ordem de u), só na altura da pista: é o contorno da boca que o polígono do
 * cruzamento usa (o canteiro e a barreira ficam de fora, tampados na ponta da aresta). { u, y }.
 */
export function bocaDaPista(P) {
  const lista = [];
  for (const t of P.tiras) {
    if (t.mat !== MAT.PISTA && t.mat !== MAT.ACOSTAMENTO && t.mat !== MAT.TERRA) continue;
    if (!lista.length || Math.abs(lista[lista.length - 1].u - t.u0) > 1e-6) lista.push({ u: t.u0, y: t.y0, b: t.b0 });
    lista.push({ u: t.u1, y: t.y1, b: t.b1 });
  }
  return lista;
}

/** Faixas de trânsito de um sentido físico (1: a para b, -1: b para a), pela mão da aresta (0 dupla, 1, -1). */
export function faixasDoSentido(P, sentido, mao = 0) {
  return P.faixas.filter((f) => {
    const s = mao === 0 ? f.sentido : f.sentido * mao;
    return s === sentido;
  });
}

/**
 * Altura da superfície da seção acima do chão em u (m): a da tira de rodagem que contém u (pista, acostamento ou
 * chão batido), com o abaulamento; fora delas, a da primeira tira não vertical. É onde a roda do carro encosta.
 */
export function alturaNaSecao(P, u) {
  let achou = null;
  for (const t of P.tiras) {
    if (t.u1 - t.u0 < 1e-9 || u < t.u0 - 1e-9 || u > t.u1 + 1e-9) continue;
    const f = (u - t.u0) / (t.u1 - t.u0);
    const y = t.y0 + (t.y1 - t.y0) * f;
    if (t.mat === MAT.PISTA || t.mat === MAT.ACOSTAMENTO || t.mat === MAT.TERRA) return y;
    achou ??= y;
  }
  return achou ?? ALTURA.pista;
}

/** Tipos na ordem de VIAS_ORDEM (para as tabelas do shader). */
export const PERFIS = Object.freeze(VIAS_ORDEM.map((id) => perfilVia(id)));

/** Largura da calçada de cada lado (m); 0 sem calçada. */
export function calcadaDoLado(P, lado) {
  return P.calcadas.find((c) => c.lado === lado)?.largura ?? 0;
}

/** Os geradores de via (malhaVia.js) registram o tipo 'vias' na oficina; este módulo só dá o perfil. */
export function registrar() {}
