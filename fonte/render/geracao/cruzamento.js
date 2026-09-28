// Nós das vias (desenho do render 4.3), puros: os cortes de cada aresta no nó e a peça que fecha o nó.
//   cruzamento  grau 3 ou mais, ou duas vias de tipos diferentes: cada aresta é recortada onde o meio-fio da esquina
//               cabe (as bordas da pista se cruzam, mais o raio do meio-fio: 5 m na rua, 8 na avenida); o polígono da
//               pista liga as bocas por arcos de concordância (em leque do nó, ou por orelhas se o leque dobrar), e
//               cada esquina ganha o meio-fio, a calçada que dobra com ele e a saia
//   curva       duas vias do mesmo tipo com ângulo: a seção inteira varre uma quadrática entre as bocas (canteiro,
//               calçadas e marcas seguem na curva)
//   ponta       via sem saída: a meia seção gira 180 graus na ponta (retorno redondo; no canteiro vira uma ilha)
//   reto        duas do mesmo tipo quase alinhadas: nada (as arestas se encontram no nó)
// As bocas saem da mesma conta da varredura (pontosDaEstacao): a junta da aresta com o nó é exata (teste A2).
// Também aqui o gerador do setor ('vias' na oficina): funde as arestas e os nós do setor numa malha por material,
// quantizada, e as posições dos postes, das árvores de rua, dos semáforos e dos carros estacionados.
import { tabelaArco } from '../../comum/bezier.js';
import { amostrar } from '../../comum/altura.js';
import { perfilVia, MAT, ALTURA, alturaNaSecao } from './perfilVia.js';
import {
  ConstrutorVia, estacao, pontosDaEstacao, gerarMalhaVia, quantizarVia, BITS, postesDaAresta, arvoresDaAresta,
  vagasDaAresta, hashF, hashI,
} from './malhaVia.js';

/** Abaixo disto (graus) duas arestas do mesmo tipo seguem retas no nó, sem peça. */
export const RETO_GRAUS = 0.5;
/** Esquina quase reta: sem arco (graus da virada). */
const VIRADA_MIN = 25;

// ------------------------------------------------------------------------------------------------ braços

/**
 * Braço de uma aresta num nó, no referencial do nó: direção para fora, bordas da pista (esquerda negativa, direita
 * positiva, olhando para fora) e o comprimento.
 * @param {{ e: number, tipo: number | string, p: ArrayLike<number>, inverte: boolean }} b  inverte: o nó é o b da aresta
 */
export function prepararBraco(b) {
  const P = perfilVia(b.tipo);
  const tab = b.tab ?? tabelaArco(b.p);
  const L = tab[16];
  const est = estacao(b.p, tab, b.inverte ? L : 0);
  const dx = b.inverte ? -est.tx : est.tx;
  const dz = b.inverte ? -est.tz : est.tz;
  return {
    ...b, P, tab, L, dx, dz, theta: Math.atan2(dz, dx),
    bE: b.inverte ? -P.bordas.d : P.bordas.e,
    bD: b.inverte ? -P.bordas.e : P.bordas.d,
  };
}

/**
 * Classifica o nó e calcula os cortes (m de arco a partir do nó) de cada braço. Devolve { tipo, bracos } com os
 * braços em ordem de ângulo e `corte` em cada um. Serve à thread principal (os cortes das arestas) e ao setor.
 * @param {{ x: number, z: number, bracos: object[] }} no
 */
export function analisarNo(no) {
  const B = no.bracos.map((b) => (b.P ? b : prepararBraco(b)));
  B.sort((a, b) => a.theta - b.theta || a.e - b.e);
  const n = B.length;
  let tipo = 'cruzamento';
  if (n === 1) tipo = 'ponta';
  else if (n === 2 && B[0].P === B[1].P) {
    const cosA = -(B[0].dx * B[1].dx + B[0].dz * B[1].dz);
    const alfa = Math.acos(Math.max(-1, Math.min(1, cosA)));
    tipo = alfa < (RETO_GRAUS * Math.PI) / 180 ? 'reto' : 'curva';
    no.alfa = alfa;
  }
  for (const b of B) b.corte = 0;
  if (tipo === 'ponta') {
    B[0].corte = Math.min(B[0].P.meia, 0.45 * B[0].L);
  } else if (tipo === 'curva') {
    // a quadrática entre as bocas precisa de raio de curvatura de 1,2 vez a meia largura no meio:
    // R = c cos²(a/2) / sen(a/2); se o corte não cabe nas arestas (grampo), vira cruzamento de dois braços
    const a = no.alfa;
    const w = B[0].P.meia;
    const c = Math.max(0.5, (1.2 * w * Math.sin(a / 2)) / Math.max(0.05, Math.cos(a / 2) ** 2));
    if (B.every((b) => c <= 0.45 * b.L)) for (const b of B) b.corte = c;
    else tipo = 'cruzamento';
  }
  if (tipo === 'cruzamento') {
    for (let i = 0; i < n; i++) {
      const A = B[i];
      const C = B[(i + 1) % n];
      const esq = esquina(A, C);
      A.corte = Math.max(A.corte, esq.cI);
      C.corte = Math.max(C.corte, esq.cJ);
    }
    for (const b of B) b.corte = Math.min(Math.max(b.corte, 1), 0.45 * b.L);
  }
  return { ...no, tipo, bracos: B };
}

