// Plano diretor da Arcologia de Held: o "Trevo da Holding" (plano mestre, revisão 6). A Arcologia é UMA
// megaestrutura: o Anel Mestre (Sede da Holding na coroa norte e o Anel de moradia pelo sul) abraça o lago com a Torre
// no meio; nos 4 nós diagonais ficam os tambores (rotundas) e de cada um sai uma folha em gota (Escola SO,
// Universidade SE, Biblioteca NO, Vida NE); por fora, fitas do mesmo vocabulário fecham o contorno (Onda e Elo Norte
// nos vales, Humanidades e Vila abraçando a Praça, Elo do Santuário com o Centro de Física ao norte). Eixo reto em
// x = 0: portão, praça, esplanada, portal do Anel, bulevar, pavilhão, ponte, ilha, Torre, ponte privada, portal da
// Sede e poço do acelerador. Carro só no anel viário de fora; mata só como moldura.
//
// Tudo sai de poucas medidas (P, abaixo), como em pm/gera_pm.py (porte fiel das contas). Convenções:
//   - x leste, z sul (norte = z negativo); unidades do mundo; alturas em unidades (0,5 = um pavimento das fitas).
//   - Ângulos em GRAUS, 0 = leste (+x), 90 = sul (+z), 270 = norte (medidos de +x para +z). Só arco() recebe
//     radianos (assinatura antiga). Para girar no three: rotation.y = -graus * PI / 180.
//   - Caminho de fita = linha média; o perfil vai de o0 = -w/2 (dentro: lago, miolo, pátio) a o1 = +w/2 (fora) e o
//     caminho corre no sentido em que a normal [tz, -tx] aponta para FORA. cortes e frações = fração do comprimento.
//   - Coordenadas fracionárias (fr): um par só de inteiros vira outro tipo de vetor no motor de JS e deixa as
//     consultas do terreno (feitas para cada vértice) mais de 2 vezes mais lentas.
// A regra das juntas (seção 6 do plano) e as âncoras são conferidas por ferramentas/teste-planta.mjs.
export const MESA = { x0: -40, x1: 40, z0: -34, z1: 28 };

// Vista padrão: do portão sul, olhando o eixo até a Torre (o nome ficou da vista da foto)
export const VISTA_FOTO = { x: 0, z: 0, dist: 78, yaw: 0, pitch: 0.66, fov: 34, roll: 0 };

// ---------------------------------------------------------------- medidas (o resto é conta)
const P = {
  C: [0, -3.5], RX: 17.5, RZ: 13.5, W: 3.0,            // Anel Mestre: borda externa e largura (linha média 16 x 12)
  RD: 3.0,                                            // raio dos tambores
  NOS: { SE: 30, SO: 150, NO: 210, NE: 330 },         // ângulo paramétrico de cada tambor na elipse média
  PORTAL_S: 4.2, PORTAL_N: 3.6,                       // portais do eixo (Anel em 90, Sede em 270)
  LAGO: [11.3, 7.3], ILHA: 3.9,
  PET: { SO: { Rm: 6.4, w: 2.2, D: 28.3, beta: 52, g: 34 }, SE: { Rm: 6.4, w: 2.2, D: 28.3, beta: 52, g: 34 },
    NO: { Rm: 7.4, w: 2.2, D: 30.0, beta: 50, g: 34 }, NE: { Rm: 7.4, w: 2.2, D: 30.0, beta: 50, g: 34 } },
  PRACA: { c: [0, 19.8], r: 4.7, w: 1.4 },            // colunata da praça (linha média)
  FIS: { c: [0, -22.0], r: 3.9, w: 1.5 },             // crescente do Centro de Física (linha média) em volta do poço
  RF_LAT: 7.0, RF_S: 14.0, RF_N: 10.0,                // raios (linha média) das concordâncias
  W_CONT: { onda: 1.8, uniElo: 1.8, humanidades: 1.9, casas: 1.9, elo: 1.5 },
  VIA: { x0: -38.6, x1: 38.6, z0: -32.4, z1: 26.6, r: 7.0, w: 1.3 },
};
export const J = 0.12;                                // junta entre peças de projetos diferentes

