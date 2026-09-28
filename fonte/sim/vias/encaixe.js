// Encaixe da via (D18), num lugar só (dona: S1b): nó existente, portão da gleba, ponto sobre aresta, ângulo (90, 45 e
// múltiplos de 15 graus em relação à via de onde parte) e prolongamento dela, distância de quadra (paralela à via
// vizinha a uma ou duas quadras de 6 células), passo de 15 graus sem outra referência e comprimento múltiplo de 8 m.
// A UI manda os pontos em metros e a tolerância já convertida do polegar; o que volta é o ponto encaixado, a âncora
// (nó, aresta ou portão) e a lista de encaixes e guias para os chips e as linhas tracejadas. Puro: não muda o estado.
import { maisPerto, direcao } from '../../comum/bezier.js';
import { atan2, cos, sen, hipot, clamp } from '../../comum/util.js';
import { refDe } from '../../contratos/espelho.js';
import { REGRAS_VIAS, GRADE_EIXOS } from '../../data/vias.js';
import { tipoVia, eixoDa, distEixo, arestaIntocavel, noLigavel, portaoPerto, saidaDoNo, MEIA_MAX } from './validar.js';

const RAD = Math.PI / 180;
const MP = { t: 0, d: 0, x: 0, z: 0 };
const DE = { d: 0, s: 0 };

/** Ângulo em (-180, 180] graus. */
const embrulhar = (g) => {
  let a = g % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
};

/**
 * Âncora de um ponto: nó existente (ou portão) a menos de `tolNo`, senão ponto sobre uma aresta a menos de meia largura
 * mais `tol` do eixo. Arestas da rodovia, de ponte e da Arcologia não recebem vias; nós delas só os que noLigavel deixa.
 * @returns {{ x, z, ancora: { tipo: 'no', no } | { tipo: 'portao', id } | { tipo: 'aresta', e, t } | null, encaixe: object | null }}
 */
export function ancorar(sim, x, z, { tol = REGRAS_VIAS.tolerancia, tolNo = tol } = {}) {
  const G = sim.grafo;
  const N = sim.tabelas.nos;
  const A = sim.tabelas.arestas;
  // nó existente
  const r = G.gradeNos.maisPerto(x, z, tolNo, (i) => (N.viva[i] && noLigavel(sim, i) ? hipot(N.x[i] - x, N.z[i] - z) : Infinity));
  if (r) {
    const i = r.id;
    return { x: N.x[i], z: N.z[i], ancora: { tipo: 'no', no: i }, encaixe: { tipo: 'no', valor: refDe(i, N.ger[i]) } };
  }
  // portão da gleba (vira nó quando a via chega)
  const p = portaoPerto(sim, x, z, tolNo);
  if (p) return { x: p.x, z: p.z, ancora: { tipo: 'portao', id: p.id }, encaixe: { tipo: 'no', valor: -1, portao: p.id } };
  // ponto sobre aresta
  const raio = tol + MEIA_MAX;
  const ids = G.gradeArestas.consultar(x - raio, z - raio, x + raio, z + raio);
  let melhor = -1;
  let md = Infinity;
  let mt = 0;
  let mx = 0;
  let mz = 0;
  for (let k = 0; k < ids.length; k++) {
    const e = ids[k];
    if (!A.viva[e] || arestaIntocavel(sim, e)) continue;
    const meia = tipoVia(A.tipo[e]).largura / 2;
    maisPerto(A.p, x, z, 8 * e, MP);
    if (MP.d > meia + tol) continue;
    const d = MP.d - meia;
    if (d < md) {
      md = d;
      melhor = e;
      mt = MP.t;
      mx = MP.x;
      mz = MP.z;
    }
  }
  if (melhor >= 0) {
    // perto de uma ponta, o ponto cai no nó dela (senão sobraria um trecho curto)
    const c = eixoDa(sim, melhor);
    distEixo(c, mx, mz, DE);
    const lim = REGRAS_VIAS.noNoCruzamento;
    const ponta = DE.s < lim ? A.a[melhor] : c.comp - DE.s < lim ? A.b[melhor] : -1;
    if (ponta >= 0 && noLigavel(sim, ponta)) {
      return { x: N.x[ponta], z: N.z[ponta], ancora: { tipo: 'no', no: ponta }, encaixe: { tipo: 'no', valor: refDe(ponta, N.ger[ponta]) } };
    }
    if (ponta < 0) {
      return { x: mx, z: mz, ancora: { tipo: 'aresta', e: melhor, t: mt }, encaixe: { tipo: 'aresta', valor: refDe(melhor, A.ger[melhor]) } };
    }
  }
  return { x, z, ancora: null, encaixe: null };
}

