// Partes da Arcologia (D26, D59, D63 a D65): a Sede em anel e as Torres do Conselho, o Anel de moradia, a Biblioteca,
// a Vida (a cúpula de vidro e as Supertrees), a Escola, a Universidade, a Física, as fontes, o pódio de quarteirão e a
// barragem. Cada peça do plano (data/arcologia-plano.js) vira volumes com a fachada no shader (material vidro, tipo por
// vértice) e acabamentos (material opaco), em coordenadas do mundo, assentados no relevo por chao(x, z). A Sede em anel
// e a cúpula têm LOD0 (marquises e barras da malha em geometria) e LOD1 (no shader): g.lod escolhe; as outras peças são
// iguais nos dois. O LOD1 serve também ao fantasma do jogo (fantasma.js) e ao volume de sombra (g.sombra).
//
// Referências: Torres do Conselho (Tencent Seafront, Bloomberg London), Sede (Apple Park, Google Bay View), Anel
// (Marina One, The Interlace, Tietgen), Biblioteca (Biblioteca Nacional do Catar, Tianjin Binhai), Vida (Jewel
// Changi, Gardens by the Bay), Escola (CEU), Universidade (Rolex Learning Center), Física (CERN Science Gateway,
// MAX IV), pódio (Hudson Yards), barragem (Marina Barrage).
import {
  Malha, acab, vid, VIDRO, PADRAO, LUZ, prisma, tampa, caixa, cilindro, torno, arvore, hashF, orientar, barra, anelPlano,
  cascaEfeito, CASCATA,
} from './torre.js';
import { rotParaOlhar } from '../../data/arcologia-plano.js';