/** Ângulo de A para C no sentido dos ângulos crescentes (0 a 2 pi). */
function anguloEntre(A, C) {
  let beta = C.theta - A.theta;
  while (beta <= 1e-9) beta += 2 * Math.PI;
  return beta;
}

/**
 * Esquina entre o lado direito do braço A e o esquerdo do braço C (o seguinte no ângulo): os cortes que o arco do
 * meio-fio pede (cI em A, cJ em C) e se há arco. As linhas das bordas saem do nó nas direções dos braços.
 */
function esquina(A, C) {
  const beta = anguloEntre(A, C);
  const virada = Math.PI - beta;
  const out = { cI: 0, cJ: 0, arco: false, beta };
  if (virada < (VIRADA_MIN * Math.PI) / 180) {
    // quase reta ou convexa: sem arco; se a largura muda na reta, um afunilamento
    if (Math.abs(virada) < (VIRADA_MIN * Math.PI) / 180) {
      const dw = Math.abs(A.bD - Math.abs(C.bE));
      if (dw > 0.3) out.cI = out.cJ = Math.max(2, 2.5 * dw);
    }
    return out;
  }
  // linhas: N + rA * a + dA t  e  N + rC * c + dC t' (a e c: afastamentos laterais do eixo de cada braço)
  const cruzar = (a, c) => {
    const wx = -C.dz * c + A.dz * a;
    const wz = C.dx * c - A.dx * a;
    const det = -A.dx * C.dz + A.dz * C.dx;
    if (Math.abs(det) < 1e-6) return null;
    return [(-wx * C.dz + wz * C.dx) / det, (A.dx * wz - A.dz * wx) / det];
  };
  const pista = cruzar(A.bD, C.bE);
  if (!pista) return out;
  const [t, t2] = pista;
  // o raio encolhe no ângulo agudo, mas nunca abaixo da calçada mais 0,5 m: a esquina de calçada dobra por dentro
  // do arco e não pode se cruzar
  const calcada = Math.max(A.P.meia - A.bD, C.P.meia + C.bE, 0);
  const R = Math.max(((A.P.raioEsquina + C.P.raioEsquina) / 2) * Math.min(1, Math.max(0.4, beta / (Math.PI / 2))), calcada > 0.3 ? calcada + 0.5 : 0);
  const tl = R * Math.tan(virada / 2);
  out.cI = Math.max(0, t + tl);
  out.cJ = Math.max(0, t2 + tl);
  // e as bocas ficam além de onde as bordas de fora se cruzam: as calçadas dos dois braços não se sobrepõem
  const fora = cruzar(A.P.meia, -C.P.meia);
  if (fora) {
    out.cI = Math.max(out.cI, fora[0]);
    out.cJ = Math.max(out.cJ, fora[1]);
  }
  out.arco = true;
  out.R = R;
  return out;
}

// ------------------------------------------------------------------------------------------------ geometria

/** Estação da boca de um braço (no referencial da aresta) e o sentido para fora. */
function boca(b) {
  const s = b.inverte ? b.L - b.corte : b.corte;
  const est = estacao(b.p, b.tab, s);
  return { est, s, ox: b.inverte ? -est.tx : est.tx, oz: b.inverte ? -est.tz : est.tz };
}

/** Opções da cota da aresta (ponte: greide nas cotas). */
const opCota = (b, s) => ({ ponte: !!b.ponte, s, L: b.L, cotas: b.cotas ?? [0, 0] });

/**
 * Pontos da pista na boca, no referencial do braço (da esquerda para a direita olhando para fora): [{ x, y, z, b, dy }].
 */
function pistaDaBoca(b, bo, alturaEm) {
  const P = b.P;
  const secao = pontosDaEstacao(P, bo.est, alturaEm, opCota(b, bo.s));
  const lista = [];
  P.tiras.forEach((t, j) => {
    if (t.mat !== MAT.PISTA && t.mat !== MAT.ACOSTAMENTO && t.mat !== MAT.TERRA) return;
    const a = { x: secao[j * 6], y: secao[j * 6 + 1], z: secao[j * 6 + 2], b: t.b0, dy: t.y0, u: t.u0 };
    const c = { x: secao[j * 6 + 3], y: secao[j * 6 + 4], z: secao[j * 6 + 5], b: t.b1, dy: t.y1, u: t.u1 };
    if (!lista.length || Math.abs(lista[lista.length - 1].u - a.u) > 1e-6) lista.push(a);
    lista.push(c);
  });
  return b.inverte ? lista.reverse() : lista;
}

/**
 * Perfil de fora de um lado do braço (da borda da pista para fora): { pts: [[du, dy]], mats, bs: [[b0, b1]] }, no
 * referencial do braço. lado: +1 direita, -1 esquerda.
 */
