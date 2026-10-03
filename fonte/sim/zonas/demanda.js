// Demanda por zona (seção 6.4 do desenho da simulação) e valor do terreno (seção 10.2; dona: S2a).
//
// Demanda: uma vez por rodada, de 0 a 100, suavizada (0,8 da velha + 0,2 da nova), por família (residencial,
// comercial, indústria, escritórios) com os fatores e o teto de cada um, dividida entre as zonas da família pelo
// estudo dos moradores e pelo valor do terreno (zona trancada recebe peso 0). As decisões do Conselho (S3a) e os
// efeitos de área (sim.cidade, X1b) somam na zona deles. A indústria pede acesso à rodovia e mão de obra básica ociosa.
//
// Valor do terreno: grade de 256 x 256 (32 m), índice de 0 a 1.000, refeita em 20 fatias por rodada e suavizada:
// base 100; via a até 48 m +50; saúde, educação, segurança, bombeiros e lazer até +60 cada (pelas vias perto); orla,
// rio e lagoa +80 x e^(-d/200 m); comércio a até 500 m até +100; abandono perto -40; efeitos de área (a Arcologia).
import { clamp, exp } from '../../comum/util.js';
import { RODADA } from '../../comum/relogio.js';
import { AGUA, ARESTA, PREDIO, TIPO_PREDIO } from '../../contratos/flags.js';
import { ORDEM } from '../../contratos/interno.js';
import { ZONAS, ZONAS_ORDEM, zonaNaParte, zonasDaFamilia } from '../../data/zonas.js';
import { COBERTURAS } from '../../data/servicos.js';
import { componentes } from '../vias/grafo.js';
import { prediosNaCaixa } from '../vias/validar.js';
import { aguaEm } from '../mundo/terreno.js';
import { noDeEntrada } from '../mundo/vila.js';
import { prepararCidade, trans, funciona, familiaDe, marcoAtual, acessoDe } from '../predios.js';
import { amostraDeFrentes } from './crescimento.js';
import { capacidadeMoradores, ocupacaoDe, ESTUDO_BASE, estudoDe } from '../cidadaos.js';
import { coberturaArestas } from '../servicos.js';
import { comercioPerto } from '../bemestar.js';

/** Pesos e tetos dos fatores (seção 6.4). (calibrar) */
export const DEMANDA = Object.freeze({
  res: { base: 40, vagas: 35, desemprego: -35, vazias: -30, bemEstar: 0.5, impulso: 25, impulsoAte: 2000, atratividade: 10 },
  com: { base: 30, consumo: 50, excesso: -45, vazias: -30, maoDeObra: 10, clientesPorMorador: 0.3, clientesPorVaga: 4 },
  ind: { base: 30, maoDeObra: 35, bens: 25, vazias: -30, vagasPorVagaComercio: 1 },
  esc: { base: 10, superior: 50, valor: 15, vazias: -30 },
  semRodovia: -25, suavizar: 0.8,
});

/** true se a zona pode crescer agora: parte do jogo, marco e o desbloqueio do progresso (tudo no Modo livre). */
export function zonaAtiva(sim, id) {
  const def = ZONAS[id];
  if (!def || !zonaNaParte(id)) return false;
  if (sim.json.partida?.modo === 'livre') return true;
  if (sim.progresso?.liberado && sim.progresso.liberado(`zona.${id}`) === false) return false;
  return marcoAtual(sim) >= (def.marco ?? 0);
}