/**
 * Direções de referência para os ângulos a partir de uma âncora: [{ dx, dz, continua }]. Num nó de uma via só vale a
 * continuação dela (ângulo 0 é o prolongamento); num nó com várias, cada saída; numa aresta, a tangente no ponto.
 */
export function referencias(sim, ancora) {
  const out = [];
  if (!ancora) return out;
  if (ancora.tipo === 'no') {
    const n = ancora.no;
    const L = sim.tabelas.nos.lig;
    const A = sim.tabelas.arestas;
    const lig = [];
    for (let k = 0; k < 6; k++) if (L[6 * n + k] >= 0 && A.viva[L[6 * n + k]]) lig.push(L[6 * n + k]);
    const d = [0, 0];
    for (const e of lig) {
      saidaDoNo(sim, e, n, d);
      if (lig.length === 1) out.push({ dx: -d[0], dz: -d[1], continua: true });
      else out.push({ dx: d[0], dz: d[1], continua: false });
    }
  } else if (ancora.tipo === 'aresta') {
    const d = direcao(sim.tabelas.arestas.p, ancora.t, [0, 0], 8 * ancora.e);
    out.push({ dx: d[0], dz: d[1], continua: false });
  }
  return out;
}

/**
 * Encaixe de direção de A para B: ângulo em relação às referências (múltiplos de 15 graus com folga de 3; 0 é
 * prolongamento só na continuação) ou, sem referência encaixada, o passo de 15 graus do rumo.
 * @returns {{ ang: number, tipo: string | null, valor: number, ref: object | null }}  ang em radianos (atan2(dz, dx))
 */
export function encaixarDirecao(refs, ax, az, bx, bz) {
  const bruto = atan2(bz - az, bx - ax);
  const folga = REGRAS_VIAS.folgaAngulo;
  const passo = REGRAS_VIAS.passoAngulo;
  let melhor = null;
  for (const r of refs) {
    // ângulo de (dx, dz) medido de +x para +z (o mesmo de `bruto`)
    const angRef = atan2(r.dz, r.dx);
    const rel = embrulhar((bruto - angRef) / RAD);
    const alvo = Math.round(rel / passo) * passo;
    const dif = Math.abs(rel - alvo);
    if (dif > folga) continue;
    if (!r.continua && Math.abs(embrulhar(alvo)) < 1e-9) continue; // ao longo de uma via que já existe
    if (!r.continua && Math.abs(Math.abs(embrulhar(alvo)) - 180) < 1e-9) continue;
    // prefere o ângulo mais redondo (90, depois 45, depois 15) e, no empate, a menor diferença
    const peso = alvo % 90 === 0 ? 0 : alvo % 45 === 0 ? 1 : 2;
    if (!melhor || peso < melhor.peso || (peso === melhor.peso && dif < melhor.dif)) {
      // valor: na continuação, o desvio (0 é prolongamento); numa via que segue, o ângulo com ela (de 0 a 90)
      const a = Math.abs(embrulhar(alvo));
      const valor = Math.round(r.continua ? a : a > 90 ? 180 - a : a);
      melhor = { ang: angRef + alvo * RAD, tipo: r.continua && a < 1e-9 ? 'prolongamento' : 'angulo', valor, ref: r, peso, dif };
    }
  }
  if (melhor) return melhor;
  if (!refs.length) {
    const graus = bruto / RAD;
    const alvo = Math.round(graus / passo) * passo;
    if (Math.abs(graus - alvo) <= folga) {
      const rumo = (((alvo + 90) % 360) + 360) % 360; // rumo a partir do norte (-z), no sentido do relógio visto de cima
      return { ang: alvo * RAD, tipo: 'passo', valor: rumo, ref: null };
    }
  }
  return { ang: bruto, tipo: null, valor: 0, ref: null };
}

