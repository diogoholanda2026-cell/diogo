// Pincel de zona (seção 6.3 do desenho da simulação e 9.3 do da interface; dona: S1b): quadra (toque dentro de uma
// quadra pinta as células livres de todos os blocos em volta dela, até o fundo escolhido; fora de quadra fechada, o
// bloco mais perto), círculo, retângulo (alinhado aos eixos ou girado por `rot`) e lista de células. Zona 0 apaga.
// Pintar outra zona por cima de um prédio não demole: marca o prédio para sair quando for abandonado, como no CS2
// (DEMOLIR_AO_ABANDONAR); voltar à zona dele tira a marca. q.zona.previa diz as células que mudam, quantas têm prédio e
// o efeito previsto na média do bem-estar (função da S2a por registrarEfeitoMedia; sem ela, 0).
import { direcao } from '../../comum/bezier.js';
import { atan2, hipot, clamp, cos, sen } from '../../comum/util.js';
import { pontoNoPoligono } from '../../comum/vetor.js';
import { CELULA, PREDIO } from '../../contratos/flags.js';
import { CELULA_M, LINHAS_BLOCO } from '../../contratos/espelho.js';
import { ZONAS, ZONAS_ORDEM } from '../../data/zonas.js';
import { arestaPerto, arestasDoNo } from '../vias/grafo.js';
import { eixoDa, saidaDoNo, derivados } from '../vias/validar.js';
import { celulasNaCaixa, celulasDaAresta, temBlocos } from './blocos.js';

const TAU = 2 * Math.PI;
const MAX_PASSOS = 600;
const RAIO_MAX = 400;

/** Efeito da pintura na média do bem-estar (S2a): fn(sim, celulas: Int32Array, zona) → número. */
export function registrarEfeitoMedia(sim, fn) {
  derivados(sim).efeitoMedia = typeof fn === 'function' ? fn : null;
}

/** true se a zona pode ser pintada agora (marco; no Modo livre, todas). */
export function zonaLiberada(sim, z) {
  if (z === 0) return true;
  const id = ZONAS_ORDEM[z];
  const def = ZONAS[id];
  if (!def) return false;
  if (sim.json.partida?.modo === 'livre') return true;
  if (sim.progresso?.liberado && sim.progresso.liberado(`zona.${id}`) === false) return false;
  const n = sim.progresso?.marco ? sim.progresso.marco().n : 0;
  return n >= (def.marco ?? 0);
}

// ------------------------------------------------------------------------------------------------ quadra

/**
 * Face do grafo (a quadra) que contém (x, z): os blocos { e, lado } da borda dela, andando com a quadra à direita. null
 * se o ponto não está numa quadra fechada (fora da cidade) ou a borda é longa demais.
 */
export function quadraEm(sim, x, z) {
  const G = sim.grafo;
  const A = sim.tabelas.arestas;
  let perto = null;
  for (const r of [32, 96, 200, RAIO_MAX]) {
    perto = arestaPerto(G, x, z, r);
    if (perto) break;
  }
  if (!perto) return null;
  const d = direcao(A.p, perto.t, [0, 0], 8 * perto.e);
  const lado = (x - perto.x) * -d[1] + (z - perto.z) * d[0] >= 0 ? 1 : -1;
  const inicio = { e: perto.e, sentido: lado };
  const blocos = [];
  const poligono = [];
  let cur = inicio;
  const s = [0, 0];
  for (let passo = 0; passo < MAX_PASSOS; passo++) {
    blocos.push({ e: cur.e, lado: cur.sentido });
    const c = eixoDa(sim, cur.e);
    if (cur.sentido > 0) for (let k = 0; k < c.n; k++) poligono.push(c.pts[2 * k], c.pts[2 * k + 1]);
    else for (let k = c.n; k > 0; k--) poligono.push(c.pts[2 * k], c.pts[2 * k + 1]);
    const v = cur.sentido > 0 ? A.b[cur.e] : A.a[cur.e];
    saidaDoNo(sim, cur.e, v, s);
    const volta = atan2(s[1], s[0]);
    let prox = cur.e;
    let md = TAU + 1;
    for (const f of arestasDoNo(G, v)) {
      if (f === cur.e) continue;
      saidaDoNo(sim, f, v, s);
      let dl = volta - atan2(s[1], s[0]);
      while (dl <= 0) dl += TAU;
      while (dl > TAU) dl -= TAU;
      if (dl < md || (dl === md && f < prox)) {
        md = dl;
        prox = f;
      }
    }
    cur = { e: prox, sentido: A.a[prox] === v ? 1 : -1 };
    if (cur.e === inicio.e && cur.sentido === inicio.sentido) {
      return pontoNoPoligono(x, z, poligono) ? blocos : null;
    }
  }
  return null;
}