// acabamentos das partes
const K = {
  pedra: acab('#c3b79f', { rugo: 0.72, padrao: PADRAO.pedra }),
  concreto: acab('#a9a397', { rugo: 0.8 }),
  concretoClaro: acab('#c8c2b6', { rugo: 0.75 }),
  champanhe: acab('#b8a684', { rugo: 0.32, metal: 1, padrao: PADRAO.metal }),
  // aço inox acetinado dos tubos da Física: com 0,35 o tubo espelhava o céu e lia como cano de plástico azul e branco
  metalClaro: acab('#b9b8b3', { rugo: 0.55, metal: 1, padrao: PADRAO.metal }),
  metalEscuro: acab('#3a3c40', { rugo: 0.5, metal: 0.6 }),
  // painel solar de vidro escuro sobre a moldura clara: reflete o céu, de cima lê cinza-azulado (a cobertura da Apple
  // Park), nunca a rosca preta
  solar: acab('#3b4450', { rugo: 0.3, metal: 0.5, padrao: PADRAO.solar }),
  telhadoVerde: acab('#435031', { rugo: 0.95, padrao: PADRAO.grama }),
  jardim: acab('#3d4a2c', { rugo: 0.9, padrao: PADRAO.folha }),
  grama: acab('#4f5c36', { rugo: 0.95, padrao: PADRAO.grama }),
  gramado: acab('#3f5a33', { rugo: 0.9, padrao: PADRAO.grama }),
  pista: acab('#7a5b4c', { rugo: 0.9 }),
  piso: acab('#b1a797', { rugo: 0.8, padrao: PADRAO.piso }),
  granito: acab('#6a655f', { rugo: 0.6, padrao: PADRAO.pedra }),
  arenito: acab('#b39a78', { rugo: 0.85, padrao: PADRAO.pedra }),
  cobertura: acab('#8e8a84', { rugo: 0.7 }),
  // Supertrees: o tronco é jardim vertical (bromélias, samambaias), a copa é a treliça de aço cor de ferrugem
  tronco: acab('#4a5a30', { rugo: 0.9, padrao: PADRAO.folha }),
  copaSuper: acab('#7a5c44', { rugo: 0.6, metal: 0.35, luz: LUZ.arvoreLuz, padrao: PADRAO.metal }),
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
    // alturas alternadas por pouco: a fresta de vidro entre as escamas é fina (de cima, sem listras de céu refletido)
    const hc = H + (v % 2 ? 3.8 : 4.6);
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
    const h2 = H + (v % 2 ? 4.6 : 3.8);
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
    // contínuo (a moradia da sede v2): a cobertura corre sem a onda e as juntas sobem até ela; lê como um prédio só
    const onda = p.continuo ? 0 : 0.1 * Math.sin(t * Math.PI * 3 + sem * 6.28);
    const alvo = (p.alturas[0] + (p.alturas[1] - p.alturas[0]) * suave) * (1 + onda);
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
  // juntas de vidro entre os vãos: 3 m, recuadas 1,2 m da face de fora e da de dentro, um andar abaixo do vão mais
  // baixo. Sem elas as juntas eram vãos abertos e, do alto, o anel lia como uma fila de lâminas soltas (formas
  // robóticas); com elas lê como a faixa contínua de Marina One e Tietgen. Os portais continuam abertos
  const f0 = -fundoBase / 2 + 1.2;
  const f1 = -fundoBase / 2 + 10 - 1.2;
  for (let i = 0; i + 1 < topos.length; i++) {
    const a = topos[i];
    const b = topos[i + 1];
    if (b.s0 - a.s1 > fenda + 1) continue; // portal
    const hJ = Math.min(a.H, b.H) - (p.continuo ? 0 : PE);
    if (hJ < 2 * PE) continue;
    const q = [at(a.s1 - 0.3), at((a.s1 + b.s0) / 2), at(b.s0 + 0.3)];
    const poly = [];
    for (const e of q) poly.push(e.x + e.dx * f0, e.z + e.dz * f0);
    for (let s = q.length - 1; s >= 0; s--) poly.push(q[s].x + q[s].dx * f1, q[s].z + q[s].dz * f1);
    const y = g.chao(q[1].x, q[1].z);
    paredes(g.vidro, poly, y, y + hJ, k, y);
    tampa(g.opaco, poly, y + hJ, K.telhadoVerde, true);
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
  const e = (p.lado ?? 76) / 76; // escala (o plano A v2 pede 64 m, no eixo leste entre o anel viário e a borda)
  const L = (76 * e) / Math.SQRT2; // meia diagonal
  const alto = 55 * e;
  const baixo = 18 * e;
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
    perfil.push([18 * e * Math.cos(t), y + 20 * e + 18 * e * Math.sin(t)]);
  }
  torno(g.vidro, p.x, p.z, perfil, 18, vid(VIDRO.lanterna, sem));
  // pináculo da quina do fundo até 75 m
  const [cx, cz] = pt(2);
  barra(g.opaco, [cx, y + alto + 1.5, cz], [cx, y + 75 * e, cz], 0.9, 6, K.champanhe);
  g.caixa([p.x, y, p.z], L + 8, 75 * e);
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

/**
 * Supertree de Gardens by the Bay: o tronco de jardim vertical nasce largo, afina e se abre num hiperboloide até a
 * copa de aço (nunca a haste fina com um prato em cima, que lia como taça ou guarda-chuva), acesa à noite.
 */
function supertree(g, p) {
  const y = g.chao(p.x, p.z);
  const h = p.altura;
  const alvo = g.arvores ?? g.opaco;
  const rb = Math.max(2.6, h * 0.075); // raio da base
  const rm = rb * 0.55; // cintura
  const tronco = [[rb, 0], [rb * 0.8, 0.12], [rm, 0.38], [rm * 1.05, 0.52], [rm * 1.5, 0.64]].map(([r, t]) => [r, y + h * t]);
  torno(alvo, p.x, p.z, tronco, 10, K.tronco);
  // copa: a treliça abre em curva do fim do tronco até 0,3 h de raio, com o aro no topo
  const copa = [[rm * 1.5, 0.64], [h * 0.09, 0.74], [h * 0.17, 0.84], [h * 0.25, 0.93], [h * 0.3, 1.0]].map(([r, t]) => [r, y + h * t]);
  torno(alvo, p.x, p.z, copa, 14, K.copaSuper);
  // o aro do topo e a treliça aberta por cima: um anel, o cubo no meio e os raios (de cima lê a estrutura de aço
  // com o chão aparecendo entre as barras, não o prato chapado de um cogumelo)
  const R = h * 0.3;
  torno(alvo, p.x, p.z, [[R, y + h - 0.2], [R, y + h + 0.5]], 14, K.copaSuper);
  anelPlano(alvo, p.x, y + h + 0.5, p.z, R * 0.82, R, 14, K.copaSuper);
  cilindro(alvo, p.x, p.z, y + h * 0.9, y + h + 0.5, R * 0.18, R * 0.22, 8, K.copaSuper, { topo: true });
  for (let s = 0; s < 8; s++) {
    const a = (s / 8) * Math.PI * 2 + 0.2;
    barra(alvo, [p.x + Math.cos(a) * R * 0.2, y + h + 0.3, p.z + Math.sin(a) * R * 0.2], [p.x + Math.cos(a) * R * 0.84, y + h + 0.3, p.z + Math.sin(a) * R * 0.84], 0.22, 3, K.copaSuper);
  }
  // a face de dentro do funil (a treliça vista de cima, entre os raios)
  torno(alvo, p.x, p.z, [[R * 0.98, y + h + 0.1], [rm * 1.4, y + h * 0.66]], 14, K.copaSuper);
  g.caixa([p.x, y, p.z], h * 0.3, h);
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
  // trechos de ~6 m de arco (o anel fechado de 44 m não pede os 360 trechos de um grau)
  const comprimento = (Math.abs(ate - de) * Math.PI * (r + 11)) / 180;
  const n = Math.max(12, Math.min(120, Math.ceil(comprimento / 6)));
  const y0 = g.chao(...noArco(cx, cz, r, (de + ate) / 2));
  for (const dr of [-11, 11]) {
    const rr = r + dr;
    const yc = y0 + p.altura + rt;
    const seg = 12;
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
  const nOnda = Math.max(8, Math.min(120, Math.ceil(comprimento / 4)));
  const larg = p.ondasLargura ?? 70; // no anel fechado (o síncrotron do plano A) as ondas cabem no miolo
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


// ------------------------------------------------------------------------------------------------ sede v2 (D63 a D65)

const KS = {
  // marquise branca de cada laje (a assinatura da Apple Park): alumínio pintado, fosco, e o forro aceso à noite
  marquise: acab('#e4e2dc', { rugo: 0.55 }),
  // o forro da marquise recebe a luz dos escritórios à noite: brilho baixo (a luz é do vidro, não da marquise)
  marquiseForro: acab('#dcd8cf', { rugo: 0.6, luz: LUZ.reflexo }),
  // estrutura da cúpula: aço pintado de branco quente
  estrutura: acab('#dcd6c8', { rugo: 0.45, metal: 0.5, padrao: PADRAO.metal }),
  pedraClara: acab('#cfc6b3', { rugo: 0.7, padrao: PADRAO.pedra }),
  muroVerde: acab('#3a4a2c', { rugo: 0.9, padrao: PADRAO.folha }),
  terraco: acab('#46562f', { rugo: 0.92, padrao: PADRAO.folha }),
  aguaFundo: acab('#1f3d45', { rugo: 0.05, metal: 0.2, luz: LUZ.piscina, padrao: PADRAO.agua }),
};

/** Diferença entre dois ângulos em graus, em [-180, 180). */
const difGraus = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;

/**
 * Ângulos (graus, de 0 a 360) de um arco de raio r em n trechos iguais, com as bordas dos portais somadas: cada
 * portal é uma passagem reta de largura vao no eixo do ângulo a (os lados dela são paralelos ao eixo, não radiais).
 */
function angulosComPortais(r, n, portais, vao) {
  const meio = (Math.asin(Math.min(1, vao / 2 / r)) * 180) / Math.PI;
  const A = [];
  for (let i = 0; i <= n; i++) A.push((360 * i) / n);
  for (const a of portais) for (const s of [-1, 1]) A.push((((a + s * meio) % 360) + 360) % 360);
  A.sort((x, y) => x - y);
  const out = [];
  for (const a of A) if (!out.length || a - out[out.length - 1] > 0.02) out.push(a);
  return { A: out, meio };
}

/**
 * Sede em anel fechado (D63, Apple Park medida no OpenStreetMap): 481 m por fora e 358 m por dentro nas bordas das
 * marquises, 4 andares em 30 m. Vidro curvo do chão ao teto por fora e por dentro, com a marquise branca contínua em
 * cada laje (3,2 m de balanço) e a cobertura de painéis solares com a borda branca; nos quatro eixos o anel passa por
 * cima de um pórtico de 40 m por 18 m. No LOD0 as marquises são geometria; no LOD1 saem do shader do vidro (a faixa
 * branca que cresce com o ângulo de vista) e o anel tem menos trechos.
 */
function sedeAnel(g, p) {
  const { cx, cz, rFora, rDentro, altura, andares, portais = [], vao = 40, pe = 18 } = p;
  const lod = g.lod ?? 1;
  const balanco = 3.2;
  const rgF = rFora - balanco;
  const rgD = rDentro + balanco;
  const peAndar = altura / andares;
  const yTeto = altura - 1.4;
  // a cota no próprio anel (o centro é o lago, cavado)
  const y = g.chao(cx + (rFora + rDentro) / 2, cz);
  const nSeg = lod === 0 ? 320 : 128;
  const sem = hashF(Math.round(cx), Math.round(rFora), 13);
  const kv = vid(VIDRO.sede, sem);
  const rad = Math.PI / 180;
  const pt = (r, a) => [cx + r * Math.cos(a * rad), cz + r * Math.sin(a * rad)];
  const noPortal = (a, meio) => portais.some((q) => Math.abs(difGraus(a, q)) < meio - 1e-6);
  const fora = angulosComPortais(rgF, nSeg, portais, vao);
  const dentro = angulosComPortais(rgD, Math.round(nSeg * 0.8), portais, vao);
  // vidro curvo: normal radial por vértice (a face lê redonda, não facetada); u em metros ao longo da face
  const parede = (r, a0, a1, y0, y1, sinal) => {
    const [x0, z0] = pt(r, a0);
    const [x1, z1] = pt(r, a1);
    const n0 = [Math.cos(a0 * rad) * sinal, 0, Math.sin(a0 * rad) * sinal];
    const n1 = [Math.cos(a1 * rad) * sinal, 0, Math.sin(a1 * rad) * sinal];
    const u0 = r * a0 * rad;
    const u1 = r * a1 * rad;
    const i0 = g.vidro.v(x0, y + y0, z0, ...n0, u0, y0, kv);
    const i1 = g.vidro.v(x1, y + y0, z1, ...n1, u1, y0, kv);
    const i2 = g.vidro.v(x1, y + y1, z1, ...n1, u1, y1, kv);
    const i3 = g.vidro.v(x0, y + y1, z0, ...n0, u0, y1, kv);
    g.vidro.tri(i0, i1, i2);
    g.vidro.tri(i0, i2, i3);
  };
  // faixa horizontal entre dois raios num trecho de arco (topo ou fundo de marquise e cobertura); uv = (x, z)
  const faixa = (r0, r1, a0, a1, yy, k, cima) => {
    const P = [pt(r0, a0), pt(r0, a1), pt(r1, a1), pt(r1, a0)];
    g.opaco.quad(...P.map(([x, z]) => [x, y + yy, z]), [0, cima ? 1 : -1, 0], ...P.map(([x, z]) => [x, z]), k);
  };
  // borda vertical de uma faixa (a testa da marquise ou da cobertura)
  const testa = (r, a0, a1, y0, y1, k, sinal) => {
    const [x0, z0] = pt(r, a0);
    const [x1, z1] = pt(r, a1);
    const am = ((a0 + a1) / 2) * rad;
    g.opaco.quad([x0, y + y0, z0], [x1, y + y0, z1], [x1, y + y1, z1], [x0, y + y1, z0], [Math.cos(am) * sinal, 0, Math.sin(am) * sinal], [r * a0 * rad, y0], [r * a1 * rad, y0], [r * a1 * rad, y1], [r * a0 * rad, y1], k);
  };
  const lajes = [];
  for (let i = 1; i < andares; i++) lajes.push(peAndar * i);
  for (const [lista, rg, rb, sinal] of [[fora, rgF, rFora, 1], [dentro, rgD, rDentro, -1]]) {
    const { A, meio } = lista;
    for (let i = 0; i + 1 < A.length; i++) {
      const a0 = A[i];
      const a1 = A[i + 1];
      const portal = noPortal((a0 + a1) / 2, meio);
      if (!g.sombra || !portal) parede(rg, a0, a1, portal ? pe : 0, yTeto, sinal);
      if (g.sombra) continue;
      // cobertura: a borda branca de 4 m e o balanço com o forro aceso por baixo
      faixa(rg, rb, a0, a1, yTeto, KS.marquiseForro, false);
      testa(rb, a0, a1, yTeto, altura, KS.marquise, sinal);
      if (lod === 0) {
        for (const yl of lajes) {
          if (portal && yl < pe) continue;
          faixa(rg, rb, a0, a1, yl + 0.25, KS.marquise, true);
          faixa(rg, rb, a0, a1, yl - 0.25, KS.marquiseForro, false);
          testa(rb, a0, a1, yl - 0.25, yl + 0.25, KS.marquise, sinal);
        }
      }
    }
  }
  // cobertura: o campo de painéis solares entre as bordas brancas (as faixas seguem os ângulos de fora)
  {
    const { A } = fora;
    const rSolF = rFora - 4;
    const rSolD = rDentro + 4;
    for (let i = 0; i + 1 < A.length; i++) {
      const [a0, a1] = [A[i], A[i + 1]];
      if (g.sombra) {
        faixa(rDentro, rFora, a0, a1, altura, KS.marquise, true);
        continue;
      }
      faixa(rSolF, rFora, a0, a1, altura, KS.marquise, true);
      faixa(rDentro, rSolD, a0, a1, altura, KS.marquise, true);
      faixa(rSolD, rSolF, a0, a1, altura - 0.05, K.solar, true);
    }
  }
  // pórticos: os lados da passagem em vidro (saguões) e o teto aceso a 18 m
  for (const a of portais) {
    for (const s of [-1, 1]) {
      const aF = a + s * fora.meio;
      const aD = a + s * dentro.meio;
      const [xF, zF] = pt(rgF, aF);
      const [xD, zD] = pt(rgD, aD);
      // a normal olha para dentro da passagem (para o eixo)
      const nx = -Math.sin(a * rad) * -s;
      const nz = Math.cos(a * rad) * -s;
      const ks = vid(VIDRO.saguao, sem);
      const L = Math.hypot(xD - xF, zD - zF);
      if (g.sombra) continue;
      g.vidro.quad([xF, y, zF], [xD, y, zD], [xD, y + pe, zD], [xF, y + pe, zF], [nx, 0, nz], [0, 0], [L, 0], [L, pe], [0, pe], ks);
    }
    if (g.sombra) continue;
    const P = [];
    const nF = 8;
    for (let i = 0; i <= nF; i++) P.push(...pt(rgF, a - fora.meio + (2 * fora.meio * i) / nF));
    for (let i = nF; i >= 0; i--) P.push(...pt(rgD, a - dentro.meio + (2 * dentro.meio * i) / nF));
    tampa(g.opaco, P, y + pe, KS.marquiseForro, false);
    // piso de pedra da passagem
    tampa(g.opaco, P, y + 0.3, K.piso, true);
  }
  if (!g.sombra) {
    // calçada de pedra junto das duas faces (os balanços fazem a varanda coberta)
    const n = lod === 0 ? 160 : 72;
    const anelPiso = (r0, r1) => {
      for (let i = 0; i < n; i++) faixa(r0, r1, (360 * i) / n, (360 * (i + 1)) / n, 0.18, K.piso, true);
    };
    anelPiso(rgF - 0.5, rFora + 5);
    anelPiso(rDentro - 5, rgD + 0.5);
  }
  // caixas de seleção: 24 ao longo do anel, que seguem a curva (quatro caixas de um quarto do anel cada cobriam o lago
  // e o pátio, e o toque na água escolhia a Sede)
  const nC = 24;
  const rm = (rFora + rDentro) / 2;
  const meiaC = Math.max((rFora - rDentro) / 2, rm * Math.sin(Math.PI / nC)) + 2;
  for (let q = 0; q < nC; q++) {
    const [mx, mz] = pt(rm, (360 * (q + 0.5)) / nC);
    g.caixa([mx, y, mz], meiaC, altura);
  }
}

/**
 * Cúpula de vidro (D65; Jewel Changi, Eden Project, o Cloud Forest dos Gardens by the Bay): calota esférica de 240 m
 * por 80 m com o óculo no alto e a malha diagonal de verdade (barras de aço branco nas loxodromias a 45 graus, que
 * fazem losangos de lado igual do pé ao óculo: no plano de Mercator da esfera são retas). Por dentro, a montanha de
 * floresta em terraços com o vórtice de água que cai do óculo num lago no topo dela. O vidro é transparente (material
 * 'claro'): a floresta aparece por ele. LOD0: as barras em geometria; LOD1: no shader do vidro (as mesmas retas).
 */
function cupula(g, p) {
  const lod = g.lod ?? 1;
  const y = g.chao(p.x, p.z);
  const R = p.diametro / 2;
  const H = p.altura;
  const Rs = (R * R + H * H) / (2 * H);
  const yc = H - Rs;
  const aBase = Math.acos(Math.max(-1, Math.min(1, -yc / Rs)));
  const aOculo = Math.asin(Math.min(1, (p.oculo ?? 14) / Rs));
  const N = 32; // losangos em volta (malha principal)
  const k2 = N / (2 * Math.PI);
  const tBase = Math.tan(aBase / 2);
  const sTopo = k2 * Math.log(tBase / Math.tan(aOculo / 2));
  const alfa = (s) => 2 * Math.atan(tBase * Math.exp(-s / k2));
  const ponto = (u, s, dr = 0) => {
    const a = alfa(s);
    const f = u / k2;
    const r = (Rs + dr) * Math.sin(a);
    return [p.x + r * Math.cos(f), y + yc + (Rs + dr) * Math.cos(a), p.z + r * Math.sin(f)];
  };
  const normal = (u, s) => {
    const a = alfa(s);
    const f = u / k2;
    return [Math.sin(a) * Math.cos(f), Math.cos(a), Math.sin(a) * Math.sin(f)];
  };
  const alvoVidro = g.claro ?? g.vidro;
  if (!g.sombra) {
    // o vidro: faixas em s (meio losango cada) e segmentos em u; vC.x leva o lado da célula principal em metros
    const nU = lod === 0 ? 96 : 48;
    const passoS = lod === 0 ? 0.5 : 1;
    const linhasS = [];
    for (let s = 0; s < sTopo - 1e-6; s += passoS) linhasS.push(s);
    linhasS.push(sTopo);
    const L = nU + 1;
    const base = alvoVidro.vertices;
    for (const s of linhasS) {
      const cel = (2 * Math.PI * Rs * Math.sin(alfa(s))) / N;
      for (let i = 0; i <= nU; i++) {
        const u = (N * i) / nU;
        alvoVidro.v(...ponto(u, s), ...normal(u, s), u, s, [cel, 0, 0, 0]);
      }
    }
    for (let j = 0; j + 1 < linhasS.length; j++) {
      for (let i = 0; i < nU; i++) {
        const a = base + j * L + i;
        alvoVidro.tri(a, a + 1, a + L + 1);
        alvoVidro.tri(a, a + L + 1, a + L);
      }
    }
  }
  // barras da malha principal (LOD0): de nó a nó nas duas famílias, um pouco por fora do vidro
  if (lod === 0 && !g.sombra) {
    for (let j = 0; j + 0.5 <= sTopo + 1e-6; j += 0.5) {
      const s0 = j;
      const s1 = Math.min(sTopo, j + 0.5);
      for (let k = 0; k < N; k++) {
        const u0 = k + (j % 1 ? 0.5 : 0);
        const r = 0.28 + 0.34 * Math.sin(alfa(s0)); // mais grossas no pé
        barra(g.opaco, ponto(u0, s0, 0.6), ponto(u0 + (s1 - s0), s1, 0.6), r, 3, KS.estrutura);
        barra(g.opaco, ponto(u0, s0, 0.6), ponto(u0 - (s1 - s0), s1, 0.6), r, 3, KS.estrutura);
      }
    }
  }
  // anel do óculo e o anel do pé (concreto claro com as quatro entradas nos eixos)
  const rOc = Rs * Math.sin(aOculo);
  const yOc = y + yc + Rs * Math.cos(aOculo);
  cilindro(g.opaco, p.x, p.z, yOc - 1.2, yOc + 0.8, rOc + 1.4, rOc + 1.4, 32, KS.estrutura, { topo: false });
  if (!g.sombra) anelPlano(g.opaco, p.x, yOc + 0.8, p.z, rOc, rOc + 1.4, 32, KS.estrutura);
  const segP = lod === 0 ? 72 : 36;
  for (let s = 0; s < segP; s++) {
    const a0 = (s / segP) * Math.PI * 2;
    const a1 = ((s + 1) / segP) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    const entrada = [0, Math.PI / 2, Math.PI, 1.5 * Math.PI].some((q) => Math.abs(Math.atan2(Math.sin(am - q), Math.cos(am - q))) < 0.06);
    const P = [
      p.x + (R + 0.5) * Math.cos(a0), p.z + (R + 0.5) * Math.sin(a0), p.x + (R + 0.5) * Math.cos(a1), p.z + (R + 0.5) * Math.sin(a1),
      p.x + (R - 3) * Math.cos(a1), p.z + (R - 3) * Math.sin(a1), p.x + (R - 3) * Math.cos(a0), p.z + (R - 3) * Math.sin(a0),
    ];
    prisma(g.opaco, P, y - 2, y + (entrada ? 0.3 : 3.2), { paredes: KS.pedraClara, topo: K.piso });
  }
  if (!g.sombra) prisma(g.opaco, aoMundo(elipse(R + 10, R + 10, segP), p.x, p.z, 0), y - 2, y + 0.2, { paredes: K.granito, topo: K.piso });

  // por dentro: a montanha de floresta em terraços, com o lago no topo onde cai o vórtice (fora do fantasma)
  if (!g.sombra && !g.fantasma) {
    const nT = 7;
    const rPe = R * 0.74;
    const rTopo = R * 0.2;
    const hTopo = H * 0.47;
    const seg = lod === 0 ? 48 : 28;
    tampa(g.opaco, aoMundo(elipse(R - 3, R - 3, seg), p.x, p.z, 0), y + 0.25, K.grama, true);
    for (let i = 0; i < nT; i++) {
      const r = rPe - ((rPe - rTopo) * i) / nT;
      const r1 = rPe - ((rPe - rTopo) * (i + 1)) / nT;
      const y0 = y + (hTopo * i) / nT;
      const y1 = y + (hTopo * (i + 1)) / nT;
      // muro verde do degrau (plantas pendentes) e o terraço plantado por cima
      cilindro(g.opaco, p.x, p.z, y0, y1, r, r, seg, KS.muroVerde, { topo: false, a0: i * 0.37 });
      const Pa = aoMundo(elipse(r, r, seg), p.x, p.z, i * 0.37);
      const Pb = aoMundo(elipse(r1, r1, seg), p.x, p.z, i * 0.37);
      faixaEntre(g.opaco, Pa, Pb, y1, KS.terraco, true);
      if (g.arvores) {
        const nA = lod === 0 ? Math.round(r / 5) : Math.round(r / 12);
        for (let a = 0; a < nA; a++) {
          const ang = (a / nA) * Math.PI * 2 + i * 0.9;
          const rr = (r + r1) / 2 + (hashF(a, i, 21) - 0.5) * (r - r1) * 0.5;
          arvore(g.arvores, p.x + Math.cos(ang) * rr, y1, p.z + Math.sin(ang) * rr, { altura: 7 + 5 * hashF(a, i), raio: 2.6 + 1.4 * hashF(i, a), semente: 900 + i * 50 + a, tipo: hashF(a, i, 4) < 0.18 ? 'palmeira' : 'copa', detalhe: 0 });
        }
      }
    }
    // o lago do topo e o vórtice que cai do óculo
    tampa(g.opaco, aoMundo(elipse(rTopo, rTopo, seg), p.x, p.z, 0), y + hTopo - 0.4, KS.aguaFundo, true);
    if (g.efeitos) cascaEfeito(g.efeitos, p.x, p.z, y + hTopo - 0.4, yOc, 4.2, 6.5, lod === 0 ? 20 : 10, CASCATA.vortice, lod === 0 ? 8 : 3, 0.4);
  }
  g.caixa([p.x, y, p.z], R, H);
}

/**
 * Fontes dançantes em arco (Dubai Fountain): as posições dos jatos (os grandes no arco, os pequenos 7 m para dentro,
 * intercalados) para o InstancedMesh; a coreografia é do sombreador (torre.js, materialJato).
 */
function fontes(g, p) {
  const { cx, cz, r, de, ate, n } = p;
  const lista = [];
  for (let i = 0; i < n; i++) {
    const f = n > 1 ? i / (n - 1) : 0.5;
    const [x, z] = noArco(cx, cz, r, de + (ate - de) * f);
    lista.push({ x, z, f, tipo: 0 });
    if (i + 1 < n && i % 2 === 0) {
      const f2 = (i + 0.5) / (n - 1);
      const [x2, z2] = noArco(cx, cz, r - 7, de + (ate - de) * f2);
      lista.push({ x: x2, z: z2, f: f2, tipo: 1 });
    }
  }
  if (g.jatos) g.jatos.push(...lista);
  if (!lista.length) return;
  // caixa justa do arco de jatos (a de um quadrado de 0,9 r cobria a ilha e a face de dentro da Sede)
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const j of lista) {
    x0 = Math.min(x0, j.x);
    x1 = Math.max(x1, j.x);
    z0 = Math.min(z0, j.z);
    z1 = Math.max(z1, j.z);
  }
  g.caixa([(x0 + x1) / 2, g.chao(cx, cz), (z0 + z1) / 2], (x1 - x0) / 2 + 4, 20, (z1 - z0) / 2 + 4);
}

/** Tipos de peça que viram volumes aqui (o reservatório é do lago.js; a Torre, do torre.js). */
export const PECAS = Object.freeze({ conselho, sede, anel, biblioteca, vida, supertree, escola, universidade, fisica, podio, barragem, sedeAnel, cupula, fontes });

/** Peças que mudam do LOD0 para o LOD1 (as outras saem iguais nos dois). */
export const PECAS_COM_LOD = Object.freeze(new Set(['sedeAnel', 'cupula']));

/**
 * Monta as peças de uma parte nas malhas do destino.
 * @param {{ id: string, pecas: object[] }} parte
 * @param {{ chao: (x: number, z: number) => number, vidro: Malha, opaco: Malha, arvores?: Malha, claro?: Malha,
 *   efeitos?: Malha, jatos?: object[], nivelAgua?: number, lod?: 0 | 1, sombra?: boolean, so?: (p) => boolean }} destino
 *   lod: o detalhe das peças com LOD; sombra: só o volume que projeta; so: filtro de peças
 * @returns {{ caixas: number[][] }}  caixas [x0, y0, z0, x1, y1, z1] por peça (a seleção e a câmera usam)
 */
export function montarParte(parte, destino) {
  const caixas = [];
  const g = {
    lod: 1,
    ...destino,
    // caixa alinhada aos eixos: meia largura em x (e em z, se meiaZ não vier), altura h a partir de c[1]
    caixa: (c, meia, h, meiaZ = meia) => caixas.push([c[0] - meia, c[1], c[2] - meiaZ, c[0] + meia, c[1] + h, c[2] + meiaZ]),
  };
  for (const p of parte.pecas) {
    if (destino.so && !destino.so(p)) continue;
    const fn = PECAS[p.tipo];
    if (fn === barragem) fn(g, p, destino.nivelAgua ?? g.chao(...p.de) - 2);
    else if (fn) fn(g, p);
  }
  return { caixas };
}

/** Malhas novas para montar partes (atalho dos testes e do fantasma). */
export function malhasNovas() {
  return { vidro: new Malha('vidro'), opaco: new Malha('opaco'), arvores: new Malha('opaco'), claro: new Malha('claro'), efeitos: new Malha('cascata'), jatos: [] };
}

