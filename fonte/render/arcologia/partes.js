// Silhuetas LOD1 das partes da Arcologia (D26, D59): a Sede com as Torres do Conselho, o Anel de moradia, a
// Biblioteca, a Vida, a Escola, a Universidade, a Física, o pódio de quarteirão e a barragem. Cada peça do plano
// (data/arcologia-plano.js) vira volumes com a fachada no shader (material vidro, tipo por vértice) e acabamentos
// (material opaco), em coordenadas do mundo, assentados no relevo por chao(x, z). As mesmas malhas servem ao plano
// construído (maquete da cena 'planos') e ao fantasma do jogo (fantasma.js).
//
// Referências: Torres do Conselho (Tencent Seafront, Bloomberg London), Sede (Apple Park, Google Bay View), Anel
// (Marina One, The Interlace, Tietgen), Biblioteca (Biblioteca Nacional do Catar, Tianjin Binhai), Vida (Jewel
// Changi, Gardens by the Bay), Escola (CEU), Universidade (Rolex Learning Center), Física (CERN Science Gateway,
// MAX IV), pódio (Hudson Yards), barragem (Marina Barrage).
import {
  Malha, acab, vid, VIDRO, PADRAO, LUZ, prisma, tampa, caixa, cilindro, torno, arvore, hashF, orientar, barra, parede,
} from './torre.js';
import { rotParaOlhar } from '../../data/arcologia-plano.js';

// acabamentos das partes
const K = {
  pedra: acab('#c3b79f', { rugo: 0.72, padrao: PADRAO.pedra }),
  concreto: acab('#a9a397', { rugo: 0.8 }),
  concretoClaro: acab('#c8c2b6', { rugo: 0.75 }),
  champanhe: acab('#b8a684', { rugo: 0.32, metal: 1, padrao: PADRAO.metal }),
  metalClaro: acab('#b9b8b3', { rugo: 0.35, metal: 1, padrao: PADRAO.metal }),
  metalEscuro: acab('#3a3c40', { rugo: 0.5, metal: 0.6 }),
  solar: acab('#252c38', { rugo: 0.25, metal: 0.4, padrao: PADRAO.solar }),
  telhadoVerde: acab('#435031', { rugo: 0.95, padrao: PADRAO.grama }),
  jardim: acab('#3d4a2c', { rugo: 0.9, padrao: PADRAO.folha }),
  grama: acab('#4f5c36', { rugo: 0.95, padrao: PADRAO.grama }),
  gramado: acab('#3f5a33', { rugo: 0.9, padrao: PADRAO.grama }),
  pista: acab('#7a5b4c', { rugo: 0.9 }),
  piso: acab('#b1a797', { rugo: 0.8, padrao: PADRAO.piso }),
  granito: acab('#6a655f', { rugo: 0.6, padrao: PADRAO.pedra }),
  arenito: acab('#b39a78', { rugo: 0.85, padrao: PADRAO.pedra }),
  cobertura: acab('#8e8a84', { rugo: 0.7 }),
  tronco: acab('#3f4a2d', { rugo: 0.9, padrao: PADRAO.folha }),
  copaSuper: acab('#2f3236', { rugo: 0.45, metal: 0.7, luz: LUZ.arvoreLuz }),
  vortice: acab('#9fb9c0', { rugo: 0.1, metal: 0.1, luz: LUZ.esfera }),
  comporta: acab('#4a4d52', { rugo: 0.45, metal: 0.8, padrao: PADRAO.metal }),
};

/** Ponto de um arco em graus (0 leste, 90 sul). */
const noArco = (cx, cz, r, g) => [cx + r * Math.cos((g * Math.PI) / 180), cz + r * Math.sin((g * Math.PI) / 180)];

/** Leva um polígono local (pares) ao mundo: gira por rot (convenção do three) e soma (x, z). */
export function aoMundo(poly, x, z, rot) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const out = [];
  for (let i = 0; i < poly.length; i += 2) out.push(x + c * poly[i] + s * poly[i + 1], z - s * poly[i] + c * poly[i + 1]);
  return out;
}

/** Retângulo de cantos arredondados (w x d, raio r), centrado na origem. */
export function retArredondado(w, d, r, seg = 4) {
  const P = [];
  const cantos = [[w / 2 - r, d / 2 - r, 0], [-w / 2 + r, d / 2 - r, 90], [-w / 2 + r, -d / 2 + r, 180], [w / 2 - r, -d / 2 + r, 270]];
  for (const [cx, cz, a0] of cantos) {
    for (let s = 0; s <= seg; s++) {
      const a = ((a0 + (90 * s) / seg) * Math.PI) / 180;
      P.push(cx + Math.cos(a) * r, cz + Math.sin(a) * r);
    }
  }
  return orientar(P);
}

/** Elipse de semi-eixos a (x) e b (z) em seg pontos. */
export function elipse(a, b, seg = 32) {
  const P = [];
  for (let s = 0; s < seg; s++) {
    const t = (s / seg) * Math.PI * 2;
    P.push(Math.cos(t) * a, Math.sin(t) * b);
  }
  return P;
}

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

/** Faixa horizontal entre dois polígonos de mesmo número de pontos (anel), na cota y, virada para cima ou baixo. */
export function faixaEntre(m, A, B, y, k, cima = true, yB = y) {
  const n = A.length / 2;
  const ny = cima ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    m.quad([A[2 * i], y, A[2 * i + 1]], [A[2 * j], y, A[2 * j + 1]], [B[2 * j], yB, B[2 * j + 1]], [B[2 * i], yB, B[2 * i + 1]], [0, ny, 0], [A[2 * i], A[2 * i + 1]], [A[2 * j], A[2 * j + 1]], [B[2 * j], B[2 * j + 1]], [B[2 * i], B[2 * i + 1]], k);
  }
}