/**
 * Guias de quadra perto de B: retas paralelas às vias vizinhas a meia largura dela + 48 m (um bloco) ou + 96 m (uma
 * quadra de dois blocos) + meia largura da via nova. Com direção fixa (ang), B anda no raio de A; sem ela, B cai na
 * paralela. Devolve { x, z, valor, guia } ou null.
 */
export function encaixarQuadra(sim, ax, az, bx, bz, { tol, meiaNova, ang = null, ignorar = null }) {
  const G = sim.grafo;
  const A = sim.tabelas.arestas;
  const R = REGRAS_VIAS.alcanceGuias;
  const ids = G.gradeArestas.consultar(bx - R, bz - R, bx + R, bz + R);
  const ux = ang === null ? 0 : cos(ang);
  const uz = ang === null ? 0 : sen(ang);
  let melhor = null;
  for (let k = 0; k < ids.length; k++) {
    const e = ids[k];
    if (!A.viva[e] || (ignorar && ignorar.has(e))) continue;
    const tipo = tipoVia(A.tipo[e]);
    if (!tipo.zona) continue;
    const c = eixoDa(sim, e);
    distEixo(c, bx, bz, DE, R);
    if (!(DE.d < R)) continue;
    // reta tangente no ponto mais perto
    const j = Math.min(c.n - 1, Math.max(0, Math.floor((DE.s / (c.comp || 1)) * c.n)));
    let tx = c.pts[2 * j + 2] - c.pts[2 * j];
    let tz = c.pts[2 * j + 3] - c.pts[2 * j + 1];
    const lt = hipot(tx, tz) || 1;
    tx /= lt;
    tz /= lt;
    const qx = c.pts[2 * j];
    const qz = c.pts[2 * j + 1];
    // lado de B e distância com sinal à reta
    let nx = -tz;
    let nz = tx;
    let dist = (bx - qx) * nx + (bz - qz) * nz;
    if (dist < 0) {
      nx = -nx;
      nz = -nz;
      dist = -dist;
    }
    for (const blocos of [2, 1]) {
      const alvo = tipo.largura / 2 + blocos * REGRAS_VIAS.fundoZona + meiaNova;
      if (Math.abs(dist - alvo) > tol) continue;
      let x;
      let z;
      if (ang !== null) {
        // B = A + lambda u com distância alvo à reta
        const den = ux * nx + uz * nz;
        if (Math.abs(den) < 0.2) continue; // quase paralelo à guia: não encaixa
        const da = (ax - qx) * nx + (az - qz) * nz;
        const lambda = (alvo - da) / den;
        if (lambda <= REGRAS_VIAS.compMinTracado) continue;
        x = ax + ux * lambda;
        z = az + uz * lambda;
        if (hipot(x - bx, z - bz) > tol + REGRAS_VIAS.passoComprimento) continue;
      } else {
        x = bx + nx * (alvo - dist);
        z = bz + nz * (alvo - dist);
      }
      const d = hipot(x - bx, z - bz);
      if (!melhor || blocos > melhor.blocos || (blocos === melhor.blocos && d < melhor.d)) {
        const gx = qx + nx * alvo;
        const gz = qz + nz * alvo;
        // a guia passa pelo ponto encaixado, paralela à via vizinha
        const ox = x - gx;
        const oz = z - gz;
        const s = ox * tx + oz * tz;
        const cx = gx + tx * s;
        const cz = gz + tz * s;
        melhor = { x, z, d, blocos, valor: Math.round(alvo), guia: { tipo: 'quadra', a: [cx - tx * 60, cz - tz * 60], b: [cx + tx * 60, cz + tz * 60] } };
      }
    }
  }
  return melhor;
}

/**
 * Encaixa os pontos de um traço. Reta e grade: A e B por inteiro (B também por ângulo, quadra, passo e comprimento a
 * partir de A); curva e contínua: só nó, portão e aresta nas pontas (a forma é da alça). Grade: o canto C cai em
 * múltiplos do espaçamento na perpendicular de AB. Com encaixe desligado, só o que liga (nó a 2 m, ponto sobre a pista).
 * @param {{ modo: string, tipo: string, pontos: number[][], tolerancia?: number, encaixe?: boolean, tangente?: number[],
 *           espacamento?: number }} args
 * @returns {{ pontos: number[][], ancoras: object[], encaixes: object[], guias: object[], refsA: object[] }}
 */
