// Reservatório da Arcologia (lago.e1). No plano A v2, o lago circular com a ilha das torres (montarLagoCircular). Nos
// outros, o espelho d'água na cota do plano e a borda de cada plano: 'degraus' (degraus
// de pedra até a água, Cheonggyecheon e a Ópera de Oslo), 'cais' (muro de cais com pedra de coroamento, as margens do
// canal de Songdo) ou 'pedra' (blocos de arenito desencontrados, o promontório de Barangaroo), sempre com o passeio
// em volta (calçada de pedra e gramado), que cobre a transição do chão cavado. A água tem material próprio: escura,
// com o reflexo do céu e ondulação fina no shader.
//
// A cava entra no chão pelo aplainar (sim.formas, D5): a X1b registra cavaDoPlano() quando lago.e1 começa. As cenas da
// X1a cavam o relevo da própria simulação de prova com cavarTerreno(), do mesmo jeito que o aplainar faria.
import * as THREE from 'three';
import { acab, PADRAO, orientar, tampa, hashF, bloco, caixa, arvore, CASCATA, UNIFORMES } from './torre.js';
import { deslocar, faixaEntre } from './partes.js';
import { pontoNoPoligono, distPoligono } from '../../comum/vetor.js';
import { GEMEAS } from '../../data/arcologia-plano.js';

const K = {
  granito: acab('#77716a', { rugo: 0.6, padrao: PADRAO.pedra }),
  pedra: acab('#a39884', { rugo: 0.72, padrao: PADRAO.pedra }),
  arenito: acab('#b49a76', { rugo: 0.85, padrao: PADRAO.pedra }),
  arenitoEscuro: acab('#8e7a5f', { rugo: 0.85, padrao: PADRAO.pedra }),
  piso: acab('#948b7e', { rugo: 0.8, padrao: PADRAO.piso }),
  concreto: acab('#9b968d', { rugo: 0.8 }),
  fundo: acab('#3b4540', { rugo: 0.9 }),
  // o gramado da margem no tom dos parques do plano (planos.js)
  grama: acab('#5b6a3a', { rugo: 0.95, padrao: PADRAO.grama }),
};

/** Passeio em volta do reservatório (m, do fio d'água para fora), largo o bastante para cobrir a borda da cava. */
export const PASSEIO = 26;

/** Calçada de pedra junto da borda; o resto do passeio é gramado. */
const CALCADA = 9;

/** Paredes verticais ao longo de um contorno (normal para dentro da água quando agua = true). */
function muro(m, poly, y0, y1, k, paraAgua = true) {
  const n = poly.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    let ax = poly[2 * i], az = poly[2 * i + 1], bx = poly[2 * j], bz = poly[2 * j + 1];
    const l = Math.hypot(bx - ax, bz - az);
    if (l < 1e-6) continue;
    // contorno positivo: a normal (dz, -dx) aponta para fora; o muro do cais olha para a água (para dentro)
    let nn = [(bz - az) / l, 0, -(bx - ax) / l];
    if (paraAgua) nn = nn.map((v) => -v);
    m.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], nn, [0, y0], [l, y0], [l, y1], [0, y1], k);
  }
}

/**
 * Margem: a calçada de pedra junto da água (de ant, a d0 metros do fio, até d0 + CALCADA) e o gramado até o fim do
 * passeio. Os 26 m todos em pedra clara liam, do alto, como a borda de uma piscina ou de uma vala de concreto.
 */
function margem(opaco, C, ant, d0, topo) {
  const meio = deslocar(C, d0 + CALCADA);
  faixaEntre(opaco, ant, meio, topo, K.piso, true);
  faixaEntre(opaco, meio, deslocar(C, PASSEIO), topo, K.grama, true);
}

/**
 * Monta o reservatório de uma peça { contorno, nivel, fundo, borda } com a gleba na cota dada.
 * @param {{ opaco: import('./torre.js').Malha, agua: import('./torre.js').Malha, cota: number }} d
 * @returns {{ caixa: number[], nivel: number }}
 */