/** Paredes de um polígono (todas as arestas) de y0 a y1, com v medido desde vBase; fora = normal para fora. */
function paredes(m, poly, y0, y1, k, vBase = y0, fora = true) {
  const P = orientar(poly);
  const n = P.length / 2;
  let u = 0;
  for (let i = 0; i < n; i++) {
    let ax = P[2 * i], az = P[2 * i + 1];
    let bx = P[2 * ((i + 1) % n)], bz = P[2 * ((i + 1) % n) + 1];
    const l = Math.hypot(bx - ax, bz - az);
    if (!fora) [ax, az, bx, bz] = [bx, bz, ax, az];
    const nn = [(bz - az) / (l || 1), 0, -(bx - ax) / (l || 1)];
    m.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], nn, [u, y0 - vBase], [u + l, y0 - vBase], [u + l, y1 - vBase], [u, y1 - vBase], k);
    u += l;
  }
}

// ================================================================================================ peças

/** Torre do Conselho: 36 x 26 com cantos de 6 m, saguão recuado, corpo em moldura de pedra e coroa com aba. */
function conselho(g, p) {
  const rot = p.olhar ? rotParaOlhar(p.x, p.z, p.olhar[0], p.olhar[1]) : p.rot ?? 0;
  const y = g.chao(p.x, p.z);
  const H = p.altura;
  const sem = hashF(Math.round(p.x), Math.round(p.z));
  const k = vid(VIDRO.escritorio, sem);
  const ret = (d) => aoMundo(retArredondado(36 + 2 * d, 26 + 2 * d, Math.max(1, 6 + d), 4), p.x, p.z, rot);
  prisma(g.opaco, ret(1), y - 3, y + 0.6, { paredes: K.granito, topo: K.piso });
  paredes(g.vidro, ret(-1.6), y + 0.6, y + 9, vid(VIDRO.saguao, sem), y);
  // pilares do saguão nos cantos
  tampa(g.opaco, ret(0), y + 9, K.concretoClaro, false);
  paredes(g.vidro, ret(0), y + 9, y + H - 8.4, k, y);
  // coroa: dois andares recuados e a aba fina de pedra
  paredes(g.vidro, ret(-1.2), y + H - 8.4, y + H, k, y);
  tampa(g.opaco, ret(0), y + H - 8.4, K.concretoClaro, true);
  prisma(g.opaco, ret(1.2), y + H, y + H + 0.9, { paredes: K.pedra, topo: K.cobertura, base: K.pedra });
  prisma(g.opaco, aoMundo(retArredondado(16, 10, 2, 2), p.x, p.z, rot), y + H + 0.9, y + H + 5, { paredes: K.metalEscuro, topo: K.cobertura });
  g.caixa([p.x, y, p.z], 26, H + 5);
}

/**
 * Sede: faixa curva ao longo de um arco (Apple Park), moldura de pedra de dois andares (Bloomberg) e a cobertura
 * solar em escamas que avança sobre as fachadas (Google Bay View), com o térreo recuado.
 */
function sede(g, p) {
  const { cx, cz, r, de, ate } = p.arco;
  const f = p.fundo;
  const H = p.altura;
  const passo = 3;
  const n = Math.max(4, Math.ceil(Math.abs(ate - de) / passo));
  const sem = hashF(Math.round(cx), Math.round(r));
  const k = vid(VIDRO.escritorio, sem);
  const y = g.chao(...noArco(cx, cz, r, (de + ate) / 2));
  const faixa = (r0, r1) => {
    const P = [];
    for (let s = 0; s <= n; s++) P.push(...noArco(cx, cz, r1, de + ((ate - de) * s) / n));
    for (let s = n; s >= 0; s--) P.push(...noArco(cx, cz, r0, de + ((ate - de) * s) / n));
    return P;
  };
  const r0 = r - f / 2;
  const r1 = r + f / 2;
  prisma(g.opaco, faixa(r0 - 3, r1 + 3), y - 2, y + 0.5, { paredes: K.granito, topo: K.piso });
  paredes(g.vidro, faixa(r0 + 2, r1 - 2), y + 0.5, y + 6, vid(VIDRO.saguao, sem), y);
  tampa(g.opaco, faixa(r0, r1), y + 6, K.concretoClaro, false);
  paredes(g.vidro, faixa(r0, r1), y + 6, y + H, k, y);
  tampa(g.opaco, faixa(r0, r1), y + H, K.cobertura, true);
  // escamas: um vão de cobertura a cada ~6 graus, cumeeira no eixo e beirais de 3 m; alturas alternadas
  const vaos = Math.max(3, Math.round(Math.abs(ate - de) / 6));
  for (let v = 0; v < vaos; v++) {
    const a0 = de + ((ate - de) * v) / vaos;
    const a1 = de + ((ate - de) * (v + 1)) / vaos;
    const hc = H + (v % 2 ? 3.2 : 5);
    const q = 6;
    for (let s = 0; s < q; s++) {
      const b0 = a0 + ((a1 - a0) * s) / q;
      const b1 = a0 + ((a1 - a0) * (s + 1)) / q;
      const Pa = (rr, b) => [...noArco(cx, cz, rr, b)];
      const [xo0, zo0] = Pa(r1 + 3, b0), [xo1, zo1] = Pa(r1 + 3, b1);
      const [xi0, zi0] = Pa(r0 - 3, b0), [xi1, zi1] = Pa(r0 - 3, b1);
      const [xm0, zm0] = Pa(r, b0), [xm1, zm1] = Pa(r, b1);
      const nf = [xo0 - xm0, 0, zo0 - zm0];
      const l = Math.hypot(nf[0], nf[2]) || 1;
      const inc = (hc - H) / (f / 2 + 3);
      const n1 = [(nf[0] / l) * inc, 1, (nf[2] / l) * inc];
      const n2 = [-(nf[0] / l) * inc, 1, -(nf[2] / l) * inc];
      g.opaco.quad([xm0, y + hc, zm0], [xm1, y + hc, zm1], [xo1, y + H + 0.6, zo1], [xo0, y + H + 0.6, zo0], n1, [xm0, zm0], [xm1, zm1], [xo1, zo1], [xo0, zo0], K.solar);
      g.opaco.quad([xm0, y + hc, zm0], [xm1, y + hc, zm1], [xi1, y + H + 0.6, zi1], [xi0, y + H + 0.6, zi0], n2, [xm0, zm0], [xm1, zm1], [xi1, zi1], [xi0, zi0], K.solar);
      g.opaco.quad([xm0, y + hc - 0.4, zm0], [xm1, y + hc - 0.4, zm1], [xo1, y + H + 0.2, zo1], [xo0, y + H + 0.2, zo0], [0, -1, 0], [0, 0], [1, 0], [1, 1], [0, 1], K.champanhe);
      g.opaco.quad([xm0, y + hc - 0.4, zm0], [xm1, y + hc - 0.4, zm1], [xi1, y + H + 0.2, zi1], [xi0, y + H + 0.2, zi0], [0, -1, 0], [0, 0], [1, 0], [1, 1], [0, 1], K.champanhe);
    }
    // oitão de vidro entre dois vãos (a luz entra pela diferença de altura das escamas)
    const [xa, za] = noArco(cx, cz, r0 - 3, a1);
    const [xb, zb] = noArco(cx, cz, r, a1);
    const [xc, zc] = noArco(cx, cz, r1 + 3, a1);
    const h2 = H + (v % 2 ? 5 : 3.2);
    const hMin = Math.min(hc, h2);
    const nn = [Math.cos((a1 * Math.PI) / 180 + Math.PI / 2), 0, Math.sin((a1 * Math.PI) / 180 + Math.PI / 2)];
    if (v < vaos - 1) {
      const i0 = g.vidro.v(xa, y + H + 0.6, za, ...nn, 0, H, k);
      const i1 = g.vidro.v(xb, y + hMin, zb, ...nn, f / 2, hMin, k);
      const i2 = g.vidro.v(xb, y + Math.max(hc, h2), zb, ...nn, f / 2, Math.max(hc, h2), k);
      const i3 = g.vidro.v(xc, y + H + 0.6, zc, ...nn, f + 6, H, k);
      g.vidro.tri(i0, i1, i2);
      g.vidro.tri(i2, i1, i3);
    }
  }
  g.caixa([...noArco(cx, cz, r, (de + ate) / 2)].reduce((a, v, i) => (i ? [a[0], y, v] : [v]), []), Math.abs(ate - de) * (Math.PI / 180) * r * 0.55 + f, H + 5);
}