// ---------------------------------------------------------------- ajudantes de geometria
const fr = (n) => (Number.isInteger(n) ? n + 1e-4 : n);
const r4 = (n) => fr(Math.round(n * 1e4) / 1e4);
const q = (p) => [r4(p[0]), r4(p[1])];                // ponto exportado (4 casas, fracionário)
const qs = (l) => l.map(q);
const rad = (a) => (a * Math.PI) / 180, deg = (a) => (a * 180) / Math.PI, mod = (a, m) => ((a % m) + m) % m;
const pol = (c, r, a, rz = r) => [c[0] + Math.cos(rad(a)) * r, c[1] + Math.sin(rad(a)) * rz];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const ang = (c, p) => deg(Math.atan2(p[1] - c[1], p[0] - c[0]));
const unit = (a, b) => { const d = dist(a, b) || 1; return [(b[0] - a[0]) / d, (b[1] - a[1]) / d]; };
const add = (p, u, s) => [p[0] + u[0] * s, p[1] + u[1] * s];
// arco em graus com passo máximo (o mesmo de gera_pm.arco)
function arcoP(c, r, a0, a1, rz = r, passo = 0.35) {
  const n = Math.max(4, Math.floor((Math.abs(rad(a1 - a0)) * Math.max(r, rz)) / passo)); const out = [];
  for (let i = 0; i <= n; i++) out.push(pol(c, r, a0 + ((a1 - a0) * i) / n, rz));
  return out;
}
function bez(p0, p1, p2, p3, n = 24) {
  const out = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t; out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]); }
  return out;
}
const acum = (pts) => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + dist(pts[i - 1], pts[i])); return L; };
// comprimento de uma polilinha
export const comprimento = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]); return s; };
// polilinha reamostrada com passo uniforme (n = piso de L / passo)
export function reamostra(pts, passo = 0.3) {
  const L = acum(pts), T = L[L.length - 1]; const n = Math.max(2, Math.floor(T / passo)); const out = []; let j = 0;
  for (let k = 0; k <= n; k++) {
    const s = (T * k) / n; while (j < L.length - 2 && L[j + 1] < s) j++;
    const t = (s - L[j]) / (L[j + 1] - L[j] || 1); out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t]);
  }
  return out;
}
// pedaço de uma polilinha entre as frações f0 e f1 do comprimento
export function trecho(pts, f0, f1) {
  const L = acum(pts), T = L[L.length - 1], a = f0 * T, b = f1 * T;
  const em = (s) => { for (let i = 1; i < L.length; i++) if (L[i] >= s) { const t = (s - L[i - 1]) / (L[i] - L[i - 1] || 1); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]; } return pts[pts.length - 1].slice(); };
  const out = [em(a)]; for (let i = 0; i < pts.length; i++) if (L[i] > a && L[i] < b) out.push(pts[i].slice()); out.push(em(b)); return out;
}
// ponto de uma polilinha na fração f do comprimento
export const noCaminho = (pts, f) => trecho(pts, f, f)[0];
// fração do comprimento do vértice mais perto de p
function fracaoDe(pts, p) { const L = acum(pts); let k = 0, d = 1e9; for (let i = 0; i < pts.length; i++) { const e = dist(pts[i], p); if (e < d) { d = e; k = i; } } return L[k] / L[L.length - 1]; }
// sentido do caminho com a normal [tz, -tx] apontando para FORA (longe de ref), pelo ponto do meio
function orienta(pts, ref) {
  const i = Math.floor(pts.length / 2), a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], m = pts[i];
  const tx = b[0] - a[0], tz = b[1] - a[1]; return (m[0] - ref[0]) * tz + (m[1] - ref[1]) * -tx > 0 ? pts : pts.slice().reverse();
}
const fitaPts = (pts, ref) => orienta(reamostra(pts, 0.3), ref);   // caminho de fita: passo 0,3 e normal para fora
// retângulo w x d em c girado a graus (eixo w ao longo do ângulo)
function ret(c, w, d, a) { const ca = Math.cos(rad(a)), sa = Math.sin(rad(a)); return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [c[0] + u * ca - v * sa, c[1] + u * sa + v * ca]); }
function elipseRot(c, rx, rz, rot, n = 40) { const ca = Math.cos(rad(rot)), sa = Math.sin(rad(rot)); const out = []; for (let i = 0; i < n; i++) { const t = (2 * Math.PI * i) / n, u = Math.cos(t) * rx, v = Math.sin(t) * rz; out.push([c[0] + u * ca - v * sa, c[1] + u * sa + v * ca]); } return out; }
const areaSinal = (P_) => { let s = 0; for (let i = 0; i < P_.length; i++) { const a = P_[i], b = P_[(i + 1) % P_.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
function dentro(p, P_) { let d = false; for (let i = 0, j = P_.length - 1; i < P_.length; j = i++) { const [xi, zi] = P_[i], [xj, zj] = P_[j]; if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) d = !d; } return d; }
function distSeg(p, a, b) { const vx = b[0] - a[0], vz = b[1] - a[1], l = vx * vx + vz * vz; const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / l)) : 0; return Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vz * t); }
// cruzamento próprio de dois segmentos: { t, u, p } ou null
function cruza(a, b, c, d) {
  const rx = b[0] - a[0], rz = b[1] - a[1], sx = d[0] - c[0], sz = d[1] - c[1], den = rx * sz - rz * sx; if (Math.abs(den) < 1e-12) return null;
  const t = ((c[0] - a[0]) * sz - (c[1] - a[1]) * sx) / den, u = ((c[0] - a[0]) * rz - (c[1] - a[1]) * rx) / den;
  return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9 ? { t, u, p: [a[0] + rx * t, a[1] + rz * t] } : null;
}
// Douglas-Peucker (polilinha aberta; num laço, passe o laço com o primeiro ponto repetido no fim)
function simplifica(pts, tol) {
  if (pts.length < 3) return pts.slice(); const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const pilha = [[0, pts.length - 1]];
  while (pilha.length) { const [i, j] = pilha.pop(); let dm = 0, k = -1; for (let m = i + 1; m < j; m++) { const d = distSeg(pts[m], pts[i], pts[j]); if (d > dm) { dm = d; k = m; } } if (dm > tol) { keep[k] = 1; pilha.push([i, k], [k, j]); } }
  return pts.filter((_, i) => keep[i]);
}
const simplificaLaco = (P_, tol) => simplifica([...P_, P_[0]], tol).slice(0, -1);
// contorno de um laço afastado d para fora: juntas redondas nas quinas convexas e os laços das quinas côncavas
// cortados (o laço começa num trecho liso e convexo: o portão)
function afasta(laco, d) {
  const pts = laco.slice(); if (dist(pts[0], pts[pts.length - 1]) < 1e-6) pts.pop(); const n = pts.length; const s = areaSinal(pts) > 0 ? 1 : -1;
  const nor = (a, b) => { const l = dist(a, b) || 1; return [(s * (b[1] - a[1])) / l, (-s * (b[0] - a[0])) / l]; };
  let Q = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], p = pts[i], b = pts[(i + 1) % n]; const n1 = nor(a, p), n2 = nor(p, b);
    const vira = Math.atan2(n1[0] * n2[1] - n1[1] * n2[0], n1[0] * n2[0] + n1[1] * n2[1]);
    if (Math.abs(vira) < rad(12)) { const k = d / (1 + n1[0] * n2[0] + n1[1] * n2[1]); Q.push([p[0] + (n1[0] + n2[0]) * k, p[1] + (n1[1] + n2[1]) * k]); }
    else if (s * vira > 0) { const a0 = Math.atan2(n1[1], n1[0]), m = Math.ceil(Math.abs(vira) / rad(15)); for (let k = 0; k <= m; k++) { const t = a0 + (vira * k) / m; Q.push([p[0] + Math.cos(t) * d, p[1] + Math.sin(t) * d]); } }
    else Q.push(add(p, n1, d), add(p, n2, d));
  }
  for (let i = 0; i < Q.length - 1; ) {
    let corte = null; const a = Q[i], b = Q[i + 1], x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), z0 = Math.min(a[1], b[1]), z1 = Math.max(a[1], b[1]);
    for (let k = 2; k < 60 && i + k < Q.length; k++) {
      const c = Q[i + k], d = Q[(i + k + 1) % Q.length]; if (Math.max(c[0], d[0]) < x0 || Math.min(c[0], d[0]) > x1 || Math.max(c[1], d[1]) < z0 || Math.min(c[1], d[1]) > z1) continue;
      const X = cruza(a, b, c, d); if (X) { corte = [k, X.p]; break; }
    }
    if (corte) Q = [...Q.slice(0, i + 1), corte[1], ...Q.slice(i + corte[0] + 1)]; else i++;
  }
  return Q;
}
// A menos B (polígonos simples, Weiler-Atherton): o maior pedaço que sobra
function menos(A_, B_) {
  const A = areaSinal(A_) > 0 ? A_ : A_.slice().reverse(), B = areaSinal(B_) > 0 ? B_ : B_.slice().reverse();
  const X = [];
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) { const r = cruza(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length]); if (r) X.push({ i, j, t: r.t, u: r.u, p: r.p }); }
  if (!X.length) return dentro(A[0], B) ? [] : A.slice();
  const lista = (V, chave, par) => { const por = V.map(() => []); X.forEach((x, k) => por[x[chave]].push(k)); const out = []; V.forEach((p, i) => { out.push({ p }); por[i].sort((a, b) => X[a][par] - X[b][par]).forEach((k) => out.push({ p: X[k].p, k })); }); return out; };
  const LA = lista(A, 'i', 't'), LB = lista(B, 'j', 'u'); const posA = {}, posB = {}; LA.forEach((n, i) => { if (n.k !== undefined) posA[n.k] = i; }); LB.forEach((n, i) => { if (n.k !== undefined) posB[n.k] = i; });
  const meio = (L, i) => { const a = L[i].p, b = L[(i + 1) % L.length].p; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  const usado = new Set(), pedacos = [];
  for (const k0 in posA) {
    if (usado.has(+k0) || dentro(meio(LA, posA[k0]), B)) continue;   // começa numa saída de A (A sai de B)
    const poly = []; let k = +k0, emA = true;
    do {
      usado.add(k); const L = emA ? LA : LB; let i = emA ? posA[k] : posB[k]; poly.push(L[i].p);
      for (;;) { i = emA ? (i + 1) % L.length : (i - 1 + L.length) % L.length; if (L[i].k !== undefined) { k = L[i].k; break; } poly.push(L[i].p); }
      emA = !emA;
    } while (k !== +k0 && poly.length < 5000);
    pedacos.push(poly);
  }
  return pedacos.sort((a, b) => Math.abs(areaSinal(b)) - Math.abs(areaSinal(a)))[0] || [];
}
// recorte de um polígono por uma região convexa (Sutherland-Hodgman)
function recorta(sujeito, janela) {
  const w = areaSinal(janela) > 0 ? janela : janela.slice().reverse(); let out = sujeito;
  for (let i = 0; i < w.length && out.length; i++) {
    const a = w[i], b = w[(i + 1) % w.length]; const lado = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0; const ent = out; out = [];
    for (let j = 0; j < ent.length; j++) {
      const p = ent[j], r = ent[(j + 1) % ent.length], lp = lado(p), lr = lado(r);
      if (lp) out.push(p);
      if (lp !== lr) { const dx = r[0] - p[0], dz = r[1] - p[1], den = (b[0] - a[0]) * dz - (b[1] - a[1]) * dx; const t = ((a[0] - p[0]) * (b[1] - a[1]) - (a[1] - p[1]) * (b[0] - a[0])) / -den; out.push([p[0] + dx * t, p[1] + dz * t]); }
    }
  }
  return out;
}
// faixa (polígono) de meia largura m ao longo de uma polilinha
function faixaPoly(pts, m) {
  const E = [], D = [];
  for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const [tx, tz] = unit(a, b); E.push([pts[i][0] + tz * m, pts[i][1] - tx * m]); D.push([pts[i][0] - tz * m, pts[i][1] + tx * m]); }
  return [...E, ...D.reverse()];
}
// arco de círculo (ângulos em RADIANOS, de +x para +z) e oval em polígono: assinatura antiga, usada pelos modelos
export function arco(cx, cz, r, a0, a1, n = 24, rz = r) { const out = []; for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; out.push([fr(cx + Math.cos(a) * r), fr(cz + Math.sin(a) * rz)]); } return out; }

// ---------------------------------------------------------------- alturas (pé-direito, níveis, andares extras)
// fh = pé-direito; niveis = níveis da mecânica (os mesmos de hoje); extra = andaresExtra (só na geometria do nível
// máximo); hMax = (niveis + extra) * fh
const ALT_ = { anel: [0.5, 5, 2], sede: [0.55, 4, 4], escola: [0.5, 3, 1], engenharia: [0.5, 3, 1], instituto: [0.5, 3, 1], uni: [0.5, 5, 1], anelBib: [0.55, 3, 1],
  santuario: [0.5, 4, 1], humanidades: [0.5, 3, 1], casas: [0.5, 3, 1], onda: [0.5, 3, 1], uniElo: [0.5, 3, 1] };
export const ALT = Object.fromEntries(Object.entries(ALT_).map(([k, [fh, niveis, extra]]) => [k, { fh, niveis, extra, hMax: Math.round((niveis + extra) * fh * 1e3) / 1e3 }]));
// altura do teto de uma fita no nível n (com os andares extras no nível máximo)
export const alturaDe = (proj, n) => { const a = ALT[proj]; return Math.round((n + (n >= a.niveis ? a.extra : 0)) * a.fh * 1e3) / 1e3; };

// ---------------------------------------------------------------- 1. Anel Mestre, tambores e nós
const C0 = P.C, { RX, RZ, W, RD } = P, MX = RX - W / 2, MZ = RZ - W / 2;
export const C = [0.0001, -3.5001];
export const ANEL_MESTRE = { c: C, rx: RX, rz: RZ, w: W, mx: MX, mz: MZ, rxIn: RX - W, rzIn: RZ - W }; // borda externa, linha média (mx, mz) e face interna
const ell = (a) => pol(C0, MX, a, MZ);
const gapGraus = (a, g) => deg(g / Math.hypot(-Math.sin(rad(a)) * MX, Math.cos(rad(a)) * MZ)); // graus da linha média que medem g perto de a
const anelArco = (a0, a1) => arcoP(C0, MX, a0, a1, MZ, 0.3);
const gT = RD + J;                 // cada rabo de folha termina reto a J da face do tambor
const gTA = RD + J + 0.25;         // o Anel e a Sede param 0,25 antes (a quina interna da curva chega mais perto)
const NOS_ = Object.fromEntries(Object.entries(P.NOS).map(([k, a]) => [k, ell(a)]));
export const NOS = Object.fromEntries(Object.entries(NOS_).map(([k, p]) => [k, q(p)]));
// fita na elipse média entre nós: caminho de ponta a ponta (ângulo crescente), um corte no meio de cada vão entre nós
// (os módulos) e uma abertura em cada nó do meio (tambor ou portal), com a largura medida no caminho
function naElipse(nos, meiaDe) {
  const g = nos.map((a) => gapGraus(a, meiaDe(a))); const a0 = nos[0] + g[0], a1 = nos[nos.length - 1] - g[g.length - 1];
  const n = Math.ceil((rad(a1 - a0) * Math.max(MX, MZ)) / 0.3); const pts = []; for (let i = 0; i <= n; i++) pts.push(pol(C0, MX, a0 + ((a1 - a0) * i) / n, MZ));
  const Lc = acum(pts), L = Lc[n]; const F = (a) => { const u = ((a - a0) / (a1 - a0)) * n, i = Math.max(0, Math.min(n - 1, Math.floor(u))); return (Lc[i] + (Lc[i + 1] - Lc[i]) * (u - i)) / L; };
  const cortes = [0], trechos = [], aberturas = [], aberturaDe = {};
  for (let k = 0; k < nos.length - 1; k++) {
    const f0 = k ? F(nos[k] + g[k]) : 0, f1 = k === nos.length - 2 ? 1 : F(nos[k + 1] - g[k + 1]), m = (f0 + f1) / 2; trechos.push([f0, m], [m, f1]); cortes.push(m);
    if (k < nos.length - 2) { const f2 = F(nos[k + 1] + g[k + 1]); cortes.push((f1 + f2) / 2); aberturas.push(cortes.length - 1); aberturaDe[cortes.length - 1] = Math.round((f2 - f1) * L * 1e4) / 1e4; }
  }
  cortes.push(1); return { pts, L, a0, a1, cortes, trechos, aberturas, aberturaDe };
}
const ANEL_E = naElipse([-30, 30, 90, 150, 210], (a) => (a === 90 ? P.PORTAL_S / 2 : gTA));
const SEDE_E = naElipse([210, 270, 330], (a) => (a === 270 ? P.PORTAL_N / 2 : gTA));
const ORDEM_ANEL = [4, 3, 5, 2, 6, 1, 7, 0];          // módulo do jogo -> trecho do caminho (contrato: nunca reordenar)
// tambores: rotundas no vocabulário da fita, nós de um módulo (sobem com ele, na obra dele). niveis = [raio, y0, y1,
// acabamento] no nível máximo: térreo âmbar, andares creme, último andar recuado com jardim e a lanterna do átrio
const TAMBOR_DE = { SO: ['anel', 4], SE: ['anel', 5], NO: ['sede', 0], NE: ['sede', 3] };
const tamborNiveis = (h) => [[RD, 0, 0.5, 'ambar'], [RD * 0.97, 0.5, h - 1.0, 'creme'], [RD * 0.86, h - 1.0, h, 'creme'], [RD * 0.42, h, h + 0.35, 'vidro']].map(([r, a, b, m]) => [Math.round(r * 1e3) / 1e3, Math.round(a * 1e3) / 1e3, Math.round(b * 1e3) / 1e3, m]);
export const TAMBOR = { r: RD, de: TAMBOR_DE, lanterna: 0.35, recuo: RD * 0.86, fundacao: 3.1,
  nos: Object.fromEntries(Object.entries(TAMBOR_DE).map(([k, [fita, modulo]]) => [k, { id: k, c: NOS[k], r: RD, fita, modulo, h: ALT[fita].hMax, niveis: tamborNiveis(ALT[fita].hMax) }])) };