export function montarReservatorio(peca, { opaco, agua, cota }) {
  const C = orientar(peca.contorno);
  const nivel = cota + peca.nivel;
  const fundo = cota + peca.fundo;
  const topo = cota + 0.2;
  // espelho d'água um pouco além do fio (a borda cobre)
  tampa(agua, deslocar(C, 0.6), nivel, [0, 0, 0, 0], true);
  // leito (visto pela água nos ângulos baixos)
  tampa(opaco, C, fundo, K.fundo, true);
  if (peca.borda === 'degraus') {
    // 5 degraus de 1,6 m do fio d'água até o passeio
    const n = 5;
    let ant = C;
    let yAnt = nivel + 0.45;
    muro(opaco, C, fundo, yAnt, K.pedra);
    for (let i = 1; i <= n; i++) {
      const R = deslocar(C, 1.6 * i);
      const y = nivel + 0.45 + ((topo - nivel - 0.45) * i) / n;
      faixaEntre(opaco, ant, R, yAnt, K.pedra, true);
      muro(opaco, R, yAnt, y, K.pedra);
      ant = R;
      yAnt = y;
    }
    margem(opaco, C, ant, 1.6 * n, topo);
  } else if (peca.borda === 'cais') {
    muro(opaco, C, fundo, topo + 0.35, K.granito);
    const cor = deslocar(C, 0.9);
    faixaEntre(opaco, C, cor, topo + 0.35, K.granito, true);
    muro(opaco, cor, topo, topo + 0.35, K.granito, false);
    margem(opaco, C, cor, 0.9, topo);
  } else {
    // pedra: blocos de arenito de alturas desencontradas em 3 fiadas (o promontório de Barangaroo)
    let ant = C;
    let yAnt = nivel + 0.3;
    muro(opaco, C, fundo, yAnt, K.arenitoEscuro);
    const n = C.length / 2;
    for (let f = 1; f <= 3; f++) {
      const R = deslocar(C, 2.6 * f);
      const yBase = nivel + 0.3 + ((topo - nivel - 0.3) * f) / 3;
      // cada segmento do contorno vira um bloco com altura própria
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const h = yBase + (hashF(i, f, 71) - 0.5) * 0.9;
        const k = hashF(i, f, 5) < 0.5 ? K.arenito : K.arenitoEscuro;
        const q = [ant[2 * i], ant[2 * i + 1], ant[2 * j], ant[2 * j + 1], R[2 * j], R[2 * j + 1], R[2 * i], R[2 * i + 1]];
        opaco.quad([q[0], h, q[1]], [q[2], h, q[3]], [q[4], h, q[5]], [q[6], h, q[7]], [0, 1, 0], [q[0], q[1]], [q[2], q[3]], [q[4], q[5]], [q[6], q[7]], k);
        const l = Math.hypot(q[2] - q[0], q[3] - q[1]) || 1;
        const nn = [-(q[3] - q[1]) / l, 0, (q[2] - q[0]) / l];
        opaco.quad([q[0], yAnt - 0.6, q[1]], [q[2], yAnt - 0.6, q[3]], [q[2], h, q[3]], [q[0], h, q[1]], nn, [0, 0], [l, 0], [l, 1], [0, 1], k);
      }
      ant = R;
      yAnt = yBase;
    }
    margem(opaco, C, ant, 2.6 * 3, topo);
  }
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < C.length; i += 2) {
    x0 = Math.min(x0, C[i]);
    x1 = Math.max(x1, C[i]);
    z0 = Math.min(z0, C[i + 1]);
    z1 = Math.max(z1, C[i + 1]);
  }
  return { caixa: [x0, fundo, z0, x1, topo, z1], nivel };
}

/**
 * Cava o relevo da simulação de prova como o aplainar faria (D5): dentro do contorno e numa faixa plana de 8 m além
 * dele o chão vai ao leito; depois, smoothstep de 16 m até o chão original. Muda T.altura no lugar e devolve o
 * retângulo sujo [x0, z0, x1, z1] (quem chama marca no diário). guarda recebe as alturas originais para desfazer.
 */