/** Bloco da aresta mais perto do ponto, do lado dele (até 48 m além da pista), ou null. */
function blocoPerto(sim, x, z) {
  const A = sim.tabelas.arestas;
  const p = arestaPerto(sim.grafo, x, z, 72);
  if (!p) return null;
  const d = direcao(A.p, p.t, [0, 0], 8 * p.e);
  const lado = (x - p.x) * -d[1] + (z - p.z) * d[0] >= 0 ? 1 : -1;
  return [{ e: p.e, lado }];
}

// ------------------------------------------------------------------------------------------------ seleção

/**
 * Células que o pincel alcança (vivas, não inválidas), em ordem de idx. Na quadra, só as livres (as com prédio ficam).
 * @param {{ modo: 'quadra' | 'circulo' | 'retangulo' | 'celulas', x?, z?, raio?, x2?, z2?, rot?, celulas?, fundo? }} pincel
 */
export function celulasDoPincel(sim, pincel) {
  const C = sim.tabelas.celulas;
  if (!pincel || typeof pincel !== 'object') return null;
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  const ok = (c) => C.viva[c] && C.estado[c] !== CELULA.INVALIDA;
  let lista = [];
  if (pincel.modo === 'celulas') {
    if (!Array.isArray(pincel.celulas)) return null;
    const vistos = new Set();
    for (const c of pincel.celulas) {
      if (!Number.isInteger(c) || c < 0 || c >= C.n || vistos.has(c)) continue;
      vistos.add(c);
      if (ok(c)) lista.push(c);
    }
    return lista.sort((a, b) => a - b);
  }
  if (!num(pincel.x) || !num(pincel.z)) return null;
  const { x, z } = pincel;
  if (pincel.modo === 'circulo') {
    const r = clamp(num(pincel.raio) ? pincel.raio : CELULA_M, 1, RAIO_MAX);
    for (const c of celulasNaCaixa(sim, x - r, z - r, x + r, z + r)) if (ok(c) && hipot(C.x[c] - x, C.z[c] - z) <= r) lista.push(c);
    return lista;
  }
  if (pincel.modo === 'retangulo') {
    if (!num(pincel.x2) || !num(pincel.z2)) return null;
    const rot = num(pincel.rot) ? pincel.rot : 0;
    // retângulo com um canto em (x, z) e o oposto em (x2, z2), com os lados girados por rot (convenção do three)
    const ux = cos(rot);
    const uz = -sen(rot);
    const vx = sen(rot);
    const vz = cos(rot);
    const dx = pincel.x2 - x;
    const dz = pincel.z2 - z;
    const a = dx * ux + dz * uz;
    const b = dx * vx + dz * vz;
    const [a0, a1] = a < 0 ? [a, 0] : [0, a];
    const [b0, b1] = b < 0 ? [b, 0] : [0, b];
    const R = hipot(dx, dz);
    if (R > 4 * RAIO_MAX) return null;
    const cx = (x + pincel.x2) / 2;
    const cz = (z + pincel.z2) / 2;
    for (const c of celulasNaCaixa(sim, cx - R, cz - R, cx + R, cz + R)) {
      if (!ok(c)) continue;
      const px = C.x[c] - x;
      const pz = C.z[c] - z;
      const pa = px * ux + pz * uz;
      const pb = px * vx + pz * vz;
      if (pa >= a0 && pa <= a1 && pb >= b0 && pb <= b1) lista.push(c);
    }
    return lista;
  }
  if (pincel.modo === 'quadra') {
    const fundo = clamp(Number.isInteger(pincel.fundo) ? pincel.fundo : LINHAS_BLOCO, 1, LINHAS_BLOCO);
    const blocos = quadraEm(sim, x, z) ?? blocoPerto(sim, x, z);
    if (!blocos) return [];
    const vistos = new Set();
    for (const { e, lado } of blocos) {
      if (!temBlocos(sim, e)) continue;
      for (const c of celulasDaAresta(sim, e)) {
        if (C.lado[c] !== lado || C.linha[c] >= fundo || vistos.has(c)) continue;
        vistos.add(c);
        if (C.estado[c] === CELULA.LIVRE) lista.push(c);
      }
    }
    return lista.sort((a, b) => a - b);
  }
  return null;
}