const noDe = (k) => ({ id: k, c: NOS[k], r: RD, modulo: TAMBOR_DE[k][1] });

// ---------------------------------------------------------------- 2. lago, ilha, jardim do miolo e Torre
const [LRX, LRZ] = P.LAGO, ILHA = P.ILHA;
const JARDIM = { c: C, rx: RX - W - J, rz: RZ - W - J };  // jardim do miolo (entre o lago e a face interna do Anel)
// bacias norte e sul: a oval menos a ilha e a faixa dos diques (z = C +- 0,45); as pontes do eixo passam por cima
function bacia(sg) {
  const te = deg(Math.asin(0.45 / LRZ)), ue = deg(Math.asin(0.45 / ILHA)); const xi = Math.sqrt(ILHA * ILHA - 0.45 * 0.45);
  const oval = sg < 0 ? arcoP(C0, LRX, 180 + te, 360 - te, LRZ, 0.8) : arcoP(C0, LRX, te, 180 - te, LRZ, 0.8);
  const ilha = sg < 0 ? arcoP(C0, ILHA, -ue, -180 + ue, ILHA, 0.4) : arcoP(C0, ILHA, 180 - ue, ue, ILHA, 0.4);
  ilha[0] = [C0[0] + (sg < 0 ? xi : -xi), C0[1] + sg * 0.45]; ilha[ilha.length - 1] = [C0[0] - (sg < 0 ? xi : -xi), C0[1] + sg * 0.45];
  return qs([...oval, ...ilha]);
}
const LAGO = Object.assign(Array.from({ length: 24 }, (_, i) => q(pol(C0, LRX, i * 15, LRZ))), { c: C, rx: LRX, rz: LRZ, bacias: [bacia(-1), bacia(1)] });
// Torre da Holding: bolo de noiva em 4 camadas [raio, y0, y1], coroa de vidro âmbar e laje do heliponto
const TORRE = { c: C, camadas: [[3.3, 0.0, 3.8], [2.65, 3.8, 7.3], [2.05, 7.3, 10.4], [1.5, 10.4, 12.9]], coroa: [1.05, 12.9, 13.6], heliponto: [1.4, 13.6, 14.0], topo: 14.0,
  pouso: [0.0001, 14.0, -3.5001], repasse: [0.0001, 15.0, -3.5001], radier: 3.3 };
const PONTE_PRIV = Object.assign([[0.0001, Math.round((C0[1] - ILHA + 0.1) * 100) / 100], [0.0001, -12.0001]], { w: 1.2, h: 0.5 });
const PISC = [{ c: [-5.2, -11.65], rx: 1.0, rz: 0.65, deck: 0.3 }, { c: [5.2, -11.65], rx: 1.0, rz: 0.65, deck: 0.3 }];
const PAV = { c: [0.0001, 4.7], r: 1.3, h: 1.1, niveis: [[1.3, 0, 0.15, 'piso'], [0.65, 0.15, 0.9, 'vidro'], [1.3, 0.95, 1.1, 'dossel']] };
const gp = gapGraus(270, P.PORTAL_N / 2 - J - 0.04);
const PORTICO = { a: [Math.round((270 - gp) * 100) / 100, Math.round((270 + gp) * 100) / 100], y0: Math.round((ALT.sede.hMax - 1.1) * 100) / 100, topo: ALT.sede.hMax, w: W, caminho: qs(anelArco(270 - gp, 270 + gp)) };
// diques-jardim leste-oeste (lago.e3): da ilha até a face interna do Anel, na linha dos nós de 0 e 180
const DIQUES = [-1, 1].map((s) => { const x0 = s * (ILHA - 0.2), x1 = s * (RX - W - J); return { x0: r4(x0), x1: r4(x1), z: C[1], w: 0.9, h: 0.1, poly: qs([[x0, C0[1] - 0.45], [x1, C0[1] - 0.45], [x1, C0[1] + 0.45], [x0, C0[1] + 0.45]]) }; });
const BOSQ_JARDIM = [45, 135, 225, 315].map((a) => ({ c: q(pol(C0, 12.9, a, 9.1)), rx: 1.2, rz: 0.8 }));

// ---------------------------------------------------------------- 3. folhas em gota
const DIR = Object.fromEntries(Object.keys(NOS_).map((k) => [k, Math.atan2(NOS_[k][1] - C0[1], NOS_[k][0] - C0[0])]));
const SAT = Object.fromEntries(Object.keys(NOS_).map((k) => [k, [C0[0] + Math.cos(DIR[k]) * P.PET[k].D, C0[1] + Math.sin(DIR[k]) * P.PET[k].D]]));
const DS = Object.fromEntries(Object.keys(NOS_).map((k) => [k, dist(SAT[k], NOS_[k])]));   // centro da folha -> centro do tambor
// gota: arco de raio Rm em volta do centro S (de phi + beta a phi + 360 - beta) e dois rabos (cúbicas tangentes ao arco)
// que chegam retos ao tambor, a J da face, a +-g graus do eixo da folha
const GOTA = {};
for (const k of Object.keys(NOS_)) {
  const S = SAT[k], No = NOS_[k], { Rm, beta, g, w } = P.PET[k]; const phi = ang(S, No), a1 = phi + beta, a2 = phi + 360 - beta;
  const P1 = pol(S, Rm, a1), P2 = pol(S, Rm, a2), t1 = [-Math.sin(rad(a1)), Math.cos(rad(a1))], t2 = [-Math.sin(rad(a2)), Math.cos(rad(a2))];
  const phd = ang(No, S); let Q1 = pol(No, gT, phd + g), Q2 = pol(No, gT, phd - g); if (dist(Q1, P1) > dist(Q2, P1)) [Q1, Q2] = [Q2, Q1];
  const u1 = unit(No, Q1), u2 = unit(No, Q2), d = dist(No, S) - Rm, k1 = d * 0.42, k2 = d * 0.5;
  const r1 = bez(Q1, add(Q1, u1, k1), [P1[0] - t1[0] * k2, P1[1] - t1[1] * k2], P1, 30), ar = arcoP(S, Rm, a1, a2, Rm, 0.3), r2 = bez(P2, [P2[0] + t2[0] * k2, P2[1] + t2[1] * k2], add(Q2, u2, k1), Q2, 30);
  GOTA[k] = { pts: reamostra([...r1, ...ar.slice(1), ...r2.slice(1)], 0.3), S, phi, a1, a2, Rm, w, N: No };
}
const GRAMA_R = (k) => Math.round((GOTA[k].Rm - 1.1 - J) * 1e3) / 1e3;  // gramado do miolo (até a junta da face interna)
export const PETALAS = Object.fromEntries(Object.entries(GOTA).map(([k, g]) => { const cam = qs(orienta(g.pts, g.S)); return [k, { S: q(g.S), N: NOS[k], Rm: g.Rm, w: g.w, D: P.PET[k].D, beta: P.PET[k].beta, g: P.PET[k].g,
  phi: Math.round(g.phi * 100) / 100, a1: Math.round(g.a1 * 100) / 100, a2: Math.round(g.a2 * 100) / 100, ds: Math.round(DS[k] * 1e3) / 1e3, grama: GRAMA_R(k), caminho: cam, L: comprimento(cam), pontas: [cam[0], cam[cam.length - 1]] }]; }));