/**
 * Anel de moradia em anfiteatro (Marina One, Interlace, Tietgen): módulos ao longo de um arco ou de um caminho, com
 * fendas de vidro entre eles; por fora a cortina de vidro, por dentro (para o coração do plano) terraços verdes a
 * cada 4 andares. As alturas vão de alturas[0] a alturas[1] ao longo da peça.
 */
function anel(g, p) {
  // eixo da peça em pontos com a direção "de dentro" (para onde os terraços olham)
  const eixo = [];
  if (p.arco) {
    const { cx, cz, r, de, ate } = p.arco;
    const n = Math.max(6, Math.ceil(Math.abs(ate - de) / 1.5));
    for (let s = 0; s <= n; s++) {
      const a = de + ((ate - de) * s) / n;
      const [x, z] = noArco(cx, cz, r, a);
      let dx = cx - x;
      let dz = cz - z;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      if (p.degrausParaFora) {
        dx = -dx;
        dz = -dz;
      }
      eixo.push({ x, z, dx, dz });
    }
  } else {
    const C = p.caminho;
    const lado = p.lado === 'direita' ? 1 : -1;
    const pts = [];
    for (let i = 0; i + 2 < C.length; i += 2) {
      const ax = C[i], az = C[i + 1], bx = C[i + 2], bz = C[i + 3];
      const l = Math.hypot(bx - ax, bz - az);
      const q = Math.max(1, Math.ceil(l / 8));
      for (let s = 0; s < q; s++) pts.push([ax + ((bx - ax) * s) / q, az + ((bz - az) * s) / q, (bx - ax) / l, (bz - az) / l]);
    }
    const u = C.length;
    pts.push([C[u - 2], C[u - 1], pts[pts.length - 1][2], pts[pts.length - 1][3]]);
    for (const [x, z, tx, tz] of pts) eixo.push({ x, z, dx: -tz * lado, dz: tx * lado });
  }
  // comprimento acumulado e vãos de 24 a 36 m separados por juntas de vidro de 3 m: de longe o anel é uma faixa
  // contínua (Marina One, Tietgen), de perto cada vão tem a sua altura
  const acum = [0];
  for (let i = 1; i < eixo.length; i++) acum.push(acum[i - 1] + Math.hypot(eixo[i].x - eixo[i - 1].x, eixo[i].z - eixo[i - 1].z));
  const total = acum[acum.length - 1];
  const nMod = Math.max(2, Math.round(total / 31));
  const fenda = 3;
  const pesos = [];
  for (let i = 0; i < nMod; i++) pesos.push(0.8 + 0.4 * hashF(i, Math.round(total), 41));
  const somaP = pesos.reduce((a, b) => a + b, 0);
  const lMods = pesos.map((w) => ((total - fenda * (nMod - 1)) * w) / somaP);
  const inicio = [];
  let acc = 0;
  for (let i = 0; i < nMod; i++) {
    inicio.push(acc);
    acc += lMods[i] + fenda;
  }
  const fundoBase = p.fundo;
  const PE = 3.15;
  const sem = hashF(Math.round(eixo[0].x), Math.round(eixo[0].z));
  const k = vid(VIDRO.moradia, sem);
  const at = (s) => {
    let i = 1;
    while (i < acum.length - 1 && acum[i] < s) i++;
    const t = (s - acum[i - 1]) / Math.max(1e-6, acum[i] - acum[i - 1]);
    const a = eixo[i - 1];
    const b = eixo[i];
    const dx = a.dx + (b.dx - a.dx) * t;
    const dz = a.dz + (b.dz - a.dz) * t;
    const l = Math.hypot(dx, dz) || 1;
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, dx: dx / l, dz: dz / l };
  };
  // portais: vãos abertos de ~40 m (p.portais, frações do comprimento) por onde o parque atravessa o anel
  const portais = (p.portais ?? []).map((f) => f * total);
  const topos = [];
  for (let mIdx = 0; mIdx < nMod; mIdx++) {
    const s0 = inicio[mIdx];
    const s1 = s0 + lMods[mIdx];
    if (portais.some((c) => Math.abs((s0 + s1) / 2 - c) < 20)) continue;
    const t = nMod > 1 ? mIdx / (nMod - 1) : 0;
    // o perfil sobe de alturas[0] a alturas[1] numa curva macia (a plateia do anfiteatro) com uma onda larga por cima
    // (uma serra, não uma escada): vãos vizinhos diferem de 0 a 2 andares
    const suave = t * t * (3 - 2 * t);
    const alvo = (p.alturas[0] + (p.alturas[1] - p.alturas[0]) * suave) * (1 + 0.1 * Math.sin(t * Math.PI * 3 + sem * 6.28));
    const pav = Math.max(6, Math.round(alvo / PE));
    const H = pav * PE;
    const fundo = fundoBase;
    topos.push({ s0, s1, H });
    const meio = at((s0 + s1) / 2);
    const y = g.chao(meio.x, meio.z);
    // degraus: a cada 4 andares o lado de dentro recua 3,5 m (terraço verde), até sobrar 10 m de fundo
    const degraus = [];
    let d = fundo;
    for (let yy = 0; yy < H - 1e-6; yy += 4 * PE) {
      degraus.push({ y0: yy, y1: Math.min(H, yy + 4 * PE), d });
      d = Math.max(10, d - 3.5);
    }
    const q = Math.max(2, Math.ceil((s1 - s0) / 6));
    const seg = [];
    for (let s = 0; s <= q; s++) seg.push(at(s0 + ((s1 - s0) * s) / q));
    // cada degrau é um prisma curvo: de fora (-fundo/2 do eixo, para longe de dentro) até fora + d
    degraus.forEach((dg, i) => {
      const fora = (e) => [e.x - (e.dx * fundo) / 2, e.z - (e.dz * fundo) / 2];
      const dentro = (e) => [e.x - (e.dx * fundo) / 2 + e.dx * dg.d, e.z - (e.dz * fundo) / 2 + e.dz * dg.d];
      const poly = [];
      for (const e of seg) poly.push(...fora(e));
      for (let s = seg.length - 1; s >= 0; s--) poly.push(...dentro(seg[s]));
      paredes(g.vidro, poly, y + dg.y0, y + dg.y1, k, y);
      const ult = i === degraus.length - 1;
      tampa(g.opaco, poly, y + dg.y1, ult ? K.telhadoVerde : K.jardim, true);
      // árvores no terraço (o vale verde por dentro)
      if (!ult && g.arvores) {
        const larg = degraus[i].d - degraus[i + 1].d;
        if (larg > 2) {
          for (let a = 1; a < seg.length - 1; a += 2) {
            const e = seg[a];
            const [px, pz] = dentro(e);
            const tx = px - e.dx * larg * 0.5;
            const tz = pz - e.dz * larg * 0.5;
            if (hashF(a, i, mIdx * 13 + sem * 50) < 0.55) arvore(g.arvores, tx, y + dg.y1, tz, { altura: 5 + 2 * hashF(a, i), raio: 1.8, semente: a + i * 31 + mIdx * 7, detalhe: 0 });
          }
        }
      }
    });
    prisma(g.opaco, (() => {
      const P = [];
      for (const e of seg) P.push(e.x - (e.dx * (fundo / 2 + 2)), e.z - (e.dz * (fundo / 2 + 2)));
      for (let s = seg.length - 1; s >= 0; s--) P.push(seg[s].x + (seg[s].dx * (fundo / 2 + 2)), seg[s].z + (seg[s].dz * (fundo / 2 + 2)));
      return P;
    })(), y - 2.5, y + 0.4, { paredes: K.granito, topo: K.piso });
    g.caixa([meio.x, y, meio.z], (s1 - s0) / 2 + fundo / 2, H);
  }
  for (let i = 1; i + 1 < topos.length; i += 4) {
    if (topos[i + 1].s0 - topos[i].s1 > fenda + 1) continue; // um portal no meio
    const a = at(topos[i].s1 - 2);
    const b = at(topos[i + 1].s0 + 2);
    const h = Math.min(topos[i].H, topos[i + 1].H) * 0.7;
    const y = g.chao(a.x, a.z);
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    const ux = (b.x - a.x) / (l || 1);
    const uz = (b.z - a.z) / (l || 1);
    caixa(g.vidro, mx - a.dx * (fundoBase / 2 - 6), mz - a.dz * (fundoBase / 2 - 6), l / 2 + 1, 4, y + h, y + h + 2 * PE, k, { ux, uz, base: true });
  }
}