/** Números da cidade que a demanda usa (uma passada pelos prédios). */
function levantar(sim) {
  const P = sim.tabelas.predios;
  const r = {
    capRes: 0, morRes: 0, estudo: [0, 0, 0, 0], com: { vagas: 0, ocupadas: 0 }, ind: { vagas: 0, ocupadas: 0 }, esc: { vagas: 0, ocupadas: 0 },
  };
  for (let i = 0; i < P.n; i++) {
    if (!funciona(P, i) || P.tipo[i] !== TIPO_PREDIO.ZONA || P.flags[i] & PREDIO.OBRA) continue;
    const fam = familiaDe(sim, i);
    if (fam === 'res') {
      r.capRes += capacidadeMoradores(P, i);
      r.morRes += P.moradores[i];
      for (let n = 0; n < 4; n++) r.estudo[n] += P.moradores[i] * estudoDe(P, i, n);
    } else if (r[fam]) {
      const o = ocupacaoDe(sim, i);
      r[fam].vagas += o.vagas;
      r[fam].ocupadas += o.ocupadas;
    }
  }
  const s = r.estudo[0] + r.estudo[1] + r.estudo[2] + r.estudo[3];
  r.estudo = s > 0 ? r.estudo.map((v) => v / s) : [...ESTUDO_BASE];
  return r;
}

/** Componentes do grafo (em cache pela versão do grafo: função pura dele). */
function componentesEmDia(sim) {
  const t = trans(sim);
  const G = sim.grafo;
  if (t.compGrafo && t.compGrafo.versao === G.versao && t.compGrafo.n === G.nos.n) return t.compGrafo.comp;
  const { comp } = componentes(G);
  t.compGrafo = { versao: G.versao, n: G.nos.n, comp };
  return comp;
}

/** Índices das zonas que pedem a rodovia (rodovia: true no registro; a indústria no M1a, D52). */
const ZONAS_RODOVIA = ZONAS_ORDEM.map((id, z) => (id && ZONAS[id].rodovia ? z : -1)).filter((z) => z > 0);

/** A rede viária da zona z chega à rodovia? (algum prédio ou frente dela no componente do nó de entrada) */
function ligadaARodovia(sim, z) {
  const ent = noDeEntrada(sim);
  if (ent < 0) return true; // mapa sem rodovia (testes): não pune
  const A = sim.tabelas.arestas;
  const C = sim.tabelas.celulas;
  const P = sim.tabelas.predios;
  const comp = componentesEmDia(sim);
  const alvo = comp[ent];
  let tem = false;
  const AC = { e: -1, s: 0 };
  for (let i = 0; i < P.n; i++) {
    if (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.ZONA || P.zona[i] !== z) continue;
    tem = true;
    acessoDe(sim, i, AC);
    if (AC.e >= 0 && A.viva[AC.e] && comp[A.a[AC.e]] === alvo) return true;
  }
  for (const c of amostraDeFrentes(sim, z, 64)) {
    tem = true;
    const e = C.aresta[c];
    if (e >= 0 && A.viva[e] && comp[A.a[e]] === alvo) return true;
  }
  return !tem;
}

/** Atratividade (até +10): Legado da Holding (S3a) e efeitos de área. */
function atratividade(sim) {
  let v = 0;
  try {
    const h = sim.q.holding ? sim.q.holding() : null;
    if (Number.isFinite(h?.efeitos?.atratividade)) v += h.efeitos.atratividade;
  } catch {
    v += 0;
  }
  const ef = sim.json.cidade.efeitos;
  for (const id of Object.keys(ef).sort()) v += +ef[id].atratividade || 0;
  return v;
}

/**
 * Fração das frentes livres da zona z dentro do raio de um efeito de área (amostra de até 64). Sem raio, a cidade
 * inteira (1). A torre.e3 (D49) dá +20 de residencial média só num raio de 1,5 km: a demanda da zona leva a parte das
 * frentes que estão no raio, e o nascimento prefere as de dentro (bonusPerto, crescimento.js).
 */
export function fracaoNoRaio(sim, z, ef) {
  if (!(ef.raio > 0) || !Number.isFinite(ef.x) || !Number.isFinite(ef.z)) return 1;
  const C = sim.tabelas.celulas;
  const amostra = amostraDeFrentes(sim, z, 64);
  if (!amostra.length) return 0;
  const r2 = ef.raio * ef.raio;
  let dentro = 0;
  for (const c of amostra) {
    const dx = C.x[c] - ef.x;
    const dz = C.z[c] - ef.z;
    if (dx * dx + dz * dz <= r2) dentro++;
  }
  return dentro / amostra.length;
}