export function cavarTerreno(T, peca, cota, guarda = null) {
  const C = orientar(peca.contorno);
  const leito = cota + peca.fundo;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < C.length; i += 2) {
    x0 = Math.min(x0, C[i]);
    x1 = Math.max(x1, C[i]);
    z0 = Math.min(z0, C[i + 1]);
    z1 = Math.max(z1, C[i + 1]);
  }
  const m = 8 + 16 + T.passo;
  const i0 = Math.max(0, Math.floor((x0 - m - T.origem[0]) / T.passo));
  const i1 = Math.min(T.n - 1, Math.ceil((x1 + m - T.origem[0]) / T.passo));
  const j0 = Math.max(0, Math.floor((z0 - m - T.origem[1]) / T.passo));
  const j1 = Math.min(T.n - 1, Math.ceil((z1 + m - T.origem[1]) / T.passo));
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const x = T.origem[0] + i * T.passo;
      const z = T.origem[1] + j * T.passo;
      const dentro = pontoNoPoligono(x, z, C);
      const d = dentro ? 0 : distPoligono(x, z, C);
      if (d > 24) continue;
      const k = j * T.n + i;
      if (guarda && !guarda.has(k)) guarda.set(k, T.altura[k]);
      const t = d <= 8 ? 0 : (d - 8) / 16;
      const s = t * t * (3 - 2 * t);
      const h = leito + (T.altura[k] - leito) * s;
      if (h < T.altura[k]) T.altura[k] = h;
    }
  }
  return [x0 - m, z0 - m, x1 + m, z1 + m];
}

/**
 * Cava o reservatório de um plano na simulação de uma cena e marca o chão no diário (desfaz a cava anterior que a
 * mesma guarda tiver). estado = { guarda: Map, ret: [x0, z0, x1, z1] | null }.
 */
export function cavarPlanoNaCena(ctx, plano, cota, estado) {
  const T = ctx.sim?.espelho?.terreno;
  if (!T) return;
  if (estado.guarda.size) {
    descavar(T, estado.guarda);
    if (estado.ret) ctx.sim.mudancas.marcarRet('terreno', ...estado.ret);
  }
  const res = plano.partes.find((p) => p.id === 'lago').pecas.find((p) => p.tipo === 'reservatorio');
  estado.ret = cavarTerreno(T, res, cota, estado.guarda);
  ctx.sim.mudancas.marcarRet('terreno', ...estado.ret);
}

/** Desfaz uma cava (as alturas guardadas por cavarTerreno). */
export function descavar(T, guarda) {
  for (const [k, h] of guarda) T.altura[k] = h;
  guarda.clear();
}


// ------------------------------------------------------------------------------------------------ lago da sede v2

const KL = {
  seixo: acab('#8a8171', { rugo: 0.9, padrao: PADRAO.pedra }),
  pedraRio: acab('#77705f', { rugo: 0.85 }),
  junco: acab('#4b5a31', { rugo: 0.95, padrao: PADRAO.folha }),
  degrau: acab('#b9ad96', { rugo: 0.72, padrao: PADRAO.pedra }),
  pisoIlha: acab('#a9a08f', { rugo: 0.78, padrao: PADRAO.piso }),
};

/** Elipse (pares, sentido positivo) de semi-eixos a e b em n pontos, centrada em (cx, cz). */
function elipseEm(cx, cz, a, b, n, a0 = 0) {
  const P = [];
  for (let i = 0; i < n; i++) {
    const t = a0 + (i / n) * Math.PI * 2;
    P.push(cx + a * Math.cos(t), cz + b * Math.sin(t));
  }
  return P;
}

/** Pedra de margem: icosaedro achatado e mexido, meio enterrado. */
function pedraDeMargem(m, x, y, z, r, sem) {
  const f = (1 + Math.sqrt(5)) / 2;
  const V = [[-1, f, 0], [1, f, 0], [-1, -f, 0], [1, -f, 0], [0, -1, f], [0, 1, f], [0, -1, -f], [0, 1, -f], [f, 0, -1], [f, 0, 1], [-f, 0, -1], [-f, 0, 1]];
  const T = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const k = hashF(sem, 3) < 0.5 ? KL.pedraRio : KL.seixo;
  const base = m.vertices;
  V.forEach((p, i) => {
    const l = Math.hypot(...p);
    const j = 0.75 + 0.45 * hashF(sem, i);
    const nx = p[0] / l, ny = p[1] / l, nz = p[2] / l;
    m.v(x + nx * r * j * 1.2, y + ny * r * j * 0.55, z + nz * r * j, nx, ny, nz, x + nx * r, z + nz * r, k);
  });
  for (const [a, b, c] of T) m.tri(base + a, base + b, base + c);
}