// ---------------------------------------------------------------- 4. contorno: concordâncias e lobos
// círculo de raio Rf tangente por fora a (c1, r1) e (c2, r2), do lado 'fora': arco côncavo entre as tangências
function concordancia(c1, r1, c2, r2, Rf, fora) {
  const d = dist(c1, c2), a = r1 + Rf, b = r2 + Rf, x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
  const [ux, uz] = [(c2[0] - c1[0]) / d, (c2[1] - c1[1]) / d], base = [c1[0] + ux * x, c1[1] + uz * x];
  const F1 = [base[0] - uz * h, base[1] + ux * h], F2 = [base[0] + uz * h, base[1] - ux * h], F = dist(F1, fora) < dist(F2, fora) ? F1 : F2;
  const T1 = [c1[0] + ((F[0] - c1[0]) * r1) / a, c1[1] + ((F[1] - c1[1]) * r1) / a], T2 = [c2[0] + ((F[0] - c2[0]) * r2) / b, c2[1] + ((F[1] - c2[1]) * r2) / b];
  const A1 = ang(F, T1), dA = mod(ang(F, T2) - A1 + 540, 360) - 180;
  return { pts: arcoP(F, Rf, A1, A1 + dA, Rf, 0.3), F, T1, T2, A: [A1, A1 + dA], R: Rf };
}
const PR = P.PRACA, FI = P.FIS, WC = P.W_CONT;
const rDoca = (k, wc) => GOTA[k].Rm + GOTA[k].w / 2 + J + wc / 2;   // a linha média da fita do contorno encosta de lado na folha
const CONC = {};
for (const [nome, a, b, lado] of [['onda', 'SO', 'NO', -1], ['uniElo', 'SE', 'NE', 1]]) CONC[nome] = { ...concordancia(SAT[a], rDoca(a, WC[nome]), SAT[b], rDoca(b, WC[nome]), P.RF_LAT, [lado * 60, (SAT[a][1] + SAT[b][1]) / 2]), w: WC[nome], folhas: [a, b] };
const R_COL_DOCA = PR.r + PR.w / 2 + J + WC.humanidades / 2;
for (const [nome, a, lado] of [['humanidades', 'SO', -1], ['casas', 'SE', 1]]) CONC[nome] = { ...concordancia(SAT[a], rDoca(a, WC[nome]), PR.c, R_COL_DOCA, P.RF_S, [lado * 14, 40]), w: WC[nome], folhas: [a, 'praca'] };
for (const [nome, a, lado] of [['eloO', 'NO', -1], ['eloL', 'NE', 1]]) CONC[nome] = { ...concordancia(SAT[a], rDoca(a, WC.elo), FI.c, FI.r, P.RF_N, [lado * 12, -60]), w: WC.elo, folhas: [a, 'fis'] };
export const CONCORD = Object.fromEntries(Object.entries(CONC).map(([k, c]) => [k, { F: q(c.F), R: c.R, w: c.w, T1: q(c.T1), T2: q(c.T2), A: c.A.map((a) => Math.round(a * 100) / 100), folhas: c.folhas, caminho: qs(c.pts), L: comprimento(c.pts) }]));
// braços do Elo do Santuário: terminam J/2 + 0,02 antes da tangência com o crescente (de ponta, com a junta)
const ELO = {}; for (const k of ['eloO', 'eloL']) { const pts = reamostra(CONC[k].pts, 0.3), L = comprimento(pts); ELO[k] = fitaPts(trecho(pts, 0, 1 - (J / 2 + 0.02) / L), C0); }
const dJ = deg((J / 2 + 0.02) / FI.r); const FIS_A = [mod(ang(FI.c, CONC.eloO.T2), 360) + dJ, mod(ang(FI.c, CONC.eloL.T2), 360) - dJ];
const POCO = { c: [0.0001, -22.0001], rx: 2.3, rz: 1.9, fundo: 1.2 };
// colunata da praça (pas_frente2): dois arcos, aberta ao sul (portão) e ao norte (bulevar)
const COL_A = { O: [108, 250], L: [290, 432] };
const COL = Object.fromEntries(Object.entries(COL_A).map(([k, [a0, a1]]) => [k, fitaPts(arcoP(PR.c, PR.r, a0, a1, PR.r, 0.3), PR.c)]));

// ---------------------------------------------------------------- 5. fitas dos projetos
const fita = (proj, caminho, w, mais = {}) => { const a = ALT[proj], cam = qs(caminho); return { caminho: cam, L: comprimento(cam), w, o0: -w / 2, o1: w / 2, fh: a.fh, niveis: a.niveis, extra: a.extra, hMax: a.hMax,
  modulos: 1, c: q(noCaminho(caminho, 0.5)), meio: q(noCaminho(caminho, 0.5)), pontas: [cam[0], cam[cam.length - 1]], ...mais }; };   // c = meio (as folhas e o Anel trocam pelo centro da figura)
const elipseFita = (E) => ({ cortes: E.cortes, aberturas: E.aberturas, aberturaDe: E.aberturaDe, trechos: E.trechos, a0: Math.round(E.a0 * 100) / 100, a1: Math.round(E.a1 * 100) / 100 });
// Universidade (gota SE): Engenharia no rabo norte, Campus Universitário no arco externo (3,0 depois de cada rabo) e
// Instituto no rabo sul; junta de 0,12 + 0,12 entre os três
const gSE = GOTA.SE.pts, LSE = comprimento(gSE);
const fE = fracaoDe(gSE, pol(GOTA.SE.S, GOTA.SE.Rm, GOTA.SE.a1)) + 3.0 / LSE, fI = fracaoDe(gSE, pol(GOTA.SE.S, GOTA.SE.Rm, GOTA.SE.a2)) - 3.0 / LSE, jL = (J / 2 + 0.06) / LSE;
const ENG = fitaPts(trecho(gSE, 0, fE - jL), SAT.SE), INST = fitaPts(trecho(gSE, fI + jL, 1), SAT.SE), UNI = orienta(reamostra(trecho(gSE, fE + jL, fI - jL), 0.3), SAT.SE);
const UNI_TORRES = [0.34, 0.47, 0.6, 0.73, 0.86];      // frações do caminho do uni (a 1,5 ou mais das docas)
const DOSSEL = (proj, pts, mat) => { const h = ALT[proj].hMax; return { c: q(noCaminho(pts, 0.55)), r: 1.3, haste: 0.156, y0: Math.round((h + 0.75) * 100) / 100, topo: Math.round((h + 0.9) * 100) / 100, mat }; };
const VILA = fitaPts(CONC.casas.pts, C0);

// ---------------------------------------------------------------- 6. miolos das folhas
const uDe = (k) => unit(SAT[k], NOS_[k]);             // eixo da folha, do centro rumo ao tambor
// SO: campo com arquibancada no pescoço (virada para o campo) e 4 torres de luz
const S_SO = SAT.SO, phiSO = GOTA.SO.phi;
const CAMPO = { c: q(add(S_SO, uDe('SO'), -0.5)), w: 5.8, d: 3.6, rot: Math.round((phiSO + 90) * 10) / 10 };
CAMPO.poly = qs(ret(CAMPO.c, CAMPO.w, CAMPO.d, CAMPO.rot));
const ARQ = { c: q(S_SO), r0: 3.75, r1: 4.7, a0: Math.round((phiSO - 34) * 10) / 10, a1: Math.round((phiSO + 34) * 10) / 10, h: 0.8, degraus: 3 };
const TORRES_LUZ = [-1, 1].flatMap((s) => [q(pol(S_SO, 4.25, phiSO + s * 42)), q(pol(S_SO, 4.25, phiSO + 180 + s * 42))]);
// SE: gramado com pista e a Ciências (elipse com a proa para o tambor); Ponte Coberta do tambor à proa
const S_SE = SAT.SE, uSE = uDe('SE');
const CIEN = { c: q(S_SE), rx: 3.6, rz: 2.5, rot: Math.round(GOTA.SE.phi * 10) / 10, h: 2.9, proa: q(add(S_SE, uSE, 3.6)) };
CIEN.poly = qs(elipseRot(S_SE, CIEN.rx, CIEN.rz, CIEN.rot));
const PONTE_COB = { pts: [q(add(S_SE, uSE, DS.SE - RD - J)), q(add(add(S_SE, uSE, 3.6), uSE, J))], w: 1.2, y0: 0.75, topo: 1.45 };
// NO: Biblioteca (torre-vaso em escala 1,15) sobre espelho redondo; CRD em leque no pescoço
const S_NO = SAT.NO, uNO = uDe('NO');
const CRD = { r0: 4.4 + J, r1: DS.NO - RD - J, m0: 1.9, m1: 0.62, h: 1.6 };
const leque = (k, s0, s1, m0, m1) => { const S = SAT[k], u = uDe(k), n = [-u[1], u[0]]; const a = add(S, u, s0), b = add(S, u, s1); return [add(a, n, m0), add(b, n, m1), add(b, n, -m1), add(a, n, -m0)]; };
// NE: Cúpula (0,5 para o fundo do centro da folha), Estufa encostada nela, Galeria na frente da Estufa, Trilha do
// tambor até a Galeria; passeio no chão em volta da Cúpula, de um lado da Estufa ao outro
const S_NE = SAT.NE, uNE = uDe('NE');
const CUP_C = add(S_NE, uNE, -0.5), EST_C = add(CUP_C, uNE, 4.8 + 1.7 - 0.35), GAL_C = add(EST_C, uNE, 1.7 + 1.0 - 0.2);
const aE = ang(CUP_C, EST_C), dE = deg(Math.asin((1.7 + 0.35) / 5.3));
const PASSEIO_S = { c: q(CUP_C), r: 5.3, w: 0.45, a0: Math.round((aE + dE) * 10) / 10, a1: Math.round((aE + 360 - dE) * 10) / 10 };
const TRILHA = { pts: [q(add(S_NE, uNE, DS.NE - RD - J)), q(add(GAL_C, uNE, 1.0 + J))], w: 1.2, y0: 0.6, topo: 1.2, dossel: true };