/** Bônus de demanda por zona: decisões do Conselho (S3a) e efeitos de área (sim.cidade, na parte das frentes no raio). */
function bonusDeZona(sim) {
  const out = {};
  const dec = typeof sim.economia?.efeitos === 'function' ? sim.economia.efeitos('demanda') : [];
  for (const e of dec) if (e.zona) out[e.zona] = (out[e.zona] ?? 0) + (+e.v || 0);
  const ef = sim.json.cidade.efeitos;
  for (const id of Object.keys(ef).sort()) {
    for (const [z, v] of Object.entries(ef[id].demanda ?? {})) {
      const iz = ZONAS_ORDEM.indexOf(z);
      if (iz <= 0) continue;
      out[z] = (out[z] ?? 0) + (+v || 0) * fracaoNoRaio(sim, iz, ef[id]);
    }
  }
  return out;
}

/**
 * Demanda da rodada por família, com os fatores. Devolve { familias: { res, com, ind, esc }, fatores: { res: [...] } }.
 * Pura: só lê.
 */
export function calcularDemanda(sim) {
  const ag = sim.agregados;
  const D = DEMANDA;
  const r = levantar(sim);
  const pop = ag.populacao;
  const W = ag.empregos.trabalhadores ?? 0;
  const V = ag.empregos.vagas.reduce((a, b) => a + b, 0);
  const O = ag.empregos.ocupadas.reduce((a, b) => a + b, 0);
  const u = ag.empregos.taxa ?? 0;
  const d = sim.json.cidade.desemprego;
  const fat = { res: [], com: [], ind: [], esc: [] };
  const soma = (fam, id, v) => {
    fat[fam].push({ id, v: Math.round(v * 10) / 10 });
    return v;
  };
  // residencial
  let R = soma('res', 'base', D.res.base);
  R += soma('res', 'vagas', D.res.vagas * Math.min(1, Math.max(0, V - O) / Math.max(100, 0.25 * W)));
  R += soma('res', 'desemprego', D.res.desemprego * Math.min(1, u / 0.5));
  R += soma('res', 'vazias', D.res.vazias * Math.min(1, (r.capRes > 0 ? (r.capRes - r.morRes) / r.capRes : 0) / 0.25));
  if (pop > 0) R += soma('res', 'bemEstar', clamp((ag.bemEstarMedio - 50) * D.res.bemEstar, -25, 25));
  R += soma('res', 'impulso', D.res.impulso * Math.max(0, 1 - pop / D.res.impulsoAte));
  R += soma('res', 'atratividade', Math.min(D.res.atratividade, atratividade(sim)));
  // comercial
  const clientes = pop * D.com.clientesPorMorador;
  const capCom = r.com.vagas * D.com.clientesPorVaga;
  let C = soma('com', 'base', D.com.base);
  C += soma('com', 'consumo', D.com.consumo * (clientes > 0 ? Math.max(0, clientes - capCom) / clientes : 0));
  // comércio além dos clientes (C1a): sem este termo a demanda ficava em 40 (base e mão de obra) com as lojas abandonando
  // por falta de clientes, e o jogador seguia pintando comércio
  if (capCom > clientes) C += soma('com', 'excesso', D.com.excesso * Math.min(1, (capCom - clientes) / capCom / 0.3));
  C += soma('com', 'vazias', D.com.vazias * Math.min(1, (r.com.vagas ? 1 - r.com.ocupadas / r.com.vagas : 0) / 0.3));
  const basicaOciosa = (W * ((ESTUDO_BASE[0] * d[0] + ESTUDO_BASE[1] * d[1]) || 0)) / Math.max(1, W);
  C += soma('com', 'maoDeObra', D.com.maoDeObra * Math.min(1, basicaOciosa / 0.2));
  // indústria
  let I = soma('ind', 'base', D.ind.base);
  I += soma('ind', 'maoDeObra', D.ind.maoDeObra * Math.min(1, basicaOciosa / 0.15));
  const precisa = r.com.vagas * D.ind.vagasPorVagaComercio;
  I += soma('ind', 'bens', D.ind.bens * (precisa > 0 ? Math.max(0, precisa - r.ind.vagas) / precisa : 0));
  I += soma('ind', 'vazias', D.ind.vazias * Math.min(1, (r.ind.vagas ? 1 - r.ind.ocupadas / r.ind.vagas : 0) / 0.3));
  // escritórios (M1b)
  let E = soma('esc', 'base', D.esc.base);
  E += soma('esc', 'superior', D.esc.superior * Math.min(1, (d[3] || 0) / 0.2));
  E += soma('esc', 'vazias', D.esc.vazias * Math.min(1, (r.esc.vagas ? 1 - r.esc.ocupadas / r.esc.vagas : 0) / 0.3));
  // zona que pede a rodovia e não chega a ela: a família perde demanda (uma vez por família)
  const fams = { res: R, com: C, ind: I, esc: E };
  const punidas = new Set();
  for (const z of ZONAS_RODOVIA) {
    const f = ZONAS[ZONAS_ORDEM[z]].familia;
    if (punidas.has(f) || ligadaARodovia(sim, z)) continue;
    punidas.add(f);
    fams[f] += soma(f, 'rodovia', D.semRodovia);
  }
  return {
    familias: { res: clamp(fams.res, 0, 100), com: clamp(fams.com, 0, 100), ind: clamp(fams.ind, 0, 100), esc: clamp(fams.esc, 0, 100) },
    fatores: fat, estudo: r.estudo, clientes: capCom > 0 ? Math.min(1, clientes / capCom) : 1,
  };
}