/**
 * Biblioteca em diamante (Biblioteca Nacional do Catar, Tianjin): quadrado de 76 m com uma quina apontada para quem
 * chega; a placa do teto se dobra na diagonal, levantando as quinas da frente e do fundo a 55 m; a esfera de 36 m
 * atravessa a dobra (o olho); o pináculo sobe da quina do fundo a 75 m.
 */
function biblioteca(g, p) {
  const rot = p.olhar ? rotParaOlhar(p.x, p.z, p.olhar[0], p.olhar[1]) : p.rot ?? 0;
  const y = g.chao(p.x, p.z);
  const L = 76 / Math.SQRT2; // meia diagonal
  const alto = 55;
  const baixo = 18;
  const sem = hashF(Math.round(p.x), Math.round(p.z), 3);
  const k = vid(VIDRO.biblioteca, sem);
  // quinas em volta: A frente (+z local), B direita, C fundo, D esquerda
  const loc = [[0, L], [L, 0], [0, -L], [-L, 0]];
  const Q = aoMundo(loc.flat(), p.x, p.z, rot);
  const H = [alto, baixo, alto, baixo];
  const pt = (i) => [Q[2 * i], Q[2 * i + 1]];
  prisma(g.opaco, aoMundo([0, L + 8, L + 8, 0, 0, -L - 8, -L - 8, 0], p.x, p.z, rot), y - 2, y + 0.6, { paredes: K.granito, topo: K.piso });
  for (let i = 0; i < 4; i++) {
    const [ax, az] = pt(i);
    const [bx, bz] = pt((i + 1) % 4);
    const l = Math.hypot(bx - ax, bz - az);
    const nn = [(bz - az) / l, 0, -(bx - ax) / l];
    // parede com o topo inclinado (de H[i] a H[i+1]); a quina alta da frente fica aberta em vidro (entrada)
    const i0 = g.vidro.v(ax, y + 0.6, az, ...nn, 0, 0.6, k);
    const i1 = g.vidro.v(bx, y + 0.6, bz, ...nn, l, 0.6, k);
    const i2 = g.vidro.v(bx, y + H[(i + 1) % 4], bz, ...nn, l, H[(i + 1) % 4], k);
    const i3 = g.vidro.v(ax, y + H[i], az, ...nn, 0, H[i], k);
    g.vidro.tri(i0, i1, i2);
    g.vidro.tri(i0, i2, i3);
  }
  // placa dobrada: duas águas da diagonal B-D (baixa) às quinas A e C (altas), com 1,5 m de espessura
  const P = (i, dy = 0) => [Q[2 * i], y + H[i] + dy, Q[2 * i + 1]];
  const faceTri = (a, b, c, dy, kk) => {
    const A = P(a, dy), B = P(b, dy), C = P(c, dy);
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
    const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (ny < 0) [nx, ny, nz] = [-nx, -ny, -nz];
    const l = Math.hypot(nx, ny, nz) || 1;
    const i0 = g.opaco.v(A[0], A[1], A[2], nx / l, ny / l, nz / l, A[0], A[2], kk);
    const i1 = g.opaco.v(B[0], B[1], B[2], nx / l, ny / l, nz / l, B[0], B[2], kk);
    const i2 = g.opaco.v(C[0], C[1], C[2], nx / l, ny / l, nz / l, C[0], C[2], kk);
    g.opaco.tri(i0, i1, i2);
  };
  faceTri(0, 1, 3, 1.5, K.pedra);
  faceTri(2, 3, 1, 1.5, K.pedra);
  for (let i = 0; i < 4; i++) {
    const a = P(i, 0), b = P((i + 1) % 4, 0);
    const a2 = P(i, 1.5), b2 = P((i + 1) % 4, 1.5);
    const l = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const nn = [(b[2] - a[2]) / l, 0, -(b[0] - a[0]) / l];
    g.opaco.quad(a, b, b2, a2, nn, [0, 0], [l, 0], [l, 1.5], [0, 1.5], K.champanhe);
  }
  // esfera de 36 m (o olho) atravessando a dobra, acesa à noite
  const perfil = [];
  for (let j = 0; j <= 10; j++) {
    const t = -Math.PI / 2 + (j / 10) * Math.PI;
    perfil.push([18 * Math.cos(t), y + 20 + 18 * Math.sin(t)]);
  }
  torno(g.vidro, p.x, p.z, perfil, 18, vid(VIDRO.lanterna, sem));
  // pináculo da quina do fundo até 75 m
  const [cx, cz] = pt(2);
  barra(g.opaco, [cx, y + alto + 1.5, cz], [cx, y + 75, cz], 0.9, 6, K.champanhe);
  g.caixa([p.x, y, p.z], 54, 75);
}