// ---------------------------------------------------------------- 7. eixo sul: portão, praça, esplanada, portal, bulevar
const PC = PR.c, R_PRACA = PR.r - PR.w / 2 - J;       // piso da praça dentro da colunata (3,88)
const R_COL_EXT = PR.r + PR.w / 2 + J;                // borda externa da colunata mais a junta
const elipseExt = (x, off = J) => C0[1] + (RZ + off) * Math.sqrt(Math.max(0, 1 - (x / (RX + off)) ** 2));  // face externa sul do Anel (mais a junta)
const circCol = (x, r) => PC[1] - Math.sqrt(Math.max(0, r * r - x * x));
const ESPLANADA = (() => { const xm = 3.2, n = 12; const sul = [], norte = []; for (let i = 0; i <= n; i++) { const xs = xm - (2 * xm * i) / n, xn = -xm + (2 * xm * i) / n; sul.push([xs, circCol(xs, R_COL_EXT)]); norte.push([xn, elipseExt(xn)]); } return qs([...norte, ...sul]); })();
const EIXO_BOCA = qs([[-1.3, 6.1], [1.3, 6.1], [1.3, elipseExt(1.3)], [-1.3, elipseExt(1.3)]]);
const PASSO_N = qs([[-1.3, 14.1], [1.3, 14.1], [1.3, 16.2], [-1.3, 16.2]]);   // piso pela abertura norte da colunata
// A.praca.poly: disco da praça + passagem norte + esplanada + eixo da boca num polígono só (placa da obra de
// pavimentação e zona 'praca'), no sentido: disco pelo sul, lado oeste, eixo da boca, lado leste
const PRACA_POLY = (() => {
  const zi = Math.sqrt(R_PRACA * R_PRACA - 1.3 * 1.3), ae = deg(Math.atan2(-zi, 1.3)); const n = Math.ceil((180 - 2 * ae) / 20); const out = [];
  for (let i = 0; i <= n; i++) out.push(pol(PC, R_PRACA, ae + ((180 - 2 * ae) * i) / n));
  const lado = (s) => [[s * 1.3, circCol(1.3, R_COL_EXT)], [s * 2.25, circCol(2.25, R_COL_EXT)], [s * 3.2, circCol(3.2, R_COL_EXT)], [s * 3.2, elipseExt(3.2)], [s * 1.3, elipseExt(1.3)], [s * 1.3, 6.1]];
  return qs([...out, ...lado(-1), ...lado(1).reverse()]);
})();
const FRENTE_PTS = [[0.0001, 25.95, 0.04], [0.0001, Math.round((PC[1] + 2.0) * 100) / 100, 0.04]];
const BULEVAR_PTS = [[0.0001, Math.round((PC[1] - 2.0) * 100) / 100, 0.06], [0.0001, 15.0001, 0.75], [0.0001, 9.0001, 0.75], [0.0001, 6.3, 0.06]];
const gpA = gapGraus(90, P.PORTAL_S / 2 - J - 0.04);
const PORTAL = qs(anelArco(90 - gpA, 90 + gpA));      // portal do Anel: de (1,935; 8,412) a (-1,935; 8,412) na linha média
const PONTE_PTS = [[0.0001, Math.round((PAV.c[1] - PAV.r - J) * 100) / 100, 0.55], [0.0001, Math.round((C0[1] + ILHA - 0.1) * 100) / 100, 0.55]];
const EIXO_N = { poly: qs([[-1.3, -12.0], [1.3, -12.0], [1.3, FI.c[1] + POCO.rz + J], [-1.3, FI.c[1] + POCO.rz + J]]), x: 1.3, z0: -12.0001, z1: r4(FI.c[1] + POCO.rz + J) };

// ---------------------------------------------------------------- 8. pátios da boca, vales, bosquetes
// ponto da face externa do Anel Mestre no ângulo a e a normal para fora
const normalMed = (a) => { const t = rad(a), n = [MZ * Math.cos(t), MX * Math.sin(t)], l = Math.hypot(n[0], n[1]); return [n[0] / l, n[1] / l]; };  // normal da linha média
const normalExt = (a) => { const t = rad(a); const n = [RZ * Math.cos(t), RX * Math.sin(t)], l = Math.hypot(n[0], n[1]); return [[C0[0] + RX * Math.cos(t), C0[1] + RZ * Math.sin(t)], [n[0] / l, n[1] / l]]; };
// rampas em hélice (Caracol a oeste, Rampa da Vila a leste): r = raio externo (a J da face do Anel), deque de 0,55
// em pouco mais de 1,5 volta, do chão (lado de fora) ao patamar de 1,5 encostado (com a junta) na fachada do módulo 0
// (Caracol) ou 1 (Vila). O centro do plano (117 e 63 graus) cai na junta desse módulo com o 2 (ou o 3): o patamar
// começa 0,05 depois do corte, do lado do portal (todo no módulo dono), e a rampa gira mais delta até a quina dele.
// Eixos locais: v = distância de c rumo à face do Anel (a face fica em v = r + J), u = ao longo da face rumo ao portal
function helice(s) {
  const a = 90 - s * 27, [p, n] = normalExt(a), r = 1.25, w = 0.55, rm = r - w / 2, ri = r - w, c = add(p, n, J + r); const t0 = deg(Math.atan2(n[1], n[0])), sent = s < 0 ? 1 : -1;
  const t = rad(a), dA = [-RX * Math.sin(t), RZ * Math.cos(t)], lA = Math.hypot(dA[0], dA[1]), tP = [(s * dA[0]) / lA, (s * dA[1]) / lA];   // u: tangente da face rumo ao portal
  const modulo = s < 0 ? 0 : 1, fs = ANEL_E.trechos[ORDEM_ANEL[modulo]].map((f) => [f, noCaminho(ANEL_E.pts, f)]);
  const [fc, cut] = Math.abs(fs[0][1][0]) > Math.abs(fs[1][1][0]) ? fs[0] : fs[1], tc = unit(noCaminho(ANEL_E.pts, fc - 0.002), noCaminho(ANEL_E.pts, fc + 0.002));
  const junta = add(cut, [tc[1], -tc[0]], W / 2 + J);   // o corte do módulo (lado longe do portal) na linha da junta da face externa
  const u0 = (junta[0] - c[0]) * tP[0] + (junta[1] - c[1]) * tP[1] + 0.05, wp = 1.1;                        // o patamar vai de u0 a u0 + wp
  const sd = Math.min(1, (u0 + 0.05) / ri), dl = deg(Math.asin(sd)), v0 = Math.min(r - w, ri * Math.cos(rad(dl)) - 0.05), d = r - v0;  // a rampa chega com a borda de dentro 0,05 depois de u0
  const te0 = t0 + sent * 540, ev = [-Math.sin(rad(te0)), Math.cos(rad(te0))], eps = ev[0] * tP[0] + ev[1] * tP[1] > 0 ? 1 : -1;
  const sweep = sent * 540 + eps * dl, ns = Math.ceil(Math.abs(sweep) / 15); const pts = [];
  for (let i = 0; i <= ns; i++) { const tt = t0 + (sweep * i) / ns, h = 0.08 + ((1.5 - 0.08) * i) / ns; pts.push([...q(pol(c, rm, tt)), Math.round(h * 1e3) / 1e3]); }
  const pc = add(add(c, n, -(v0 + r) / 2), tP, u0 + wp / 2);
  return { c: q(c), r, w, h: 1.5, a, voltas: Math.round((Math.abs(sweep) / 360) * 1e3) / 1e3, a0: Math.round(t0 * 10) / 10, a1: Math.round((t0 + sweep) * 10) / 10, pts,
    patamar: { c: q(pc), w: wp, d: Math.round(d * 1e3) / 1e3, rot: Math.round((deg(Math.atan2(n[1], n[0])) + 90) * 10) / 10, h: 1.5, em: 'anel', modulo } };
}
const HEL = { caracol: helice(-1), vila: helice(1) };
const PATIO_C = { O: [-12.0, 13.4], L: [12.0, 13.4] }, po = PATIO_C.O, pl = PATIO_C.L;
const MORROS = [{ c: [po[0] - 1.1, po[1] - 0.3], rx: 1.5, rz: 1.1, h: 0.9 }, { c: [po[0] + 1.35, po[1] - 0.55], rx: 1.0, rz: 0.75, h: 0.6 }].map((m) => ({ ...m, c: q(m.c) }));
const PISCINA_E = { c: q([po[0] + 0.4, po[1] + 1.35]), rx: 1.0, rz: 0.45, deck: [0.3, 0.25] };
const ANFI = { c: q(pl), rx: 3.0, rz: 2.3, w: 1.4, a0: 185, a1: 355, h: 0.8, degraus: 4, palco: { c: q([pl[0], pl[1] + 0.9]), w: 2.2, d: 1.0, h: 0.15, poly: qs(ret([pl[0], pl[1] + 0.9], 2.2, 1.0, 0)) }, base: { c: q(pl), rx: 3.3, rz: 2.3 } };
// vales laterais (lago.e3): canal leste-oeste de 1,1 da face externa do Anel até o Repuxo, na face interna da Onda e do
// Elo Norte, com dois bosquetes em massa de cada lado
const VALES = {};
for (const [sx, nome] of [[-1, 'onda'], [1, 'uniElo']]) {
  const c = CONC[nome], F = c.F, rin = c.R + c.w / 2; const xf = F[0] - sx * Math.sqrt(rin * rin - (C0[1] - F[1]) ** 2); const RP = 1.6, cp = [xf - sx * (J + RP), C0[1]];
  const xin = sx * (RX + J), xout = cp[0] - sx * RP, bx = (xin + xout) / 2, brx = Math.abs(xout - xin) / 2 - 0.4;
  VALES[nome] = { canal: { x0: r4(xin), x1: r4(xout), z: C[1], w: 1.1, poly: qs([[xin, C0[1] - 0.55], [xout, C0[1] - 0.55], [xout, C0[1] + 0.55], [xin, C0[1] + 0.55]]) },
    repuxo: { c: q(cp), r: RP, jato: { r: 0.22, h: 1.2 } }, bosquetes: [-2.35, 2.35].map((dz) => ({ c: q([bx, C0[1] + dz]), rx: r4(brx), rz: 0.85 })) };
}
const BOSQ_N = [{ c: [-6.6, -17.3], rx: 2.1, rz: 0.5 }, { c: [6.6, -17.3], rx: 2.1, rz: 0.5 }];