/** Valor médio do terreno nas frentes livres de uma zona (0 a 1.000; 300 sem frentes). */
function valorMedioDaZona(sim, z) {
  const C = sim.tabelas.celulas;
  let s = 0;
  let n = 0;
  for (const c of amostraDeFrentes(sim, z, 48)) {
    s += valorEm(sim, C.x[c], C.z[c]);
    n++;
  }
  return n ? s / n : 300;
}

/** Sistema da demanda (uma vez por rodada): suaviza, divide entre as zonas e escreve S.agregados.demanda. */
export function sistemaDemanda(sim) {
  const j = sim.json.cidade;
  const ag = sim.agregados;
  const calc = calcularDemanda(sim);
  j.clientes = calc.clientes;
  const bonus = bonusDeZona(sim);
  const fam = {};
  for (const f of ['res', 'com', 'ind', 'esc']) {
    const velho = j.demanda[`_${f}`] ?? calc.familias[f];
    fam[f] = DEMANDA.suavizar * velho + (1 - DEMANDA.suavizar) * calc.familias[f];
    j.demanda[`_${f}`] = Math.round(fam[f] * 1000) / 1000;
  }
  const fatores = {};
  for (const f of ['res', 'com', 'ind', 'esc']) {
    const zonas = zonasDaFamilia(f);
    const pesos = zonas.map((id) => {
      if (!zonaAtiva(sim, id)) return 0;
      const def = ZONAS[id];
      let w = 0;
      for (let n = 0; n < 4; n++) w += def.split[n] * calc.estudo[n];
      const v = valorMedioDaZona(sim, ZONAS_ORDEM.indexOf(id)) / 1000;
      w *= Math.max(0.1, 1 + def.valor.peso * (v - 0.3));
      return Math.max(0, w);
    });
    const tot = pesos.reduce((a, b) => a + b, 0);
    zonas.forEach((id, k) => {
      const parte = tot > 0 ? pesos[k] / tot : 0;
      const b = pesos[k] > 0 ? bonus[id] ?? 0 : 0;
      const v = clamp(fam[f] * parte + b, 0, 100);
      j.demanda[id] = Math.round(v * 1000) / 1000;
      ag.demanda[id] = Math.round(v);
      fatores[id] = pesos[k] > 0 ? [...calc.fatores[f], { id: 'parte', v: Math.round(parte * 100) }, ...(b ? [{ id: 'decisao', v: Math.round(b * 10) / 10 }] : [])] : [];
    });
  }
  ag.demanda.R = Math.round(fam.res);
  ag.demanda.C = Math.round(fam.com);
  ag.demanda.I = Math.round(fam.ind);
  ag.demanda.E = Math.round(zonasDaFamilia('esc').some((id) => zonaAtiva(sim, id)) ? fam.esc : 0);
  ag.demanda.fatores = fatores;
  j.fatores = fatores;
}