/** Vida: casca de vidro em gota (Jewel Changi) com óculo e o vórtice de água, e as Supertrees em volta. */
function vida(g, p) {
  const y = g.chao(p.x, p.z);
  const R = p.diametro / 2;
  const H = p.altura;
  const sem = hashF(Math.round(p.x), Math.round(p.z), 5);
  const perfil = [[R * 0.98, 0], [R, 5], [R * 0.99, 14], [R * 0.92, 27], [R * 0.78, 41], [R * 0.58, 54], [R * 0.34, 64], [R * 0.14, 69.2], [6, H]].map(([r, h]) => [r, y + (h * H) / 70]);
  torno(g.vidro, p.x, p.z, perfil, 32, vid(VIDRO.cupula, sem), { ex: 1, ez: 0.84, rot: p.rot ?? 0 });
  prisma(g.opaco, aoMundo(elipse(R + 6, (R + 6) * 0.84, 32), p.x, p.z, p.rot ?? 0), y - 2, y + 0.8, { paredes: K.granito, topo: K.piso });
  // anel do óculo e o vórtice (a cascata de 40 m que cai pelo óculo)
  cilindro(g.opaco, p.x, p.z, y + H - 0.8, y + H + 0.6, 6.4, 6.4, 16, K.champanhe, { topo: false });
  cilindro(g.opaco, p.x, p.z, y + H - 40, y + H + 0.2, 3.2, 4.4, 10, K.vortice, { topo: true });
  g.caixa([p.x, y, p.z], R, H);
}