export function encaixarTraco(sim, args) {
  const ligado = args.encaixe !== false;
  const tol = clamp(Number.isFinite(args.tolerancia) ? args.tolerancia : REGRAS_VIAS.tolerancia, 0.5, 200);
  const tipo = tipoVia(args.tipo) ?? tipoVia('rua');
  const meiaNova = tipo.largura / 2;
  const pts = args.pontos.map((p) => [+p[0], +p[1]]);
  const ult = pts.length - 1;
  const ancoras = pts.map(() => null);
  const encaixes = [];
  const guias = [];
  const regA = (i, r) => {
    pts[i] = [r.x, r.z];
    ancoras[i] = r.ancora;
    if (r.encaixe) encaixes.push({ indice: i, ponto: [r.x, r.z], ...r.encaixe });
  };
  const opA = ligado ? { tol, tolNo: tol } : { tol: 0, tolNo: 2 };
  regA(0, ancorar(sim, pts[0][0], pts[0][1], opA));
  const refsA = referencias(sim, ancoras[0]);
  if (ult === 0) return { pontos: pts, ancoras, encaixes, guias, refsA };
  const b = ult;
  const rb = ancorar(sim, pts[b][0], pts[b][1], opA);
  if (rb.ancora || !ligado || args.modo === 'curva' || args.modo === 'continua') {
    regA(b, rb);
  } else if (args.modo === 'reta' || args.modo === 'grade') {
    const [ax, az] = pts[0];
    let [bx, bz] = pts[b];
    const L = hipot(bx - ax, bz - az);
    if (L >= 1) {
      const dir = encaixarDirecao(refsA, ax, az, bx, bz);
      const fixa = dir.tipo !== null;
      let quadra = null;
      if (args.modo === 'reta') {
        const ignorar = new Set();
        quadra = encaixarQuadra(sim, ax, az, bx, bz, { tol, meiaNova, ang: fixa ? dir.ang : null, ignorar });
      }
      if (quadra) {
        bx = quadra.x;
        bz = quadra.z;
        guias.push(quadra.guia);
        encaixes.push({ indice: b, ponto: [bx, bz], tipo: 'quadra', valor: quadra.valor });
        if (fixa) encaixes.push({ indice: b, ponto: [bx, bz], tipo: dir.tipo, valor: dir.valor });
      } else {
        const passo = REGRAS_VIAS.passoComprimento;
        const Lq = Math.max(passo, Math.round(L / passo) * passo);
        bx = ax + cos(dir.ang) * Lq;
        bz = az + sen(dir.ang) * Lq;
        if (fixa) {
          encaixes.push({ indice: b, ponto: [bx, bz], tipo: dir.tipo, valor: dir.valor });
          guias.push({ tipo: dir.tipo, a: [ax, az], b: [ax + cos(dir.ang) * (Lq + 40), az + sen(dir.ang) * (Lq + 40)] });
        }
        encaixes.push({ indice: b, ponto: [bx, bz], tipo: 'comprimento', valor: Lq });
      }
      pts[b] = [bx, bz];
    }
  }
  // grade: pontos [A, B, C]; o canto C fica a um múltiplo do espaçamento na perpendicular de AB, do lado de C
  if (args.modo === 'grade' && pts.length >= 3) {
    const [ax, az] = pts[0];
    const [bx, bz] = pts[1];
    const L = hipot(bx - ax, bz - az) || 1;
    const ux = (bx - ax) / L;
    const uz = (bz - az) / L;
    const vx = -uz;
    const vz = ux;
    const c = args.pontos[2];
    const esp = espacamentoDe(args);
    let prof = (c[0] - bx) * vx + (c[1] - bz) * vz;
    const k = Math.max(1, Math.round(Math.abs(prof) / esp));
    prof = (prof < 0 ? -1 : 1) * k * esp;
    pts[2] = [bx + vx * prof, bz + vz * prof];
    ancoras[2] = null;
  }
  return { pontos: pts, ancoras, encaixes, guias, refsA };
}

/** Distância entre eixos da grade: a pedida ou a do tipo (112 m com rua). */
export const espacamentoDe = (args) => {
  const e = +args.espacamento;
  return Number.isFinite(e) && e >= 48 && e <= 400 ? e : GRADE_EIXOS[args.tipo] ?? GRADE_EIXOS.rua;
};

export function registrar() {}