/** q.demanda() → { resBaixa, ..., R, C, I, E, fatores: { zona: [{ id, v }] } }. */
export function consultaDemanda(sim) {
  const ag = sim.agregados;
  const out = {};
  for (const id of ZONAS_ORDEM) if (id) out[id] = ag.demanda[id] ?? 0;
  out.R = ag.demanda.R;
  out.C = ag.demanda.C;
  out.I = ag.demanda.I;
  out.E = ag.demanda.E;
  out.fatores = JSON.parse(JSON.stringify(ag.demanda.fatores ?? {}));
  out.ativas = ZONAS_ORDEM.filter((id) => id && zonaAtiva(sim, id));
  return out;
}

// ------------------------------------------------------------------------------------------------ valor do terreno

export const VALOR = Object.freeze({
  n: 256, passo: 32, origem: [-4096, -4096], base: 100, via: 50, viaAte: 48, servico: 60, agua: 80, aguaD: 200,
  comercio: 100, comercioAlvo: 300, abandono: -40, abandonoAte: 64, max: 1000, suavizar: 0.8, fatias: RODADA,
});

/** Valor do terreno em (x, z) (0 a 1.000; 0 fora da grade). */
export function valorEm(sim, x, z) {
  const g = sim.grades.valor;
  if (!g) return 0;
  const i = Math.floor((x - VALOR.origem[0]) / VALOR.passo);
  const j = Math.floor((z - VALOR.origem[1]) / VALOR.passo);
  if (i < 0 || j < 0 || i >= VALOR.n || j >= VALOR.n) return 0;
  return g.dados[j * VALOR.n + i];
}

/** Distância (m) de cada célula da grade do valor até a água (orla, rio, lagoa), pelo chanfro de duas passadas. */
function distanciaAgua(sim) {
  const t = trans(sim);
  if (t.aguaDist) return t.aguaDist;
  const T = sim.espelho.terreno;
  const n = VALOR.n;
  const d = new Float32Array(n * n).fill(1e9);
  if (T?.agua) {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = VALOR.origem[0] + (i + 0.5) * VALOR.passo;
        const z = VALOR.origem[1] + (j + 0.5) * VALOR.passo;
        if (aguaEm(T, x, z) !== AGUA.TERRA) d[j * n + i] = 0;
      }
    }
    const p = VALOR.passo;
    const q = p * 1.4142135623730951;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        let v = d[k];
        if (i > 0) v = Math.min(v, d[k - 1] + p);
        if (j > 0) v = Math.min(v, d[k - n] + p);
        if (i > 0 && j > 0) v = Math.min(v, d[k - n - 1] + q);
        if (i < n - 1 && j > 0) v = Math.min(v, d[k - n + 1] + q);
        d[k] = v;
      }
    }
    for (let j = n - 1; j >= 0; j--) {
      for (let i = n - 1; i >= 0; i--) {
        const k = j * n + i;
        let v = d[k];
        if (i < n - 1) v = Math.min(v, d[k + 1] + p);
        if (j < n - 1) v = Math.min(v, d[k + n] + p);
        if (i < n - 1 && j < n - 1) v = Math.min(v, d[k + n + 1] + q);
        if (i > 0 && j < n - 1) v = Math.min(v, d[k + n - 1] + q);
        d[k] = v;
      }
    }
  }
  if (T?.agua) t.aguaDist = d;
  return d;
}