/** Supertree de Gardens by the Bay: tronco de jardim vertical e a copa de aço em funil, acesa à noite. */
function supertree(g, p) {
  const y = g.chao(p.x, p.z);
  const h = p.altura;
  const alvo = g.arvores ?? g.opaco;
  cilindro(alvo, p.x, p.z, y, y + h * 0.72, 2.4, 1.1, 8, K.tronco, { topo: false });
  // funil: do tronco a um raio de 0,28 h no topo, com aro
  const perfil = [[1.1, y + h * 0.72], [h * 0.12, y + h * 0.86], [h * 0.26, y + h * 0.97], [h * 0.28, y + h]];
  torno(alvo, p.x, p.z, perfil, 12, K.copaSuper);
  torno(alvo, p.x, p.z, [[h * 0.27, y + h - 0.2], [h * 0.27, y + h + 0.4]], 12, K.copaSuper);
  g.caixa([p.x, y, p.z], h * 0.28, h);
}

/** Escola (CEU): prédio baixo em anel oval em volta do campo, com a cobertura em anel que avança 3 m. */
function escola(g, p) {
  const rot = p.rot ?? 0;
  const y = g.chao(p.x, p.z);
  const sem = hashF(Math.round(p.x), Math.round(p.z), 7);
  const k = vid(VIDRO.laboratorio, sem);
  const fora = aoMundo(elipse(58, 42, 36), p.x, p.z, rot);
  const dentro = aoMundo(elipse(36, 22, 36), p.x, p.z, rot);
  const H = 13.5;
  prisma(g.opaco, aoMundo(elipse(62, 46, 36), p.x, p.z, rot), y - 2, y + 0.4, { paredes: K.granito, topo: K.piso });
  paredes(g.vidro, fora, y + 0.4, y + H, k, y);
  paredes(g.vidro, dentro, y + 0.4, y + H, k, y, false);
  // cobertura em anel com beiral de 3 m para fora e para dentro
  const cf = aoMundo(elipse(61, 45, 36), p.x, p.z, rot);
  const cd = aoMundo(elipse(33, 19, 36), p.x, p.z, rot);
  faixaEntre(g.opaco, cf, cd, y + H + 0.9, K.concretoClaro, true);
  faixaEntre(g.opaco, cf, cd, y + H, K.concretoClaro, false);
  paredes(g.opaco, cf, y + H, y + H + 0.9, K.concretoClaro, y);
  paredes(g.opaco, cd, y + H, y + H + 0.9, K.concretoClaro, y, false);
  // campo, pista e as linhas
  tampa(g.opaco, aoMundo(elipse(33, 19, 36), p.x, p.z, rot), y + 0.45, K.pista, true);
  tampa(g.opaco, aoMundo(elipse(28, 14, 36), p.x, p.z, rot), y + 0.5, K.gramado, true);
  g.caixa([p.x, y, p.z], 60, H + 1);
}

/**
 * Universidade: laje ondulada de 150 x 90 m (Rolex Learning Center) com pátios redondos no teto verde, e duas torres
 * de laboratório com aletas de alumínio numa ponta.
 */
function universidade(g, p) {
  const rot = p.rot ?? 0;
  const y = g.chao(p.x, p.z);
  const sem = hashF(Math.round(p.x), Math.round(p.z), 11);
  const W = 150;
  const D = 90;
  const alt = (lx, lz) => 9 + 3.2 * Math.sin(lx / 22 + 0.8) * Math.cos(lz / 26) + 2 * Math.sin((lx + lz) / 31);
  const contorno = retArredondado(W, D, 14, 5);
  const Pm = aoMundo(contorno, p.x, p.z, rot);
  prisma(g.opaco, aoMundo(retArredondado(W + 10, D + 10, 18, 5), p.x, p.z, rot), y - 2, y + 0.4, { paredes: K.granito, topo: K.piso });
  // paredes de vidro com o topo seguindo a onda
  const n = Pm.length / 2;
  const kv = vid(VIDRO.escritorio, sem);
  let u = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [lax, laz] = [contorno[2 * i], contorno[2 * i + 1]];
    const [lbx, lbz] = [contorno[2 * j], contorno[2 * j + 1]];
    const [ax, az, bx, bz] = [Pm[2 * i], Pm[2 * i + 1], Pm[2 * j], Pm[2 * j + 1]];
    const l = Math.hypot(bx - ax, bz - az);
    const nn = [(bz - az) / l, 0, -(bx - ax) / l];
    const ha = alt(lax, laz);
    const hb = alt(lbx, lbz);
    g.vidro.quad([ax, y + 0.4, az], [bx, y + 0.4, bz], [bx, y + hb, bz], [ax, y + ha, az], nn, [u, 0.4], [u + l, 0.4], [u + l, hb], [u, ha], kv);
    u += l;
  }
  // teto: grade que segue a onda, recortada pelo contorno arredondado (os cantos ficam no raio)
  const nx = 15;
  const nz = 9;
  const base = g.opaco.vertices;
  const idx = [];
  const dentro = (lx, lz) => {
    const qx = Math.max(0, Math.abs(lx) - (W / 2 - 14));
    const qz = Math.max(0, Math.abs(lz) - (D / 2 - 14));
    return Math.hypot(qx, qz) <= 14.01;
  };
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      let lx = -W / 2 + (W * i) / nx;
      let lz = -D / 2 + (D * j) / nz;
      if (!dentro(lx, lz)) {
        // puxa o ponto para o contorno arredondado
        const cx0 = Math.sign(lx) * (W / 2 - 14);
        const cz0 = Math.sign(lz) * (D / 2 - 14);
        const a = Math.atan2(lz - cz0, lx - cx0);
        lx = cx0 + Math.cos(a) * 14;
        lz = cz0 + Math.sin(a) * 14;
      }
      const h = alt(lx, lz);
      const e = 1.5;
      const gx = (alt(lx + e, lz) - alt(lx - e, lz)) / (2 * e);
      const gz = (alt(lx, lz + e) - alt(lx, lz - e)) / (2 * e);
      const nl = Math.hypot(gx, 1, gz);
      const wx = p.x + cr * lx + sr * lz;
      const wz = p.z - sr * lx + cr * lz;
      const nwx = cr * (-gx / nl) + sr * (-gz / nl);
      const nwz = -sr * (-gx / nl) + cr * (-gz / nl);
      g.opaco.v(wx, y + h, wz, nwx, 1 / nl, nwz, wx, wz, K.telhadoVerde);
    }
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = base + j * (nx + 1) + i;
    idx.push([a, a + 1, a + nx + 2], [a, a + nx + 2, a + nx + 1]);
  }
  for (const [a, b, c] of idx) g.opaco.tri(a, b, c);
  // pátios redondos (claraboias de vidro no teto verde)
  for (const [lx, lz, r] of [[-30, -10, 11], [18, 16, 9], [45, -18, 8]]) {
    const wx = p.x + cr * lx + sr * lz;
    const wz = p.z - sr * lx + cr * lz;
    cilindro(g.vidro, wx, wz, y + alt(lx, lz) - 0.5, y + alt(lx, lz) + 0.6, r, r, 14, vid(VIDRO.cupula, sem), { topo: true });
  }
  // torres de laboratório na ponta leste
  for (const [lx, lz, h] of [[W / 2 + 26, -22, 60], [W / 2 + 30, 22, 48]]) {
    const wx = p.x + cr * lx + sr * lz;
    const wz = p.z - sr * lx + cr * lz;
    const poly = aoMundo(retArredondado(34, 22, 3, 2), wx, wz, rot);
    prisma(g.opaco, aoMundo(retArredondado(38, 26, 4, 2), wx, wz, rot), y - 2, y + 0.4, { paredes: K.granito, topo: K.piso });
    paredes(g.vidro, poly, y + 0.4, y + h, vid(VIDRO.laboratorio, sem + lx), y);
    tampa(g.opaco, poly, y + h, K.cobertura, true);
    prisma(g.opaco, aoMundo(retArredondado(20, 12, 2, 2), wx, wz, rot), y + h, y + h + 4.5, { paredes: K.metalClaro, topo: K.cobertura });
    g.caixa([wx, y, wz], 20, h + 5);
  }
  g.caixa([p.x, y, p.z], W / 2, 16);
}