/** Células que mudam de zona (o pincel menos as que já têm a zona). */
function celulasQueMudam(sim, pincel, zona) {
  const C = sim.tabelas.celulas;
  const lista = celulasDoPincel(sim, pincel);
  if (!lista) return null;
  return lista.filter((c) => C.zona[c] !== zona);
}

const zonaValida = (z) => Number.isInteger(z) && z >= 0 && z < ZONAS_ORDEM.length;

/** q.zona.previa({ pincel, zona }) → { celulas: Int32Array, comPredio, efeitoMedia }. */
export function previa(sim, { pincel, zona } = {}) {
  const C = sim.tabelas.celulas;
  const z = zonaValida(zona) ? zona : 0;
  const lista = celulasQueMudam(sim, pincel, z) ?? [];
  const celulas = Int32Array.from(lista);
  let comPredio = 0;
  for (const c of lista) if (C.predio[c] >= 0) comPredio++;
  const fn = derivados(sim).efeitoMedia;
  let efeitoMedia = 0;
  if (fn && lista.length) {
    const v = fn(sim, celulas, z);
    efeitoMedia = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  }
  return { celulas, comPredio, efeitoMedia, liberada: zonaLiberada(sim, z) };
}

/** zona.pintar: aplica o pincel. */
export function pintar(sim, { pincel, zona } = {}) {
  const C = sim.tabelas.celulas;
  const P = sim.tabelas.predios;
  if (!zonaValida(zona)) return { ok: false, codigo: 'valor' };
  if (!zonaLiberada(sim, zona)) return { ok: false, codigo: 'marco' };
  const lista = celulasQueMudam(sim, pincel, zona);
  if (!lista) return { ok: false, codigo: 'valor' };
  if (!lista.length) return { ok: false, codigo: 'nada' };
  const tocados = new Set();
  for (const c of lista) {
    C.zona[c] = zona;
    C.marcar(c);
    if (C.predio[c] >= 0) tocados.add(C.predio[c]);
  }
  for (const i of tocados) {
    const f = P.flags[i];
    const outra = P.zona[i] !== zona;
    const nf = outra ? f | PREDIO.DEMOLIR_AO_ABANDONAR : f & ~PREDIO.DEMOLIR_AO_ABANDONAR;
    if (nf !== f) {
      P.flags[i] = nf;
      P.marcar(i);
    }
  }
  return { ok: true, dados: { n: lista.length, comPredio: tocados.size } };
}

export function registrar(sim) {
  if (!sim.tabelas.celulas || !sim.grafo) return;
  sim.registrarComando('zona.pintar', pintar);
  sim.registrarConsulta('zona.previa', previa);
}