function perfilDeFora(b, lado) {
  const P = b.P;
  const direitaDaAresta = (lado > 0) !== b.inverte;
  const borda = direitaDaAresta ? P.bordas.d : P.bordas.e;
  const tiras = P.tiras.filter((t) => (direitaDaAresta ? Math.min(t.u0, t.u1) >= borda - 1e-6 : Math.max(t.u0, t.u1) <= borda + 1e-6));
  if (!direitaDaAresta) tiras.reverse();
  const pts = [];
  const mats = [];
  const bs = [];
  for (const t of tiras) {
    // do lado esquerdo da aresta a tira anda de fora para dentro: inverte
    const [u0, y0, u1, y1, b0, b1] = direitaDaAresta ? [t.u0, t.y0, t.u1, t.y1, t.b0, t.b1] : [t.u1, t.y1, t.u0, t.y0, t.b1, t.b0];
    if (!pts.length) pts.push([Math.abs(u0 - borda), y0]);
    pts.push([Math.abs(u1 - borda), y1]);
    mats.push(t.mat);
    bs.push([b0, b1]);
  }
  return { pts, mats, bs };
}

/** Curva da esquina de A (pista, direção de viagem ta) até B (direção tb): pontos [{ x, z, tx, tz }]. */
function curvaDaEsquina(A, ta, B, tb, R, arco) {
  const pts = [];
  const empurra = (x, z, tx, tz) => {
    const c = Math.hypot(tx, tz) || 1;
    pts.push({ x, z, tx: tx / c, tz: tz / c });
  };
  const reta = (x0, z0, x1, z1, tx, tz, incluirFim) => {
    const L = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.ceil(L / 8));
    for (let k = 1; k <= n; k++) {
      if (k === n && !incluirFim) break;
      empurra(x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n, tx, tz);
    }
  };
  const bez = (p0, p1, p2, p3, n) => {
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const d = t * t * t;
      const da = -3 * u * u;
      const db = 3 * u * u - 6 * u * t;
      const dc = 6 * u * t - 3 * t * t;
      const dd = 3 * t * t;
      empurra(
        a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
        da * p0[0] + db * p1[0] + dc * p2[0] + dd * p3[0], da * p0[1] + db * p1[1] + dc * p2[1] + dd * p3[1],
      );
    }
  };
  empurra(A.x, A.z, ta[0], ta[1]);
  // interseção das tangentes: A + ta l = B - tb m
  const det = ta[0] * tb[1] - ta[1] * tb[0];
  const bx = B.x - A.x;
  const bz = B.z - A.z;
  let l = -1;
  let m = -1;
  if (Math.abs(det) > 1e-6) {
    l = (bx * tb[1] - bz * tb[0]) / det;
    m = (ta[0] * bz - ta[1] * bx) / det;
  }
  const phi = Math.acos(Math.max(-1, Math.min(1, ta[0] * tb[0] + ta[1] * tb[1])));
  if (arco && l > 0.01 && m > 0.01 && phi > 0.05) {
    let tl = R * Math.tan(phi / 2);
    tl = Math.min(tl, l, m);
    const Rr = tl / Math.tan(phi / 2);
    const X = [A.x + ta[0] * l, A.z + ta[1] * l];
    const T1 = [X[0] - ta[0] * tl, X[1] - ta[1] * tl];
    const T2 = [X[0] + tb[0] * tl, X[1] + tb[1] * tl];
    if (l - tl > 0.01) reta(A.x, A.z, T1[0], T1[1], ta[0], ta[1], true);
    const h = (4 / 3) * Math.tan(phi / 4) * Rr;
    const n = Math.max(2, Math.ceil(phi / ((10 * Math.PI) / 180)));
    bez(T1, [T1[0] + ta[0] * h, T1[1] + ta[1] * h], [T2[0] - tb[0] * h, T2[1] - tb[1] * h], T2, n);
    if (m - tl > 0.01) {
      empurra(T2[0], T2[1], tb[0], tb[1]);
      reta(T2[0], T2[1], B.x, B.z, tb[0], tb[1], false);
    }
  } else {
    // sem arco (reta, afunilamento ou o lado de fora de uma curva): cúbica de Hermite pelas tangentes
    const L = Math.hypot(bx, bz);
    const h = L / 3;
    const n = Math.max(2, Math.ceil(L / 6), Math.ceil(phi / ((10 * Math.PI) / 180)));
    bez([A.x, A.z], [A.x + ta[0] * h, A.z + ta[1] * h], [B.x - tb[0] * h, B.z - tb[1] * h], [B.x, B.z], n);
  }
  empurra(B.x, B.z, tb[0], tb[1]);
  return pts;
}

/** Área com sinal (x, z) de um polígono [{ x, z }]. */
function area2(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.z - q.x * p.z;
  }
  return a / 2;
}