// ---------------------------------------------------------------- 9. linha de luz do acelerador
// rente ao pé da face externa do contorno (0,25 para fora), nunca em miolo, água ou pátio; atravessa o portão como
// faixa embutida no piso. Ordem: colunata oeste, Humanidades, Escola, Onda, Anel da Biblioteca, Elo oeste, crescente,
// Elo leste, Santuário, Elo Norte, Campus Universitário, Vila, colunata leste
const OFF = 0.25;
function concLuz(nome, inverte = false, est = [true, true]) {
  const c = CONC[nome], r = c.R - c.w / 2 - OFF, [A1, A2] = c.A, sg = A2 > A1 ? 1 : -1, dl = deg((OFF + 0.15) / r);
  const pts = arcoP(c.F, r, A1 - sg * dl * (est[0] ? 1 : 0), A2 + sg * dl * (est[1] ? 1 : 0), r, 0.3); return inverte ? pts.reverse() : pts;
}
// arco do círculo (c, r) do ângulo de pIni ao de pFim pelo lado que NÃO passa pela direção foraDe (graus)
function circLuz(c, r, pIni, pFim, foraDe) {
  const a0 = mod(ang(c, pIni), 360), a1_ = mod(ang(c, pFim), 360);
  for (const sent of [1, -1]) {
    let a1 = a1_; if (sent > 0) while (a1 < a0) a1 += 360; else while (a1 > a0) a1 -= 360;
    let passa = false; for (let i = 0; i <= 60; i++) if (Math.abs(mod(foraDe - (a0 + ((a1 - a0) * i) / 60) + 180, 360) - 180) < 2) passa = true;
    if (!passa) return arcoP(c, r, a0, a1, r, 0.3);
  }
  return [];
}
const rc = PR.r + PR.w / 2 + OFF, rg = (k) => GOTA[k].Rm + GOTA[k].w / 2 + OFF, rFis = FI.r + FI.w / 2 + OFF;
const LUZ = (() => {
  const hum = concLuz('humanidades', true), ond = concLuz('onda'), eO = concLuz('eloO', false, [true, false]), eL = concLuz('eloL', true, [true, false]), ueL = concLuz('uniElo', true), cas = concLuz('casas');
  const portao = pol(PC, rc, 90), fd = (k) => mod(GOTA[k].phi, 360);
  const ped = [circLuz(PC, rc, portao, hum[0], 270), hum, circLuz(SAT.SO, rg('SO'), hum[hum.length - 1], ond[0], fd('SO')), ond, circLuz(SAT.NO, rg('NO'), ond[ond.length - 1], eO[0], fd('NO')), eO,
    circLuz(FI.c, rFis, eO[eO.length - 1], eL[0], 90), eL, circLuz(SAT.NE, rg('NE'), eL[eL.length - 1], ueL[0], fd('NE')), ueL, circLuz(SAT.SE, rg('SE'), ueL[ueL.length - 1], cas[0], fd('SE')), cas,
    circLuz(PC, rc, cas[cas.length - 1], portao, 270)];
  const out = []; for (const p of ped) for (const x of p) if (!out.length || dist(out[out.length - 1], x) > 1e-6) out.push(x);
  return reamostra(out, 0.4);
})();
const CLARAB = [pol(PC, rc, 90), pol(FI.c, rFis, 270), ...['onda', 'uniElo'].map((n) => pol(CONC[n].F, CONC[n].R - CONC[n].w / 2 - OFF, (CONC[n].A[0] + CONC[n].A[1]) / 2))].map(q);

// ---------------------------------------------------------------- 10. tapete (clareira da figura) e canteiro
const TAPETE = qs(simplificaLaco(afasta(LUZ, 1.2), 0.25));
export const ANEL_VIARIO = { x0: P.VIA.x0, z0: P.VIA.z0, x1: P.VIA.x1, z1: P.VIA.z1, r: P.VIA.r, w: P.VIA.w };
// retângulo arredondado de centro das curvas afastado m para dentro do eixo da pista (passo em graus nas curvas)
function viaRet(m = 0, passo = 9) {
  const { x0, z0, x1, z1, r } = ANEL_VIARIO, rr = r - m; const out = [];
  for (const [cx, cz, a] of [[x1 - r, z1 - r, 0], [x0 + r, z1 - r, 90], [x0 + r, z0 + r, 180], [x1 - r, z0 + r, 270]]) for (let t = 0; t <= 90; t += passo) out.push(pol([cx, cz], rr, a + t));
  return out;
}
// canteiro (NO, fora da figura): o terreno do pátio de obras recortado a 0,65 da borda da pista e a 0,4 do tapete
// (o maior pedaço, simplificado a 0,15)
const CANT0 = [[-32.3, -31.1], [-17.5, -31.1], [-17.5, -25.0], [-25.2, -24.6], [-30.0, -23.8], [-34.6, -21.6], [-37.3, -21.6], [-37.3, -25.5], [-36.9, -27.3], [-35.7, -28.9], [-34.1, -30.3]];
const CANT = (() => { const c = menos(recorta(CANT0, viaRet(P.VIA.w / 2 + 0.65, 5)), afasta(TAPETE, 0.4)); const s = simplificaLaco(areaSinal(c) > 0 ? c : c.reverse(), 0.15); return qs(areaSinal(s) < 0 ? s : s.reverse()); })();
const LOTES = { escritorio: [-35.6, -24.85], almox: [-19.7, -27.3], usina1: [-30.3, -29.75], usina2: [-27.65, -29.75], usina3: [-25.0, -29.75], carpintaria: [-27.65, -27.3],
  concreto: [-22.35, -29.75], serralheria: [-19.7, -29.75], vidracaria: [-25.0, -27.3], eletrica: [-22.35, -27.3], horto: [-32.95, -27.3], laboratorio: [-30.3, -27.3] };

// ---------------------------------------------------------------- vias do plano e saídas
export const SAIDAS = [                                                // saídas do anel viário até a cidade (eixo da pista -> rua de borda do bairro)
  { id: 'sul', pts: [[0.0001, P.VIA.z1], [0.0001, 30.4]] }, { id: 'norte', pts: [[0.0001, P.VIA.z0], [0.0001, -36.6]] },
  { id: 'leste', pts: [[P.VIA.x1, C[1]], [44.4, C[1]]] }, { id: 'porto', pts: [[P.VIA.x0, C[1]], [fr(-47), C[1]]] },
];
// distância até o eixo do anel viário (para a mata, os carros e a pintura)
export function distAnelViario(x, z) {
  const { x0, z0, x1, z1, r } = ANEL_VIARIO; const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = (x1 - x0) / 2 - r, hz = (z1 - z0) / 2 - r;
  const qx = Math.abs(x - cx) - hx, qz = Math.abs(z - cz) - hz; const fora = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
  return Math.abs(fora - r);
}
// legado: sai na integração (o plano novo não tem avenida nem rotatória; o eixo é A.praca, A.bulevar e A.eixoN)
export const EIXO = { x: 0, meia: 3.2, z0: -8.4, z1: 24.6 };
export const AVENIDA = { z: 1, w: 2.0 };
export const ROTATORIA = { c: [0.0001, 1.0001], r: 3.6, ilha: 2.6 };

// ---------------------------------------------------------------- acelerador (seção 7: ACELERADOR)
export const ACELERADOR = {
  c: POCO.c, rx: POCO.rx, rz: POCO.rz,                                 // o poço (ground.js inPit lê c, rx, rz)
  poco: POCO,                                                          // poço oval de 1,2 de fundo (e1)
  crescente: { c: q(FI.c), r: FI.r, w: FI.w, a0: Math.round(FIS_A[0] * 100) / 100, a1: Math.round(FIS_A[1] * 100) / 100, h: 1.6, caminho: qs(fitaPts(arcoP(FI.c, FI.r, FIS_A[0], FIS_A[1], FI.r, 0.3), FI.c)) }, // Centro de Física (e4)
  luz: qs(LUZ), luzW: 0.22, luzH: 0.03,                                // linha de luz (e2): laço fechado (1º ponto = último, no portão), passo 0,4
  claraboias: CLARAB, claraboiaR: 0.5,                                 // e3: portão, atrás do crescente, fora da Onda e do Elo Norte
  injetor: { pts: [[0.0001, r4(C0[1] - (RZ - W))], [0.0001, EIXO_N.z1]], w: 0.22 },  // e2: reto no piso do eixo norte, da face interna da Sede ao poço
  bosquesN: BOSQ_N,                                                    // e4: bosquetes norte entre a Sede e os braços do Elo
};