/** Centro de Física: dois tubos de aço de 14 m sobre pilares em V ao longo de um arco (CERN) e ondas de terra (MAX IV). */
function fisica(g, p) {
  const { cx, cz, r, de, ate } = p.arco;
  const rt = p.raioTubo;
  const n = Math.max(8, Math.ceil(Math.abs(ate - de) / 1));
  const y0 = g.chao(...noArco(cx, cz, r, (de + ate) / 2));
  for (const dr of [-11, 11]) {
    const rr = r + dr;
    const yc = y0 + p.altura + rt;
    const seg = 14;
    for (let s = 0; s < n; s++) {
      const a0 = de + ((ate - de) * s) / n;
      const a1 = de + ((ate - de) * (s + 1)) / n;
      for (let q = 0; q < seg; q++) {
        const t0 = (q / seg) * Math.PI * 2;
        const t1 = ((q + 1) / seg) * Math.PI * 2;
        const P = (a, t) => {
          const [x, z] = noArco(cx, cz, rr + Math.cos(t) * rt, a);
          return [x, yc + Math.sin(t) * rt, z];
        };
        const tm = (t0 + t1) / 2;
        const am = ((a0 + a1) / 2) * (Math.PI / 180);
        const nn = [Math.cos(am) * Math.cos(tm), Math.sin(tm), Math.sin(am) * Math.cos(tm)];
        g.opaco.quad(P(a0, t0), P(a1, t0), P(a1, t1), P(a0, t1), nn, [a0, t0], [a1, t0], [a1, t1], [a0, t1], K.metalClaro);
      }
    }
    // tampas das pontas (vidro) e pilares em V a cada ~24 m
    for (const a of [de, ate]) {
      const [x, z] = noArco(cx, cz, rr, a);
      const poly = [];
      const tang = ((a + 90) * Math.PI) / 180;
      for (let q = 0; q < 14; q++) {
        const t = (q / 14) * Math.PI * 2;
        poly.push([x + Math.cos((a * Math.PI) / 180) * Math.cos(t) * rt, yc + Math.sin(t) * rt, z + Math.sin((a * Math.PI) / 180) * Math.cos(t) * rt]);
      }
      const nn = [Math.cos(tang) * (a === de ? -1 : 1), 0, Math.sin(tang) * (a === de ? -1 : 1)];
      const b = g.vidro.vertices;
      for (const q of poly) g.vidro.v(q[0], q[1], q[2], ...nn, q[0], q[1] - y0, vid(VIDRO.laboratorio, 0.3));
      for (let q = 1; q + 1 < poly.length; q++) g.vidro.tri(b, b + q, b + q + 1);
    }
    const comp = (Math.abs(ate - de) * Math.PI * rr) / 180;
    const nv = Math.max(2, Math.round(comp / 24));
    for (let v = 0; v <= nv; v++) {
      const a = de + ((ate - de) * v) / nv;
      const [x, z] = noArco(cx, cz, rr, a);
      const [xa, za] = noArco(cx, cz, rr - 3, a);
      const [xb, zb] = noArco(cx, cz, rr + 3, a);
      const yb = y0 + p.altura + 0.5;
      barra(g.opaco, [x, y0, z], [xa, yb, za], 0.5, 6, K.metalClaro);
      barra(g.opaco, [x, y0, z], [xb, yb, zb], 0.5, 6, K.metalClaro);
    }
  }
  // ondas de terra do lado de dentro do arco (grama), comprimento de onda de 36 m (MAX IV)
  const nOnda = Math.max(8, Math.ceil(Math.abs(ate - de) / 1.5));
  const larg = 70;
  const nl = 7;
  const lado = p.ondas === 'fora' ? 1 : -1;
  const base = g.opaco.vertices;
  for (let s = 0; s <= nOnda; s++) {
    const a = de + ((ate - de) * s) / nOnda;
    const comp = (Math.abs(a - de) * Math.PI * r) / 180;
    for (let j = 0; j <= nl; j++) {
      const rr = r + lado * (24 + (larg * j) / nl);
      const [x, z] = noArco(cx, cz, rr, a);
      const env = Math.sin((Math.PI * j) / nl);
      const h = env * 4.5 * (0.5 + 0.5 * Math.sin(comp / 5.7 + j * 0.9));
      g.opaco.v(x, g.chao(x, z) + 0.2 + h, z, 0, 1, 0, x, z, K.grama);
    }
  }
  for (let s = 0; s < nOnda; s++) for (let j = 0; j < nl; j++) {
    const a = base + s * (nl + 1) + j;
    g.opaco.tri(a, a + 1, a + nl + 2);
    g.opaco.tri(a, a + nl + 2, a + nl + 1);
  }
  const [mx, mz] = noArco(cx, cz, r, (de + ate) / 2);
  g.caixa([mx, y0, mz], (Math.abs(ate - de) * Math.PI * r) / 360 + 20, p.altura + 2 * rt);
}