/**
 * Lago circular da sede v2 (D63): 270 m com a ilha das torres no meio. A margem de fora é natural (seixos, pedras e
 * juncos na beira, o gramado subindo até o parque), a da ilha é de pedra em degraus (a promenade do lago do Burj
 * Khalifa). Na ilha: o piso de pedra, as palmeiras em volta, o poço na base da fenda das torres (água parada até a
 * cachoeira existir) e a escada d'água que leva o transbordo do poço ao lago, para o sul (GEMEAS).
 * @param {{ opaco: Malha, agua: Malha, efeitos?: Malha, arvores?: Malha, cota: number, lod?: 0 | 1 }} d
 * @returns {{ caixa: number[], nivel: number }}
 */
export function montarLagoCircular(peca, { opaco, agua, efeitos = null, arvores = null, cota, lod = 1 }) {
  const { cx, cz, raio, ilha } = peca;
  const nivel = cota + peca.nivel;
  const fundo = cota + peca.fundo;
  const topo = cota + 0.2;
  const n = lod === 0 ? 144 : 96;
  const fora = elipseEm(cx, cz, raio + 0.8, raio + 0.8, n);
  const beiraIlha = elipseEm(cx, cz, ilha.rx - 0.6, ilha.rz - 0.6, n);
  // espelho d'água (anel entre a margem e a ilha) e o leito
  faixaEntre(agua, beiraIlha, fora, nivel, [0, 0, 0, 0], true);
  faixaEntre(opaco, elipseEm(cx, cz, ilha.rx, ilha.rz, n), elipseEm(cx, cz, raio, raio, n), fundo, K.fundo, true);

  // margem natural: a beira varia uns metros (não é um círculo de piscina), seixos até a água e o gramado subindo
  const beira = [];
  const meio = [];
  const cima = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const w = 1.6 * Math.sin(t * 7 + 0.6) + 1.1 * Math.sin(t * 13 + 2.1) + 0.7 * (hashF(i, 5) - 0.5);
    const r0 = raio - 0.4;
    const r1 = raio + 3.5 + w;
    const r2 = raio + 9 + 0.6 * w;
    beira.push(cx + r0 * Math.cos(t), cz + r0 * Math.sin(t));
    meio.push(cx + r1 * Math.cos(t), cz + r1 * Math.sin(t));
    cima.push(cx + r2 * Math.cos(t), cz + r2 * Math.sin(t));
  }
  muro(opaco, beira, fundo, nivel - 0.3, K.fundo, true);
  faixaEntre(opaco, beira, meio, nivel - 0.3, KL.seixo, true, nivel + 0.35);
  faixaEntre(opaco, meio, cima, nivel + 0.35, K.grama, true, topo);
  faixaEntre(opaco, cima, elipseEm(cx, cz, raio + PASSEIO, raio + PASSEIO, n), topo, K.grama, true);
  // pedras na beira e moitas de junco
  const nP = lod === 0 ? 70 : 36;
  for (let i = 0; i < nP; i++) {
    const t = ((i + hashF(i, 9) * 0.6) / nP) * Math.PI * 2;
    const r = raio + 1.2 + 2.2 * hashF(i, 11);
    pedraDeMargem(opaco, cx + r * Math.cos(t), nivel - 0.25, cz + r * Math.sin(t), 0.5 + 0.8 * hashF(i, 12), i * 7 + 3);
    if (arvores && hashF(i, 13) < 0.45) {
      const rj = raio + 0.4 + 1.2 * hashF(i, 14);
      const tj = t + 0.04;
      arvore(arvores, cx + rj * Math.cos(tj), nivel, cz + rj * Math.sin(tj), { altura: 1.6, raio: 1.3, semente: 5000 + i, detalhe: 0 });
    }
  }

  // ilha: muro de pedra do leito até a água e cinco degraus de 1,6 m até o piso; a escada d'água corta os degraus
  // no sul (a fenda das torres, x de -5 a 5 no espaço do par)
  const G = GEMEAS;
  const xc = G.poco.x;
  const naEscada = (x, z) => Math.abs(x - cx) < xc + 0.5 && z > cz;
  const aneis = [];
  for (let i = 0; i <= 5; i++) aneis.push(elipseEm(cx, cz, ilha.rx - 1.6 * i, ilha.rz - 1.6 * i, n));
  const ilhaBase = aneis[0];
  muro(opaco, ilhaBase, fundo, nivel + 0.45, KL.degrau, false);
  let yAnt = nivel + 0.45;
  for (let i = 1; i <= 5; i++) {
    const y = nivel + 0.45 + ((topo - nivel - 0.45) * i) / 5;
    const A = aneis[i - 1];
    const B = aneis[i];
    for (let s = 0; s < n; s++) {
      const q = (s + 1) % n;
      if (naEscada((A[2 * s] + A[2 * q]) / 2, (A[2 * s + 1] + A[2 * q + 1]) / 2)) continue;
      opaco.quad([A[2 * s], yAnt, A[2 * s + 1]], [A[2 * q], yAnt, A[2 * q + 1]], [B[2 * q], yAnt, B[2 * q + 1]], [B[2 * s], yAnt, B[2 * s + 1]], [0, 1, 0], [A[2 * s], A[2 * s + 1]], [A[2 * q], A[2 * q + 1]], [B[2 * q], B[2 * q + 1]], [B[2 * s], B[2 * s + 1]], KL.degrau);
      // espelho do degrau, virado para a água (para fora da ilha)
      const l = Math.hypot(B[2 * q] - B[2 * s], B[2 * q + 1] - B[2 * s + 1]) || 1;
      const nn = [(B[2 * q + 1] - B[2 * s + 1]) / l, 0, -(B[2 * q] - B[2 * s]) / l];
      opaco.quad([B[2 * s], yAnt, B[2 * s + 1]], [B[2 * q], yAnt, B[2 * q + 1]], [B[2 * q], y, B[2 * q + 1]], [B[2 * s], y, B[2 * s + 1]], nn, [0, yAnt], [l, yAnt], [l, y], [0, y], KL.degrau);
    }
    yAnt = y;
  }
  // piso da ilha com o corte do poço e da escada (do norte do poço até a borda sul)
  {
    const rz = ilha.rz - 8;
    const rx = ilha.rx - 8;
    const zCorte = cz + rz * Math.sqrt(Math.max(0, 1 - (xc / rx) ** 2));
    const P = [];
    const t0 = Math.atan2((zCorte - cz) / rz, xc / rx);
    const t1 = Math.PI - t0;
    // da borda sul em x = +5, pelo leste, norte e oeste, até x = -5; desce o corte até o norte do poço e volta
    const m = n;
    for (let i = 0; i <= m; i++) {
      const t = t0 - ((2 * Math.PI - (t1 - t0)) * i) / m;
      P.push(cx + rx * Math.cos(t), cz + rz * Math.sin(t));
    }
    P.push(cx - xc, cz + G.poco.z0, cx + xc, cz + G.poco.z0);
    tampa(opaco, P, topo, KL.pisoIlha, true);
  }
  // o poço: fundo de pedra escura, o muro do norte e a água parada (a cachoeira vem com as torres)
  const yPoco = cota + G.poco.nivel;
  const yFundoPoco = cota + G.poco.fundo;
  const zp0 = cz + G.poco.z0;
  const zp1 = cz + G.poco.z1;
  bloco(opaco, cx - xc, yFundoPoco - 0.3, zp0, cx + xc, yFundoPoco, zp1, K.fundo, { lados: false });
  caixa(opaco, cx, zp0 - 0.4, xc, 0.4, yFundoPoco, topo + 0.6, K.granito, { ux: 1, uz: 0 });
  agua.quad([cx - xc, yPoco, zp0], [cx + xc, yPoco, zp0], [cx + xc, yPoco, zp1], [cx - xc, yPoco, zp1], [0, 1, 0], [0, 0], [1, 0], [1, 1], [0, 1], [0, 0, 0, 0]);
  // a escada d'água: sete degraus rasos do poço ao lago, com os muretes de pedra dos lados e a película de água
  const E = G.escada;
  const nD = E.degraus;
  for (let d = 0; d < nD; d++) {
    const z0 = cz + E.z0 + ((E.z1 - E.z0) * d) / nD;
    const z1 = cz + E.z0 + ((E.z1 - E.z0) * (d + 1)) / nD;
    const y = yPoco - 0.15 - ((yPoco - 0.15 - (nivel + 0.05)) * (d + 1)) / nD;
    bloco(opaco, cx - xc, fundo, z0, cx + xc, y, z1, KL.degrau, { lados: d === nD - 1 ? K.granito : false, topo: true });
    if (efeitos) {
      efeitos.quad([cx - xc + 0.3, y + 0.06, z0], [cx + xc - 0.3, y + 0.06, z0], [cx + xc - 0.3, y + 0.06, z1], [cx - xc + 0.3, y + 0.06, z1], [0, 1, 0], [-xc, d], [xc, d], [xc, d + 1], [-xc, d + 1], [CASCATA.escada, d * 0.13, 0, 0]);
      // o espelho do degrau: a água cai por ele
      efeitos.quad([cx - xc + 0.3, y + 0.06, z1], [cx + xc - 0.3, y + 0.06, z1], [cx + xc - 0.3, y - 0.2, z1 + 0.05], [cx - xc + 0.3, y - 0.2, z1 + 0.05], [0, 0.3, 1], [-xc, d + 0.9], [xc, d + 0.9], [xc, d + 1], [-xc, d + 1], [CASCATA.escada, d * 0.13, 0, 0]);
    }
  }
  for (const s of [-1, 1]) bloco(opaco, cx + s * (xc + 0.5) - 0.5, nivel - 0.5, cz + G.poco.z1, cx + s * (xc + 0.5) + 0.5, topo + 0.7, cz + E.z1, K.granito);
  // palmeiras-imperiais em volta, fora dos pódios das torres e do corte da escada
  if (arvores) {
    const rx = ilha.rx - 12;
    const rz = ilha.rz - 12;
    const nPal = lod === 0 ? 40 : 24;
    for (let i = 0; i < nPal; i++) {
      const t = (i / nPal) * Math.PI * 2 + 0.05;
      const x = cx + rx * Math.cos(t);
      const z = cz + rz * Math.sin(t);
      if (Math.abs(z - cz) < 31 && Math.abs(x - cx) < 74) continue;
      if (naEscada(x, z) || Math.abs(x - cx) < xc + 3) continue;
      arvore(arvores, x, topo, z, { tipo: 'palmeira', altura: 18 + 4 * hashF(i, 31), raio: 3.4, semente: 6000 + i, detalhe: lod === 0 ? 1 : 0 });
    }
  }
  const r = raio + PASSEIO;
  return { caixa: [cx - r, fundo, cz - r, cx + r, topo, cz + r], nivel };
}