/** Triangulação por orelhas de um polígono simples [{ x, z }] (índices). Devolve [[i, j, k]] com a mesma orientação. */
export function orelhas(pts) {
  const n = pts.length;
  const idx = [...Array(n).keys()];
  const s = Math.sign(area2(pts)) || 1;
  const cr = (a, b, c) => (pts[b].x - pts[a].x) * (pts[c].z - pts[a].z) - (pts[b].z - pts[a].z) * (pts[c].x - pts[a].x);
  const dentro = (p, a, b, c) => {
    const d1 = cr(a, b, p) * s;
    const d2 = cr(b, c, p) * s;
    const d3 = cr(c, a, p) * s;
    return d1 > 1e-9 && d2 > 1e-9 && d3 > 1e-9;
  };
  const tris = [];
  let guarda = 0;
  while (idx.length > 3 && guarda++ < n * n) {
    let achou = false;
    for (let i = 0; i < idx.length; i++) {
      const a = idx[(i + idx.length - 1) % idx.length];
      const b = idx[i];
      const c = idx[(i + 1) % idx.length];
      if (cr(a, b, c) * s <= 1e-9) continue;
      let vazio = true;
      for (const p of idx) if (p !== a && p !== b && p !== c && dentro(p, a, b, c)) {
        vazio = false;
        break;
      }
      if (!vazio) continue;
      tris.push([a, b, c]);
      idx.splice(i, 1);
      achou = true;
      break;
    }
    if (!achou) break;
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}

/**
 * Emite uma grade varrida: secoes[k] = pontos [x, y, z] de cada ponto do perfil (2 por tira) e as tiras
 * { mat, b0, b1, u0, u1, y0, y1 }. v[k] é o comprimento andado; a normal sai da geometria (lateral x longitudinal, ou
 * o contrário com `vira`).
 */
function emitirGrade(K, secoes, tiras, v, { ox, oz, id, tipo, marcas, vira = false, total = 0, pular = null }) {
  const ns = secoes.length;
  const nT = tiras.length;
  const base = K.nv;
  const n = [0, 0, 0];
  for (let k = 0; k < ns; k++) {
    const S = secoes[k];
    const A = secoes[Math.max(0, k - 1)];
    const Bq = secoes[Math.min(ns - 1, k + 1)];
    for (let j = 0; j < nT; j++) {
      const tr = tiras[j];
      const o0 = j * 6;
      let lx = S[o0 + 3] - S[o0];
      let ly = S[o0 + 4] - S[o0 + 1];
      let lz = S[o0 + 5] - S[o0 + 2];
      for (let lado = 0; lado < 2; lado++) {
        const o = o0 + lado * 3;
        const gx = Bq[o] - A[o];
        const gy = Bq[o + 1] - A[o + 1];
        const gz = Bq[o + 2] - A[o + 2];
        if (Math.abs(lx) + Math.abs(ly) + Math.abs(lz) < 1e-9) {
          // tira degenerada (o centro do retorno): a lateral é a do vizinho de cima
          lx = -gz;
          ly = 0;
          lz = gx;
        }
        n[0] = ly * gz - lz * gy;
        n[1] = lz * gx - lx * gz;
        n[2] = lx * gy - ly * gx;
        if (vira) {
          n[0] = -n[0];
          n[1] = -n[1];
          n[2] = -n[2];
        }
        const c = Math.hypot(n[0], n[1], n[2]) || 1;
        const b = lado ? tr.b1 : tr.b0;
        const dy = lado ? tr.y1 : tr.y0;
        const ao = tr.mat === MAT.SAIA ? (dy < 0 ? 0.35 : 0.8) : tr.mat === MAT.MEIO_FIO && dy <= ALTURA.pista + 1e-3 ? 0.62 : 1;
        K.vert(S[o] - ox, S[o + 1], S[o + 2] - oz, n[0] / c, n[1] / c, n[2] / c, lado ? tr.u1 : tr.u0, v[k], total - v[k], b, tr.mat, tipo, marcas, ao, id);
      }
    }
  }
  const p = K.pos;
  const degenerado = (a, b) => Math.abs(p[3 * a] - p[3 * b]) + Math.abs(p[3 * a + 1] - p[3 * b + 1]) + Math.abs(p[3 * a + 2] - p[3 * b + 2]) < 1e-7;
  for (let k = 0; k + 1 < ns; k++) {
    if (pular?.(k)) continue;
    for (let j = 0; j < nT; j++) {
      const a = base + (k * nT + j) * 2;
      const b = a + 1;
      const c = base + ((k + 1) * nT + j) * 2;
      const d = c + 1;
      const t1 = vira ? [a, c, b] : [a, b, c];
      const t2 = vira ? [b, c, d] : [b, d, c];
      if (!degenerado(t1[0], t1[1]) && !degenerado(t1[1], t1[2]) && !degenerado(t1[0], t1[2])) K.tri(...t1);
      if (!degenerado(t2[0], t2[1]) && !degenerado(t2[1], t2[2]) && !degenerado(t2[0], t2[2])) K.tri(...t2);
    }
  }
}

/**
 * Peça do nó (cruzamento, curva ou ponta) no construtor. `no` já analisado (analisarNo). op: { alturaEm, ox, oz, id }.
 * id da peça: o idx da aresta mais larga do nó (as camadas pintam o nó com ela).
 */
export function gerarNo(no, K, op) {
  if (no.tipo === 'cruzamento') return gerarCruzamento(no, K, op);
  if (no.tipo === 'curva') return gerarCurva(no, K, op);
  if (no.tipo === 'ponta') return gerarPonta(no, K, op);
  return K;
}

/** Id da peça do nó: a aresta do braço mais largo (desempate pelo menor idx). */
const idDoNo = (no) => no.bracos.reduce((m, b) => (b.P.largura > m.P.largura || (b.P.largura === m.P.largura && b.e < m.e) ? b : m), no.bracos[0]).e;

function gerarCruzamento(no, K, op) {
  const { alturaEm, ox = 0, oz = 0 } = op;
  const B = no.bracos;
  const n = B.length;
  const id = idDoNo(no);
  const tipo = B.reduce((m, b) => (b.P.largura > m.P.largura ? b : m), B[0]).P.idx;
  const bocas = B.map((b) => {
    const bo = boca(b);
    return { bo, pista: pistaDaBoca(b, bo, alturaEm) };
  });
  // contorno da pista: boca de cada braço (esquerda para a direita) e a esquina até o seguinte
  const contorno = [];
  const esquinas = [];
  for (let i = 0; i < n; i++) {
    const A = B[i];
    const C = B[(i + 1) % n];
    const bi = bocas[i];
    const bj = bocas[(i + 1) % n];
    for (const q of bi.pista) contorno.push({ ...q, borda: false });
    if (n === 1) break;
    const pA = bi.pista[bi.pista.length - 1];
    const pB = bj.pista[0];
    const esq = esquina(A, C);
    const curva = curvaDaEsquina(pA, [-bi.bo.ox, -bi.bo.oz], pB, [bj.bo.ox, bj.bo.oz], esq.R ?? A.P.raioEsquina, esq.arco);
    const m = curva.length - 1;
    for (let k = 1; k < m; k++) {
      const f = k / m;
      const q = curva[k];
      const dy = pA.dy + (pB.dy - pA.dy) * f;
      contorno.push({ x: q.x, y: alturaEm(q.x, q.z) + dy, z: q.z, b: 0, dy, borda: true });
    }
    esquinas.push({ A, C, curva, pA, pB });
  }
  // leque do nó, ou orelhas se o leque dobrar
  const cx = no.x;
  const cz = no.z;
  const cy = alturaEm(cx, cz) + ALTURA.pista + 0.03;
  const s = Math.sign(area2(contorno)) || 1;
  let leque = true;
  for (let k = 0; k < contorno.length && leque; k++) {
    const p = contorno[k];
    const q = contorno[(k + 1) % contorno.length];
    const cr = ((p.x - cx) * (q.z - cz) - (p.z - cz) * (q.x - cx)) * s;
    if (cr <= 1e-6) leque = false;
  }
  const marcas = BITS.CRUZAMENTO;
  const nrm = (x, z) => {
    const gx = (alturaEm(x + 1, z) - alturaEm(x - 1, z)) / 2;
    const gz = (alturaEm(x, z + 1) - alturaEm(x, z - 1)) / 2;
    const c = Math.hypot(gx, 1, gz);
    return [-gx / c, 1 / c, -gz / c];
  };
  const iv = contorno.map((p) => K.vert(p.x - ox, p.y, p.z - oz, ...nrm(p.x, p.z), 0, 0, 0, p.b, MAT.PISTA, tipo, marcas, p.borda ? 0.85 : 1, id));
  if (leque) {
    const ic = K.vert(cx - ox, cy, cz - oz, ...nrm(cx, cz), 0, 0, 0, 6, MAT.PISTA, tipo, marcas, 1, id);
    for (let k = 0; k < contorno.length; k++) K.triOrientado(ic, iv[k], iv[(k + 1) % contorno.length]);
  } else {
    for (const [a, b, c] of orelhas(contorno)) K.triOrientado(iv[a], iv[b], iv[c]);
  }
  // esquinas: meio-fio, calçada e saia (ou talude) que dobram com a curva
  for (const { A, C, curva } of esquinas) {
    const fa = perfilDeFora(A, 1);
    const fc = perfilDeFora(C, -1);
    const compat = fa.mats.length === fc.mats.length && fa.mats.every((m, k) => m === fc.mats[k]);
    const m = curva.length - 1;
    const faixa = (k0, k1, perfil) => {
      const secoes = [];
      const v = [];
      let dist = 0;
      for (let k = k0; k <= k1; k++) {
        const q = curva[k];
        if (k > k0) dist += Math.hypot(q.x - curva[k - 1].x, q.z - curva[k - 1].z);
        v.push(dist);
        const f = m ? k / m : 0;
        const pts = perfil(f);
        const nx = q.tz;
        const nz = -q.tx;
        const S = new Float64Array(pts.pts.length * 6);
        // 2 por tira
        let o = 0;
        for (let j = 0; j + 1 < pts.pts.length; j++) {
          for (const [du, dy] of [pts.pts[j], pts.pts[j + 1]]) {
            const x = q.x + nx * du;
            const z = q.z + nz * du;
            S[o++] = x;
            S[o++] = alturaEm(x, z) + dy;
            S[o++] = z;
          }
        }
        secoes.push(S);
      }
      const base = perfil(0);
      const tiras = base.mats.map((mat, j) => ({ mat, b0: base.bs[j][0], b1: base.bs[j][1], u0: base.pts[j][0], u1: base.pts[j + 1][0], y0: base.pts[j][1], y1: base.pts[j + 1][1] }));
      emitirGrade(K, secoes, tiras, v, { ox, oz, id, tipo, marcas: marcas | (A.marcas ?? 0) & BITS.PEDRA, vira: true, total: dist });
    };
    if (compat) {
      faixa(0, m, (f) => ({
        pts: fa.pts.map((p, j) => [p[0] + (fc.pts[j][0] - p[0]) * f, p[1] + (fc.pts[j][1] - p[1]) * f]),
        mats: fa.mats,
        bs: fa.bs.map((b, j) => [b[0] + (fc.bs[j][0] - b[0]) * f, b[1] + (fc.bs[j][1] - b[1]) * f]),
      }));
    } else {
      // perfis diferentes (rua com rodovia): metade de cada, fechadas no meio
      const meio = Math.max(1, Math.floor(m / 2));
      faixa(0, meio, () => fa);
      faixa(meio, m, () => fc);
    }
  }
  return K;
}

/** Meia seção (u >= 0) do perfil, cortando as tiras que cruzam o eixo. */
function meiaSecao(P) {
  const out = [];
  for (const t of P.tiras) {
    if (t.u1 <= 1e-9 && t.u0 <= 1e-9) continue;
    if (t.u0 < 0 && t.u1 > 0) {
      const f = -t.u0 / (t.u1 - t.u0);
      out.push({ ...t, u0: 0, y0: t.y0 + (t.y1 - t.y0) * f, b0: t.b0 + (t.b1 - t.b0) * f });
    } else out.push(t);
  }
  return out;
}

function gerarPonta(no, K, op) {
  const { alturaEm, ox = 0, oz = 0 } = op;
  const b = no.bracos[0];
  const P = b.P;
  const bo = boca(b);
  const est = bo.est;
  const rx = -est.tz;
  const rz = est.tx;
  const tiras = meiaSecao(P);
  const passos = 12;
  const secoes = [];
  const v = [];
  const raio = P.meia;
  // a volta cresce da boca para o nó (o sentido contrário ao "para fora" do braço, que entra na aresta)
  const fx = -bo.ox;
  const fz = -bo.oz;
  for (let k = 0; k <= passos; k++) {
    const phi = (Math.PI * k) / passos;
    const c = Math.cos(phi);
    const sn = Math.sin(phi);
    const dx = rx * c + fx * sn;
    const dz = rz * c + fz * sn;
    const S = new Float64Array(tiras.length * 6);
    let o = 0;
    for (const t of tiras) {
      for (const [u, dy] of [[t.u0, t.y0], [t.u1, t.y1]]) {
        const x = est.x + dx * u;
        const z = est.z + dz * u;
        S[o++] = x;
        S[o++] = b.ponte ? (b.cotas?.[b.inverte ? 1 : 0] ?? 0) - ALTURA.pista + dy : alturaEm(x, z) + dy;
        S[o++] = z;
      }
    }
    secoes.push(S);
    v.push(phi * raio);
  }
  // o sentido da volta: de +r (direita da aresta) para o nó e para -r; a normal (lateral x avanço) sai para cima se
  // r x f aponta para cima; senão a grade vira
  const vira = rx * fz - rz * fx >= 0;
  emitirGrade(K, secoes, tiras, v, { ox, oz, id: b.e, tipo: P.idx, marcas: BITS.CRUZAMENTO | ((b.marcas ?? 0) & BITS.PEDRA), vira, total: Math.PI * raio });
  return K;
}

function gerarCurva(no, K, op) {
  const { alturaEm, ox = 0, oz = 0 } = op;
  const [A, C] = no.bracos;
  const P = A.P;
  const ba = boca(A);
  const bc = boca(C);
  // quadrática entre as bocas, com o controle no encontro das tangentes (ou no nó)
  const q0 = [ba.est.x, ba.est.z];
  const q2 = [bc.est.x, bc.est.z];
  let q1 = [no.x, no.z];
  const ta = [-ba.ox, -ba.oz];
  const tc = [-bc.ox, -bc.oz];
  const det = ta[0] * -tc[1] - ta[1] * -tc[0];
  if (Math.abs(det) > 1e-6) {
    const bx = q2[0] - q0[0];
    const bz = q2[1] - q0[1];
    const l = (bx * -tc[1] - bz * -tc[0]) / det;
    if (l > 0 && l < 4 * (A.corte + C.corte + 1)) q1 = [q0[0] + ta[0] * l, q0[1] + ta[1] * l];
  }
  // lateral: a direita da aresta A na boca dela; sg = +1 se a varredura anda no sentido da aresta A
  const sg = A.inverte ? 1 : -1;
  // a outra ponta casa com a aresta C sem inverter o lado? (senão a seção entra espelhada: perfis simétricos)
  const sgC = C.inverte ? -1 : 1;
  const invC = sg !== sgC;
  const simetrico = P.linhas.every((l) => P.linhas.some((m) => Math.abs(m.u + l.u) < 1e-6 && m.cor === l.cor && m.estilo === l.estilo));
  const marcas = (invC && !simetrico ? BITS.CRUZAMENTO : 0) | ((A.marcas ?? 0) & BITS.PEDRA);
  const ang = no.alfa ?? 0.5;
  const passos = Math.max(2, Math.ceil(ang / ((3 * Math.PI) / 180)));
  const secoes = [];
  const v = [];
  let dist = 0;
  let ant = null;
  for (let k = 0; k <= passos; k++) {
    const t = k / passos;
    const u = 1 - t;
    const x = u * u * q0[0] + 2 * u * t * q1[0] + t * t * q2[0];
    const z = u * u * q0[1] + 2 * u * t * q1[1] + t * t * q2[1];
    let tx = 2 * u * (q1[0] - q0[0]) + 2 * t * (q2[0] - q1[0]);
    let tz = 2 * u * (q1[1] - q0[1]) + 2 * t * (q2[1] - q1[1]);
    const c = Math.hypot(tx, tz) || 1;
    tx /= c;
    tz /= c;
    // nas pontas, as estações das próprias arestas (juntas exatas)
    let S;
    if (k === 0) S = pontosDaEstacao(P, ba.est, alturaEm, opCota(A, ba.s));
    else if (k === passos && !invC) S = pontosDaEstacao(P, bc.est, alturaEm, opCota(C, bc.s));
    else if (k === passos) {
      // a aresta C anda ao contrário: o ponto u da varredura é o -u dela (perfis simétricos)
      const e2 = { x: bc.est.x, z: bc.est.z, tx: -bc.est.tx, tz: -bc.est.tz, t: 0 };
      S = pontosDaEstacao(P, e2, alturaEm, opCota(C, bc.s));
    } else {
      const e = { x, z, tx: tx * sg, tz: tz * sg, t: 0 };
      S = pontosDaEstacao(P, e, alturaEm, opCota(A, ba.s));
    }
    secoes.push(S);
    if (ant) dist += Math.hypot(x - ant[0], z - ant[1]);
    v.push(dist);
    ant = [x, z];
  }
  // lateral x longitudinal aponta para cima quando a lateral (direita da aresta A) e o avanço formam um par direito
  const r0x = -ba.est.tz;
  const r0z = ba.est.tx;
  const cima = r0x * ta[1] - r0z * ta[0] < 0;
  emitirGrade(K, secoes, P.tiras, v, { ox, oz, id: A.e, tipo: P.idx, marcas, vira: !cima, total: dist });
  return K;
}

// ------------------------------------------------------------------------------------------------ setor

/** Tipos de objeto da rua que o setor devolve (instâncias). */
export const OBJETOS = Object.freeze(['posteSimples', 'posteDuplo', 'posteRural', 'copa', 'palmeira', 'semaforo']);

/** Frota brasileira (cores sRGB, participação): branco, prata, preto e cinza passam de 80% (desenho do render 8). */
export const FROTA_CORES = Object.freeze([
  ['#e9e9e6', 0.36], ['#b9bcbf', 0.24], ['#1c1d1f', 0.17], ['#6c7074', 0.11], ['#8e2a25', 0.05], ['#2f4668', 0.03],
  ['#4b5a3c', 0.01], ['#b8a88a', 0.02], ['#c4b24a', 0.01],
]);
/** Modelos de carro estacionado (índice em veiculos.MODELOS) e o peso. */
const ESTACIONADOS = Object.freeze([[0, 0.36], [1, 0.26], [2, 0.22], [3, 0.14], [5, 0.02]]);

/** Escolha por peso com um número de 0 a 1. */
export function porPeso(lista, h) {
  let soma = 0;
  for (const [, p] of lista) soma += p;
  let a = h * soma;
  for (const [v, p] of lista) {
    a -= p;
    if (a < 0) return v;
  }
  return lista[lista.length - 1][0];
}

/** Matriz 4 x 4 (coluna maior, como o three) de translação, giro em y e escala. */
function matriz(out, o, x, y, z, rot, sx, sy = sx, sz = sx) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  out[o] = c * sx;
  out[o + 1] = 0;
  out[o + 2] = -s * sx;
  out[o + 3] = 0;
  out[o + 4] = 0;
  out[o + 5] = sy;
  out[o + 6] = 0;
  out[o + 7] = 0;
  out[o + 8] = s * sz;
  out[o + 9] = 0;
  out[o + 10] = c * sz;
  out[o + 11] = 0;
  out[o + 12] = x;
  out[o + 13] = y;
  out[o + 14] = z;
  out[o + 15] = 1;
}