// ---------------------------------------------------------------- âncoras de cada conjunto (A)
// Fitas (anel, sede, escola, engenharia, instituto, uni, anelBib, santuario, humanidades, casas, onda, uniElo):
//   { caminho [[x, z]] (linha média, normal [tz, -tx] para fora), L (comprimento), w (largura), o0/o1 (-w/2, +w/2),
//     fh (pé-direito), niveis (da mecânica), extra (andaresExtra no nível máximo), hMax, modulos, cortes? (frações;
//     sem cortes = módulos iguais), aberturas? (índices de cortes), aberturaDe? {corte: largura do vão},
//     ordem? (módulo do jogo -> trecho do caminho), nos? [{ id, c, r, modulo }] (tambores), gap? (vão total entre
//     módulos), meio (ponto do meio), pontas [ini, fim] }
export const A = {
  // ---- Anel Mestre
  // Anel de moradia (8 módulos, pelo sul): caminho de -15,28 a 195,28 graus; cortes no meio de cada vão (ângulos perto
  // de 0, 64, 116 e 180) e nos nós de 30 (tambor SE), 90 (portal) e 150 (tambor SO), que viram aberturas;
  // trechos = [f0, f1] de cada trecho no caminho (já sem os vãos); módulo 0 à esquerda do portal, 1 à direita
  anel: { ...fita('anel', ANEL_E.pts, W, { modulos: 8, ...elipseFita(ANEL_E), ordem: ORDEM_ANEL, nos: [noDe('SO'), noDe('SE')] }), c: C, rx: MX, rz: MZ },
  // Sede da Holding (4 módulos, coroa norte): de 224,72 a 315,28 graus; portal de 3,6 no corte 2 (270); módulo 0 a oeste
  sede: { ...fita('sede', SEDE_E.pts, W, { modulos: 4, ...elipseFita(SEDE_E), nos: [noDe('NO'), noDe('NE')] }), c: C, rx: MX, rz: MZ, repasse: TORRE.repasse, portico: PORTICO },
  // tambores (nós): o mesmo de TAMBOR.nos
  tambores: TAMBOR.nos,
  // portal do Anel (pas_anel): ponte de 2 pavimentos (y0 1,55, topo 2,55) na seção do Anel, entre as pontas dos
  // módulos 0 e 1 (a J delas), sobre 4 pilares nas quinas da boca
  portal: { caminho: PORTAL, w: W, y0: 1.55, topo: 2.55, pilares: [90 - gpA, 90 + gpA].flatMap((a) => [1.3, -1.3].map((o) => q(add(ell(a), normalMed(a), o)))) },
  // ---- folhas (gotas)
  // Escola e Campus para Jovens: a gota SO inteira (3 módulos iguais que sobem juntos)
  escola: { ...fita('escola', fitaPts(GOTA.SO.pts, SAT.SO), GOTA.SO.w, { modulos: 3 }), c: q(SAT.SO) },
  // Universidade (gota SE): Engenharia (rabo norte, 0 a fE), Campus Universitário (uni, 4 módulos no arco externo, com 5
  // torres de 1,0 acima do teto nas frações 'torres' do caminho dele) e Instituto (rabo sul, fI a 1); frações = [fE, fI]
  engenharia: { ...fita('engenharia', ENG, 2.2), dossel: DOSSEL('engenharia', ENG, 'solar') },
  uni: { ...fita('uni', UNI, 2.2, { modulos: 4 }), c: q(SAT.SE), fracoes: [fE, fI].map((f) => Math.round(f * 1e4) / 1e4), torres: UNI_TORRES, torresPts: UNI_TORRES.map((f) => q(noCaminho(UNI, f))), torreR: 0.75, torreTopo: Math.round((ALT.uni.hMax + 1.0) * 100) / 100 },
  instituto: { ...fita('instituto', INST, 2.2), dossel: DOSSEL('instituto', INST, 'verde') },
  // Anel da Biblioteca (gota NO, 3 módulos) e Santuário (gota NE, 5 módulos)
  anelBib: { ...fita('anelBib', fitaPts(GOTA.NO.pts, SAT.NO), GOTA.NO.w, { modulos: 3 }), c: q(SAT.NO) },
  santuario: { ...fita('santuario', fitaPts(GOTA.NE.pts, SAT.NE), GOTA.NE.w, { modulos: 5 }), c: q(SAT.NE) },
  // ---- contorno
  // Humanidades e Artes (braço oeste da praça, 1 módulo): ponta leste em degrau junto à colunata
  humanidades: { ...fita('humanidades', fitaPts(CONC.humanidades.pts, C0), WC.humanidades, { pontaDegrau: { leste: true } }), F: q(CONC.humanidades.F), R: P.RF_S },
  // Vila (braço leste, 6 casas): gap = vão TOTAL entre casas (0,1 de cada lado do corte); ponta oeste em degrau
  casas: { ...fita('casas', VILA, WC.casas, { modulos: 6, gap: 0.2, pontaDegrau: { oeste: true } }), F: q(CONC.casas.F), R: P.RF_S },
  // Ala em Onda (vale oeste) e Elo Norte (vale leste): 2 módulos cada
  onda: { ...fita('onda', fitaPts(CONC.onda.pts, C0), WC.onda, { modulos: 2 }), F: q(CONC.onda.F), R: P.RF_LAT },
  uniElo: { ...fita('uniElo', fitaPts(CONC.uniElo.pts, C0), WC.uniElo, { modulos: 2 }), F: q(CONC.uniElo.F), R: P.RF_LAT },
  // colunata da praça (pas_frente2): arcos O (108 a 250) e L (290 a 432) do círculo c r 4,7; arcada de 1,0 (pilares
  // no térreo, laje de y0 0,45 a 1,0 com floreira e deque no teto)
  colunata: { c: q(PC), r: PR.r, w: PR.w, y0: 0.45, h: 1.0, arcos: COL_A, caminhos: { O: qs(COL.O), L: qs(COL.L) } },
  // Elo do Santuário (pas_elo): braços O e L de fita-ponte (1 pavimento de 0,7 sobre pilares, y0 0,9, topo 1,6) que
  // encostam de lado nas folhas NO e NE e chegam de ponta ao crescente
  eloSant: { w: WC.elo, y0: 0.9, topo: 1.6, caminhos: { O: qs(ELO.eloO), L: qs(ELO.eloL) } },
  // ---- coração
  // lago: 24 pontos da oval (de 15 em 15 graus; a draga da obra e o terreno leem a lista) e, no mesmo array, c, rx, rz
  // e as duas bacias (norte e sul) recortadas pela ilha e pelos diques
  lago: LAGO,
  ilha: { c: C, r: ILHA },
  jardim: JARDIM,                                     // elipse do jardim do miolo (zona sempre ligada)
  lagoDiques: DIQUES,                                 // lago.e3: faixas plantadas de 0,9 (h 0,1) da ilha à face do Anel
  repuxos: Object.values(VALES).map((v) => v.repuxo), // lago.e3: bacias r 1,6 com jato de 1,2 no fim dos canais
  vales: VALES,                                       // lago.e3: canal, repuxo e 2 bosquetes de cada vale
  bosquetes: BOSQ_JARDIM,                             // lago.e2: 4 bosquetes nas diagonais do jardim
  torre: TORRE,
  // pátio da Sede (sedePatio): piscinas com deque, ponte privada (ilha -> margem norte; array com w e h), pavilhão
  // redondo na margem sul (plataforma, salão de vidro e dossel: niveis [raio, y0, y1]), pórtico do portal da Sede e
  // fundações (e1: faixa da Sede, discos dos tambores NO e NE e radier da Torre)
  sedePatio: { piscinas: PISC, pontePrivada: PONTE_PRIV, pavilhao: PAV, portico: PORTICO, fundacoes: [{ c: NOS.NO, r: 3.1 }, { c: NOS.NE, r: 3.1 }, { c: C, r: TORRE.radier }] },
  // ---- miolos
  // Ciências: elipse rx x rz girada rot graus (eixo longo para o tambor SE), proa, altura h; poly = a elipse em 40 pontos
  ciencias: CIEN,
  ponteCoberta: PONTE_COB,                            // tubo de vidro (y0 0,75 a 1,45) da face do tambor SE à proa da Ciências
  // campo da Escola: retângulo w x d em c girado rot graus; gramado r em volta do centro da folha; arquibancada em arco
  // (r0 a r1, a0 a a1 graus) no pescoço; torres de luz (r 0,18, 2,6)
  campo: { ...CAMPO, gramado: { c: q(S_SO), r: GRAMA_R('SO') }, arquibancada: ARQ, torresLuz: TORRES_LUZ, torreLuz: { r: 0.18, h: 2.6 } },
  // gramado do Campus Universitário com a pista oval (r = raio externo, largura w)
  gramadoUni: { c: q(S_SE), r: GRAMA_R('SE'), pista: { c: q(S_SE), r: 4.6, w: 0.55 } },
  // Biblioteca: torre-vaso em escala 1,15 sobre espelho redondo, plinto de pedra; alturas do núcleo, dos pilares e do
  // dossel; crd = direção (graus) do CRD (o setor sem hastes fica voltado para ele)
  biblio: { c: q(S_NO), espelho: { c: q(S_NO), r: 4.4 }, plinto: { c: q(S_NO), r: 2.7 }, escala: 1.15, h: 6.2, dossel: 3.2, nucleo: 2.3, alturas: { nucleo: 4.1, pilares: 5.6, topo: 6.2 },
    niveis: [[2.3, 0, 4.1, 'nucleo'], [0.96, 4.1, 5.6, 'pilares'], [3.2, 5.6, 6.2, 'dossel']],   // [raio, y0, y1]: núcleo, pilares-árvore em V e dossel de vidro
    gramado: { c: q(S_NO), r: GRAMA_R('NO') }, crd: Math.round(deg(Math.atan2(uNO[1], uNO[0])) * 10) / 10 },
  // CRD: leque no eixo da folha NO, de r0 a r1 do centro dela (meias larguras m0 no espelho e m1 no tambor), altura h
  crd: { ...CRD, r0: r4(CRD.r0), r1: r4(CRD.r1), eixo: { c: q(S_NO), dir: [r4(uNO[0]), r4(uNO[1])], ang: Math.round(deg(Math.atan2(uNO[1], uNO[0])) * 10) / 10 }, poly: qs(leque('NO', CRD.r0, CRD.r1, CRD.m0, CRD.m1)),
    c: q(add(S_NO, uNO, (CRD.r0 + CRD.r1) / 2)) },
  // Cúpula da Vida (r 4,8, altura 5,2 com o plinto de 0,5); porta = ponto da casca voltado para a Estufa
  bioma: { c: q(CUP_C), r: 4.8, h: 5.2, plinto: 0.5, porta: q(add(CUP_C, uNE, 4.8)), portaAng: Math.round(aE * 10) / 10 },
  savana: { c: q(CUP_C), r: 4.5, gramado: { c: q(S_NE), r: GRAMA_R('NE') } },  // chão de dentro da Cúpula; gramado do miolo NE
  gorilas: { c: q(EST_C), r: 1.7, h: 2.2, tubo: { pts: [q(GAL_C), q(add(CUP_C, uNE, 4.8))], w: 0.9 } },  // Estufa Anexa (entra 0,35 na Cúpula) e o tubo Galeria -> porta
  galeria: { c: q(GAL_C), r: 1.0, h: 1.5 },           // Galeria de entrada (encosta 0,2 na Estufa)
  trilha: TRILHA,                                     // pas_trilhaBioma: do tambor NE à Galeria
  passeioSant: PASSEIO_S,                             // pas_santuario: r 5,3 em volta da Cúpula, de a0 a a1 graus
  // ---- pátios da boca e eixo
  // Anfiteatro da Vila: ferradura rx x rz (largura w) com degraus de a0 a a1 graus (lado norte), palco e base de grama
  anfiteatro: ANFI,
  // Pátio da Escola (oeste): base de grama, 2 morros (h = altura) e a piscina (deck = folga x e z do deque)
  patios: { escola: { c: q(po), base: { c: q(po), rx: 3.3, rz: 2.3 }, morros: MORROS, piscina: PISCINA_E }, anfiteatro: { c: q(pl), base: ANFI.base }, rampas: HEL },
  // Praça da Entrada: c = centro = [0, 19,8], r = piso dentro da colunata; poly = disco + passagem norte + esplanada +
  // eixo da boca (placa da pavimentação e zona 'praca'); espelho r 1,2 com o Marco; anel de piso r 2,0; 4 canteiros
  praca: { c: q(PC), centro: q(PC), r: R_PRACA, poly: PRACA_POLY, espelho: { c: q(PC), r: 1.2 }, anelPiso: 2.0, marco: { c: q(PC), r: 0.3, h: 2.8 },
    canteiros: [45, 135, 225, 315].map((a) => ({ c: q(pol(PC, 2.95, a)), rx: 0.8, rz: 0.6 })), esplanada: ESPLANADA, eixoBoca: EIXO_BOCA, passoNorte: PASSO_N },
  // anel de piso mais escuro em volta do espelho (linha média r 1,6, largura 0,8), como polilinha fechada
  pracaCaminhos: [Object.assign(qs(arcoP(PC, 1.6, 0, 360, 1.6, 0.4)), { w: 0.8 })],
  lagosPraca: [{ c: q(PC), rx: 1.2, rz: 1.2, rot: 0 }],
  fontes: [-1, 1].map((s) => ({ c: [s * 5.3, 12.6], rx: 1.55, rz: 1.2, jato: { r: 0.25, h: 0.9 } })),   // as 2 fontes da esplanada
  bulevar: { pts: BULEVAR_PTS, w: 1.9 },              // pas_bulevar: [x, z, altura do deque]
  frente: { pts: FRENTE_PTS, w: 1.2, h: 0.04 },       // pas_frente: calçada do portão ao anel de piso da praça
  ponte: { pts: PONTE_PTS, w: 1.6, h: 0.55 },         // pas_ponte: do pavilhão à ilha
  eixoN: EIXO_N,                                      // piso do eixo norte (margem norte -> portal da Sede -> poço)
  bosquesN: BOSQ_N,
  acelerador: ACELERADOR,
  // ---- terreno
  // pátio de obras: poly, c (a obra usa para a direção da entrada), acesso (caminhões, pela pista norte) e os lotes
  // de 2,4 x 2,4 (x, z com fr, r = giro em radianos, como LOTES de canteiro.js)
  canteiro: { poly: CANT, c: [-27.5, -28.4], acesso: [-26.0, -31.75], lotes: Object.fromEntries(Object.entries(LOTES).map(([k, [x, z]]) => [k, { x: fr(x), z: fr(z), r: 0 }])) },
  vias: [],                                           // (abaixo)
  tapete: TAPETE,                                     // clareira da figura: a linha de luz afastada 1,2 para fora
  luz: ACELERADOR.luz,                                // o laço da linha de luz
  semMata: [],                                        // (abaixo)
};
// vias no nível do chão: o anel viário (fechado) e o começo das saídas (o resto, fora da mesa, é malha do plano)
A.vias = [{ id: 'anel', pts: qs(viaRet(0, 9).filter((p, i, l) => !i || dist(p, l[i - 1]) > 1e-6)), w: ANEL_VIARIO.w, fechada: true },
  ...SAIDAS.map((s) => ({ id: 'saida-' + s.id, pts: [[...s.pts[0]], [r4(Math.max(MESA.x0 + 0.05, Math.min(MESA.x1 - 0.05, s.pts[1][0]))), r4(Math.max(MESA.z0 + 0.05, Math.min(MESA.z1 - 0.05, s.pts[1][1])))]], w: ANEL_VIARIO.w }))];