// ------------------------------------------------------------------------------------------------ água

const U_AGUA = { uTempoAgua: { value: 0 } };

/** Material da água do reservatório: escura, reflexo do céu (Fresnel) e ondulação fina pelo mundo. */
export function materialAgua(ganchos) {
  // corpo verde-azulado de água limpa com 6 a 8 m de fundo (o reservatório de Marina Bay), e o céu pelo Fresnel
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.02, 0.052, 0.05), roughness: 0.06, metalness: 0, envMapIntensity: 1.0 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U_AGUA, { uNoite: UNIFORMES.uNoite });
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTempoAgua;\nuniform float uNoite;')
      // à noite o céu refletido quase some (a água escura, com o brilho das luzes em volta), como um lago de verdade
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectSpecular *= mix( 1.0, 0.35, uNoite );')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
{
  vec2 p = vGPosMundo.xz;
  float t = uTempoAgua;
  vec2 g = vec2( cos( p.x * 0.21 + t * 0.9 ) * 0.5 + cos( ( p.x + p.y ) * 0.47 - t * 1.3 ) * 0.35 + cos( p.x * 1.3 + p.y * 0.7 + t * 2.1 ) * 0.15,
                 cos( p.y * 0.19 - t * 0.8 ) * 0.5 + cos( ( p.y - p.x ) * 0.43 + t * 1.1 ) * 0.35 + cos( p.y * 1.1 - p.x * 0.9 + t * 1.9 ) * 0.15 );
  vec3 nMundo = normalize( vec3( -g.x * 0.045, 1.0, -g.y * 0.045 ) );
  normal = normalize( ( viewMatrix * vec4( nMundo, 0.0 ) ).xyz );
}`,
      );
  };
  mat.customProgramCacheKey = () => 'arcologia-agua-1';
  mat.name = 'arcologia:agua';
  return ganchos.aplicar(mat, ['sombra', 'neblina']);
}

/** Atualiza o tempo da ondulação (a volta de 2 h mantém a precisão do float sem o salto da onda a cada 16 min). */
export function quadroAgua(tMs) {
  U_AGUA.uTempoAgua.value = (tMs / 1000) % 7200;
}


export function registrar() {}