/** Termo da beira da água de cada célula (80 x e^(-d/200 m)): função do terreno, em cache. */
function termoAgua(sim) {
  const t = trans(sim);
  if (t.valorAgua) return t.valorAgua;
  const d = distanciaAgua(sim);
  const v = new Float32Array(d.length);
  for (let k = 0; k < d.length; k++) v[k] = d[k] < 2000 ? VALOR.agua * exp(-d[k] / VALOR.aguaD) : 0;
  if (sim.espelho.terreno?.agua) t.valorAgua = v;
  return v;
}

/** Valor novo (sem suavizar) das células de uma faixa de linhas [j0, j1) da grade. */
function valorDaFaixa(sim, j0, j1, out) {
  const n = VALOR.n;
  const p = VALOR.passo;
  const [ox, oz] = VALOR.origem;
  const linhas = j1 - j0;
  const acesso = new Uint8Array(linhas * n);
  const cob = new Float32Array(COBERTURAS.length * linhas * n);
  const aband = new Uint8Array(linhas * n);
  const zA = oz + j0 * p;
  const zB = oz + j1 * p;
  const R = VALOR.viaAte;
  const A = sim.tabelas.arestas;
  const marcar = (x, z, raio, fn) => {
    const i0 = Math.max(0, Math.floor((x - raio - ox) / p));
    const i1 = Math.min(n - 1, Math.floor((x + raio - ox) / p));
    const k0 = Math.max(j0, Math.floor((z - raio - oz) / p));
    const k1 = Math.min(j1 - 1, Math.floor((z + raio - oz) / p));
    for (let j = k0; j <= k1; j++) {
      for (let i = i0; i <= i1; i++) {
        const cx = ox + (i + 0.5) * p - x;
        const cz = oz + (j + 0.5) * p - z;
        if (cx * cx + cz * cz <= raio * raio) fn((j - j0) * n + i);
      }
    }
  };
  // vias perto: acesso e a cobertura dos serviços (pela cobertura no meio da aresta)
  if (sim.grafo) {
    const ids = Array.from(sim.grafo.gradeArestas.consultar(ox, zA - R, ox + n * p, zB + R));
    const v = new Float32Array(COBERTURAS.length);
    const cobA = coberturaArestas(sim);
    for (const e of ids) {
      if (!A.viva[e] || A.flags[e] & ARESTA.RODOVIA) continue;
      const comp = A.arco[17 * e + 16];
      for (let c = 0; c < COBERTURAS.length; c++) v[c] = cobA[c * A.n + e];
      const passos = Math.max(1, Math.ceil(comp / 16));
      for (let s = 0; s <= passos; s++) {
        const t = s / passos;
        const u = 1 - t;
        const o = 8 * e;
        const P = A.p;
        const x = u * u * u * P[o] + 3 * u * u * t * P[o + 2] + 3 * u * t * t * P[o + 4] + t * t * t * P[o + 6];
        const z = u * u * u * P[o + 1] + 3 * u * u * t * P[o + 3] + 3 * u * t * t * P[o + 5] + t * t * t * P[o + 7];
        if (z < zA - R || z > zB + R) continue;
        marcar(x, z, R, (k) => {
          acesso[k] = 1;
          for (let c = 0; c < COBERTURAS.length; c++) if (v[c] > cob[c * linhas * n + k]) cob[c * linhas * n + k] = v[c];
        });
      }
    }
  }
  // prédios abandonados perto
  const P = sim.tabelas.predios;
  const RA = VALOR.abandonoAte;
  for (const i of prediosNaCaixa(sim, ox, zA - RA, ox + n * p, zB + RA)) {
    if (P.flags[i] & PREDIO.ABANDONADO) marcar(P.x[i], P.z[i], RA, (k) => (aband[k] = 1));
  }
  const tAgua = termoAgua(sim);
  const ef = sim.json.cidade.efeitos;
  const efeitos = Object.keys(ef).sort().map((id) => ef[id]).filter((e) => e.valor);
  for (let j = j0; j < j1; j++) {
    const z = oz + (j + 0.5) * p;
    for (let i = 0; i < n; i++) {
      const x = ox + (i + 0.5) * p;
      const k = (j - j0) * n + i;
      let v = VALOR.base + VALOR.via * acesso[k];
      for (let c = 0; c < COBERTURAS.length; c++) v += VALOR.servico * cob[c * linhas * n + k];
      v += tAgua[j * n + i];
      if (acesso[k]) v += VALOR.comercio * Math.min(1, comercioPerto(sim, x, z) / VALOR.comercioAlvo);
      if (aband[k]) v += VALOR.abandono;
      for (const e of efeitos) {
        if (!e.raio || !Number.isFinite(e.x)) v += e.valor;
        else {
          const dx = x - e.x;
          const dz = z - e.z;
          const d = Math.sqrt(dx * dx + dz * dz);
          if (d < 4 * e.raio) v += e.valor * exp(-d / e.raio);
        }
      }
      out[k] = clamp(v, 0, VALOR.max);
    }
  }
}