/** Lista de instâncias no formato de ListaCompactada (mat, bytes, ids, n). */
function listaDe(itens) {
  const n = itens.length;
  const mat = new Float32Array(n * 16);
  const bytes = new Uint8Array(n * 4);
  const ids = new Uint32Array(n);
  itens.forEach((it, k) => {
    matriz(mat, k * 16, it.x, it.y, it.z, it.rot, it.sx ?? 1, it.sy ?? it.sx ?? 1, it.sz ?? it.sx ?? 1);
    bytes.set(it.b ?? [0, 0, 0, 0], k * 4);
    ids[k] = it.id ?? 0;
  });
  return { mat, bytes, ids, n };
}

/**
 * Semáforo de um braço: o grupo (0 os braços perto de leste-oeste, 1 os de norte-sul, pela direção do braço) e a
 * defasagem do cruzamento (0 a 255). O foco no shader (via.glsl.js, objFase) e o tráfego (trafego.js,
 * faseSemaforo) usam os mesmos dois números.
 */
export const grupoSemaforo = (theta) => Math.floor(((((theta % Math.PI) + Math.PI) % Math.PI) + Math.PI / 4) / (Math.PI / 2)) % 2;
export const defasagemSemaforo = (n) => hashI(n, 0, 0) & 255;

/** Rotação (convenção do three) que leva +z local para a direção (dx, dz). */
const rotDe = (dx, dz) => Math.atan2(dx, dz);