/** Pódio de quarteirão (Hudson Yards): lojas em vidro alto com faixas de pedra e a praça no teto. */
function podio(g, p) {
  const P = orientar(p.contorno);
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < P.length; i += 2) {
    cx += P[i];
    cz += P[i + 1];
  }
  cx /= P.length / 2;
  cz /= P.length / 2;
  const y = g.chao(cx, cz);
  prisma(g.opaco, deslocar(P, 2), y - 2, y + 0.5, { paredes: K.granito, topo: K.piso });
  paredes(g.vidro, P, y + 0.5, y + p.altura, vid(VIDRO.podio, 0.4), y);
  prisma(g.opaco, deslocar(P, 0.6), y + p.altura, y + p.altura + 1.2, { paredes: K.pedra, topo: K.piso });
  g.caixa([cx, y, cz], 90, p.altura);
}

/** Marina Barrage: barragem baixa com o teto verde caminhável e a fila de comportas do lado do mar. */
function barragem(g, p, nivelAgua) {
  const [ax, az] = p.de;
  const [bx, bz] = p.ate;
  const L = Math.hypot(bx - ax, bz - az);
  const ux = (bx - ax) / L;
  const uz = (bz - az) / L;
  const px = -uz;
  const pz = ux;
  const w = p.largura / 2;
  const y = g.chao((ax + bx) / 2, (az + bz) / 2);
  const cx = (ax + bx) / 2;
  const cz = (az + bz) / 2;
  caixa(g.opaco, cx, cz, L / 2, w, nivelAgua - 3, y + 2.2, K.concretoClaro, { ux, uz, topo: false });
  // teto verde em rampa suave (sobe para o lado do reservatório)
  const c = (sa, sb, h) => [cx + ux * (L / 2) * sa + px * w * sb, y + h, cz + uz * (L / 2) * sa + pz * w * sb];
  g.opaco.quad(c(-1, -1, 2.2), c(1, -1, 2.2), c(1, 1, 5.2), c(-1, 1, 5.2), [0, 1, 0], [0, 0], [L, 0], [L, 1], [0, 1], K.telhadoVerde);
  g.opaco.quad(c(-1, 1, 2.2), c(1, 1, 2.2), c(1, 1, 5.2), c(-1, 1, 5.2), [px, 0, pz], [0, 0], [L, 0], [L, 3], [0, 3], K.concretoClaro);
  // comportas: pilares a cada 12 m e as placas de aço entre eles
  const nP = Math.max(2, Math.floor(L / 12));
  for (let i = 0; i <= nP; i++) {
    const t = -1 + (2 * i) / nP;
    const [x, , z] = c(t * 0.96, -1, 0);
    caixa(g.opaco, x - px * 2, z - pz * 2, 1.2, 2.5, nivelAgua - 2, y + 7.5, K.concretoClaro, { ux, uz });
    if (i < nP) {
      const [x2, , z2] = c((-1 + (2 * (i + 0.5)) / nP) * 0.96, -1, 0);
      caixa(g.opaco, x2 - px * 2.5, z2 - pz * 2.5, (L / nP) * 0.42, 0.4, nivelAgua - 1.5, y + 1.2, K.comporta, { ux, uz });
    }
  }
  g.caixa([cx, y, cz], L / 2, 8);
}

/** Tipos de peça que viram volumes aqui (o reservatório é do lago.js; a Torre, do torre.js). */
export const PECAS = Object.freeze({ conselho, sede, anel, biblioteca, vida, supertree, escola, universidade, fisica, podio, barragem });

/**
 * Monta as peças de uma parte nas malhas do destino.
 * @param {{ id: string, pecas: object[] }} parte
 * @param {{ chao: (x: number, z: number) => number, vidro: Malha, opaco: Malha, arvores?: Malha, nivelAgua?: number }} destino
 * @returns {{ caixas: number[][] }}  caixas [x0, y0, z0, x1, y1, z1] por peça (a seleção e a câmera usam)
 */
export function montarParte(parte, destino) {
  const caixas = [];
  const g = {
    ...destino,
    caixa: (c, meia, h) => caixas.push([c[0] - meia, c[1], c[2] - meia, c[0] + meia, c[1] + h, c[2] + meia]),
  };
  for (const p of parte.pecas) {
    const fn = PECAS[p.tipo];
    if (fn === barragem) fn(g, p, destino.nivelAgua ?? g.chao(...p.de) - 2);
    else if (fn) fn(g, p);
  }
  return { caixas };
}

/** Malhas novas para montar partes (atalho dos testes e do fantasma). */
export function malhasNovas() {
  return { vidro: new Malha('vidro'), opaco: new Malha('opaco'), arvores: new Malha('opaco') };
}

export { parede };