const NOVO = new Float32Array(16 * 256);

/** Uma fatia (de 20) do valor do terreno por tique; no fim da rodada marca a grade no diário. */
export function sistemaValor(sim, fatia, fatias) {
  const g = sim.grades.valor;
  const n = VALOR.n;
  const j0 = Math.floor((fatia * n) / fatias);
  const j1 = Math.floor(((fatia + 1) * n) / fatias);
  valorDaFaixa(sim, j0, j1, NOVO);
  const s = VALOR.suavizar;
  for (let j = j0; j < j1; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      g.dados[k] = s * g.dados[k] + (1 - s) * NOVO[(j - j0) * n + i];
    }
  }
  if (fatia === fatias - 1) sim.mudancas.marcar('valor');
}

function camadaValor(sim) {
  const g = sim.grades.valor;
  return {
    id: 'valor', fonte: 'grade', dados: Float32Array.from(g.dados), grade: { n: g.n, passo: g.passo, origem: [...g.origem] }, tipo: 'seq',
    escala: { min: 0, max: VALOR.max, unidade: '' }, categorias: null,
    legenda: [{ v: 0, chave: 'camada.valor.baixo' }, { v: 600, chave: 'camada.valor.nivel5' }, { v: VALOR.max, chave: 'camada.valor.alto' }],
    resumo: { chave: 'camada.valor.resumo', params: {} }, versao: sim.json.cidade.rodada,
  };
}

// ------------------------------------------------------------------------------------------------ registro

export function registrar(sim) {
  if (!sim.tabelas.predios || !sim.grafo) return;
  prepararCidade(sim);
  // a grade do valor nasce com a base e a beira da água (função do terreno), e vai no save
  const dados = new Float32Array(VALOR.n * VALOR.n);
  const grade = { n: VALOR.n, passo: VALOR.passo, origem: [...VALOR.origem], dados };
  sim.registrarGrade('valor', grade);
  sim.espelho.grades.valor = grade;
  const tAgua = termoAgua(sim);
  for (let k = 0; k < dados.length; k++) dados[k] = VALOR.base + tAgua[k];
  sim.registrarSistema(RODADA, 10, sistemaDemanda, 1, { nome: 'demanda', ordem: ORDEM.zonas });
  sim.registrarSistema(RODADA, 0, sistemaValor, VALOR.fatias, { nome: 'valor', ordem: ORDEM.servicos + 50 });
  sim.registrarConsulta('demanda', consultaDemanda);
  sim.camadas.registrar('valor', camadaValor);
}