// fitas do plano (nome em A -> caminho(s)), para a pegada sem mata e os testes
export const FITAS = ['anel', 'sede', 'escola', 'engenharia', 'uni', 'instituto', 'anelBib', 'santuario', 'humanidades', 'casas', 'onda', 'uniElo'];
const caminhosDe = () => [...FITAS.map((k) => [A[k].caminho, A[k].w]), [A.colunata.caminhos.O, PR.w], [A.colunata.caminhos.L, PR.w], [A.eloSant.caminhos.O, WC.elo], [A.eloSant.caminhos.L, WC.elo],
  [ACELERADOR.crescente.caminho, FI.w], [A.portal.caminho, W], [PORTICO.caminho, W]];
// onde a mata não nasce: pegadas das fitas (meia largura + 0,3), em polígonos de poucos pontos (passo 1,0); cada
// polígono leva a caixa [x0, z0, x1, z1] para o descarte rápido (todas ficam dentro do tapete, onde já não há mata)
A.semMata = caminhosDe().map(([cam, w]) => { const p = qs(faixaPoly(reamostra(cam, 1.0), w / 2 + 0.3)); const xs = p.map((v) => v[0]), zs = p.map((v) => v[1]); return Object.assign(p, { caixa: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] }); });
// trechos [f0, f1] de uma fita no caminho (sem os vãos), no sentido do caminho: o mesmo recorte da Faixa (aberturas
// abrem aberturaDe[k] / 2 de cada lado do corte k; gap = vão total entre módulos)
export function trechosDe(f) {
  const n = f.modulos || 1, cortes = f.cortes || Array.from({ length: n + 1 }, (_, i) => i / n), ab = new Set(f.aberturas || []), L = f.L; const out = [];
  const g = (k) => (k === 0 || k === cortes.length - 1 ? 0 : ab.has(k) ? (f.aberturaDe?.[k] ?? 1.2) / 2 : (f.gap || 0) / 2);
  for (let i = 0; i < cortes.length - 1; i++) out.push([cortes[i] + g(i) / L, cortes[i + 1] - g(i + 1) / L]);
  return out;
}

// ---------------------------------------------------------------- passarelas e ligações (ids dos projetos: 'pas_' + chave)
// pts [[x, z, altura]]: altura do piso onde se anda (no 'faixa', o teto); w = largura; tipo: 'chao' (piso rente),
// 'deck' (deque elevado), 'faixa' (seção de fita sobre pilares: y0 = base da laje, topo; partes = caminhos de cada
// trecho) ou 'helice' (rampa em espiral: c, r externo, pts da linha média, patamar)
const com = (pts, h) => pts.map(([x, z]) => [x, z, h]);
export const PASSARELAS = {
  frente: { nome: 'Caminho da Frente', tipo: 'chao', pts: FRENTE_PTS, w: 1.2, h: 0.04 },
  bulevar: { nome: 'Bulevar Verde', tipo: 'deck', pts: BULEVAR_PTS, w: 1.9, jardim: true },
  anel: { nome: 'Portal do Anel', tipo: 'faixa', pts: com(PORTAL, 2.55), partes: [PORTAL], w: W, y0: 1.55, topo: 2.55, pilares: A.portal.pilares },
  frente2: { nome: 'Colunata da Praça', tipo: 'faixa', pts: com([...A.colunata.caminhos.O, ...A.colunata.caminhos.L], 1.0), partes: [A.colunata.caminhos.O, A.colunata.caminhos.L], w: PR.w, y0: 0.45, topo: 1.0, c: q(PC), r: PR.r },
  ponte: { nome: 'Passeio da Holding', tipo: 'deck', pts: PONTE_PTS, w: 1.6 },
  caracol: { nome: 'Caracol do Anel', tipo: 'helice', ...HEL.caracol },
  vila: { nome: 'Rampa da Vila', tipo: 'helice', ...HEL.vila },
  trilhaBioma: { nome: 'Trilha da Cúpula', tipo: 'deck', pts: com(TRILHA.pts, 0.6), w: 1.2, dossel: { topo: 1.2 } },
  elo: { nome: 'Elo do Santuário', tipo: 'faixa', pts: com([...A.eloSant.caminhos.O, ...A.eloSant.caminhos.L], 1.6), partes: [A.eloSant.caminhos.O, A.eloSant.caminhos.L], w: WC.elo, y0: 0.9, topo: 1.6 },
  santuario: { nome: 'Passeio do Santuário', tipo: 'chao', pts: com(qs(arcoP(CUP_C, 5.3, PASSEIO_S.a0, PASSEIO_S.a1, 5.3, 0.5)), 0.04), w: 0.45, h: 0.04, c: q(CUP_C), r: 5.3 },
};

// Zonas de chão (pintura do terreno e clareiras da mata): { id, tipo, poly | elipse: [c, rx, rz, rot (rad)], sempre?
// (desde o início), quando? (id da etapa que liga a zona), ate? (etapa que desliga) }. Poucas e grandes: o terreno e a
// mata consultam todas as zonas em cada ponto (o tapete, com ~95 pontos, é o limite).
export const ZONAS = [
  { id: 'tapete', tipo: 'grama', sempre: true, poly: TAPETE },
  { id: 'jardim', tipo: 'grama', sempre: true, claro: true, elipse: [C, JARDIM.rx, JARDIM.rz, 0] },
  { id: 'praca', tipo: 'praca', quando: 'praca.e1', poly: PRACA_POLY },
  { id: 'praca', tipo: 'praca', quando: 'praca.e1', poly: EIXO_N.poly },
  { id: 'escola', tipo: 'grama', quando: 'escola.e2', elipse: [q(po), 3.3, 2.3, 0] },
  { id: 'anfiteatro', tipo: 'grama', quando: 'anfiteatro.e1', elipse: [q(pl), 3.3, 2.3, 0] },
  { id: 'acelerador', tipo: 'terra', ate: 'acelerador.e1', elipse: [POCO.c, 2.6, 2.2, 0] },
  { id: 'acelerador', tipo: 'grama', quando: 'acelerador.e1', elipse: [POCO.c, 2.6, 2.2, 0] },
  { id: 'canteiro', tipo: 'canteiro', poly: CANT },
];