/**
 * Gera o setor de vias (tipo 'vias' da oficina). Pedido:
 * { setor, versao, ox, oz, chao: { ox, oz, n, passo, altura }, arestas: [{ e, tipo, p, sIni, sFim, s0, s1, marcas,
 *   ponte, cotas, tampaIni, tampaFim, mao, objetos }], nos: [{ n, x, z, bracos: [{ e, tipo, p, inverte, marcas, ponte,
 *   cotas }], semaforos }], vagas: 0..1 }
 * Resposta: { setor, versao, malhas: [malha quantizada], objetos: { tipo: lista }, estacionados: [[modelo, lista]],
 *   tris }. As posições dos objetos vêm em coordenadas do mundo (as instâncias não são relativas ao setor). Sem relógio
 * (render/geracao é determinístico): quem pede mede o tempo.
 */
export function gerarSetorVias(dados) {
  const { ox = 0, oz = 0, chao } = dados;
  const alturaEm = chao ? (x, z) => amostrar(chao.altura, chao.n, chao.passo, chao.ox, chao.oz, x, z) : () => 0;
  const K = new ConstrutorVia(4096);
  const obj = Object.fromEntries(OBJETOS.map((t) => [t, []]));
  const carros = [];
  for (const a of dados.arestas ?? []) {
    const P = perfilVia(a.tipo);
    const p = Float64Array.from(a.p);
    gerarMalhaVia({ ...a, p, id: a.e }, P, { alturaEm, ox, oz, K });
    if (a.objetos === false) continue;
    // objetos só no trecho desta malha (a aresta longa se divide entre setores)
    const tab = tabelaArco(p);
    const noTrecho = (q) => q.s >= (a.s0 ?? a.sIni) - 1e-6 && q.s < (a.s1 ?? a.sFim) - 1e-6 || (q.s >= a.sFim - 1e-6 && (a.s1 ?? a.sFim) >= a.sFim - 1e-6);
    const cota = (x, z) => (a.ponte ? null : alturaEm(x, z));
    for (const q of postesDaAresta(p, P, a.sIni, a.sFim, a.e, tab)) {
      if (!noTrecho(q) || a.ponte) continue;
      const y = cota(q.x, q.z) + (q.lado === 0 ? ALTURA.calcada : ALTURA.calcada + 0.04);
      const tipoPoste = q.modelo === 'duplo' ? 'posteDuplo' : q.modelo === 'rural' ? 'posteRural' : 'posteSimples';
      obj[tipoPoste].push({ x: q.x, y, z: q.z, rot: rotDe(q.dx, q.dz), sx: 1, sy: q.altura / 10, sz: q.braco / 2, id: a.e, b: [q.lado === 0 ? 1 : 0, hashI(a.e, Math.round(q.s)) & 255, 0, 0] });
    }
    for (const q of arvoresDaAresta(p, P, a.sIni, a.sFim, a.e, tab)) {
      if (!noTrecho(q) || a.ponte) continue;
      const y = cota(q.x, q.z) + ALTURA.calcada;
      obj[q.especie].push({ x: q.x, y, z: q.z, rot: (q.semente % 628) / 100, sx: q.escala, id: a.e, b: [q.semente & 255, (q.semente >>> 8) & 255, 0, 0] });
    }
    if (dados.vagas > 0 && !a.ponte) {
      for (const q of vagasDaAresta(p, P, a.sIni, a.sFim, a.e, a.mao ?? 0, dados.vagas, tab)) {
        if (!noTrecho(q)) continue;
        const h = hashF(q.semente, 3);
        const modelo = porPeso(ESTACIONADOS, h);
        const cor = porPeso(FROTA_CORES.map(([c, w], k) => [k, w]), hashF(q.semente, 5));
        carros.push({ modelo, x: q.x, y: alturaEm(q.x, q.z) + alturaNaSecao(P, q.u), z: q.z, rot: rotDe(q.dx, q.dz), id: a.e, b: [cor, 0, 0, 0] });
      }
    }
  }
  for (const nd of dados.nos ?? []) {
    const no = analisarNo({ ...nd, bracos: nd.bracos.map((b) => ({ ...b, p: Float64Array.from(b.p) })) });
    gerarNo(no, K, { alturaEm, ox, oz });
    if (nd.semaforos && no.tipo === 'cruzamento') {
      for (const b of no.bracos) {
        if (b.P.terra) continue;
        // no lado direito de quem chega (a esquerda do braço olhando para fora), virado para quem chega
        const bo = boca(b);
        const rx = -bo.oz;
        const rz = bo.ox;
        const u = b.bE - 0.7;
        const s = 1.5;
        const x = bo.est.x + rx * u + bo.ox * s;
        const z = bo.est.z + rz * u + bo.oz * s;
        obj.semaforo.push({ x, y: alturaEm(x, z) + ALTURA.calcada, z, rot: rotDe(rx, rz), sx: 1, sz: Math.min(1.4, Math.max(0.6, (b.bD - b.bE) / 14)), id: b.e, b: [grupoSemaforo(b.theta), defasagemSemaforo(nd.n), 0, 0] });
      }
    }
  }
  const objetos = {};
  for (const t of OBJETOS) objetos[t] = listaDe(obj[t]);
  const porModelo = new Map();
  for (const c of carros) {
    if (!porModelo.has(c.modelo)) porModelo.set(c.modelo, []);
    porModelo.get(c.modelo).push(c);
  }
  const estacionados = [...porModelo].map(([m, l]) => [m, listaDe(l)]);
  const malhas = K.nv ? [quantizarVia(K)] : [];
  return { setor: dados.setor, versao: dados.versao, malhas, objetos, estacionados, tris: K.tris };
}

/** Registra o gerador do setor de vias no worker `oficina` (D45). */
export function registrar({ registrarGeradorOficina } = {}) {
  registrarGeradorOficina?.('vias', gerarSetorVias);
}
