// ZON2 (D112 e D113; seção 2.5 e 6 do desenho da simulação): onde cada coisa pode ficar e quem manda no ritmo da zona.
//
// 1. Lugar. A indústria zoneada só se pinta dentro do Distrito Industrial; captação, poço, tratamento de água, usina solar,
//    ETE, hidrelétrica, termelétrica, subestação e data center só se colocam na Zona de Utilidades; os prédios da Holding
//    marcados `zona: 'industrial'` (Mina, Cimenteira, Vidraria, Serraria e Agroindústria) ficam no Distrito. As duas áreas
//    são dados (data/zon2.js, também áreas nomeadas do mapa). O que a cidade consome chega por rede de longo alcance: o
//    produtor da Zona de Utilidades que não está numa via com canos e cabos liga ao nó mais perto de uma via com redes por
//    uma linha reta, paga na obra (metros x custo por metro da rede, `linhaLonga`).
// 2. Ritmo. Cada tipo de zona pintada tem um modo de crescimento: 'automatico' (a demanda faz nascer, como sempre) ou
//    'manual' (o jogador pede um lote de 1 a 1000 construções; só então elas começam, e a demanda só acumula em
//    `espera`). A escolha vale por tipo de zona (resBaixa, comBaixa, industria...) e troca a qualquer hora.
//
// Estado: sim.json.zon2 (no save): { modo: {zonaId: 'manual'}, pedido: {zonaId: n}, espera: {zonaId: x}, linhas: {ref: {...}} }.
// Sem chave vale o padrão (automático, nada pedido, nada esperando). Comandos: zona.modo, zona.lote. Consultas:
// zona.crescimento, zona.regras, zona.lugar.
import { pontoNoPoligono } from '../comum/vetor.js';
import { frentesLivres } from './zonas/crescimento.js';
import { CATEGORIAS_SERVICO, SERVICOS } from '../data/servicos.js';
import { PREDIOS_HOLDING } from '../data/holding.js';
import { VIAS, VIAS_ORDEM } from '../data/vias.js';
import { ZONAS, ZONAS_ORDEM, zonaNaParte } from '../data/zonas.js';
import { PREDIO, TIPO_PREDIO } from '../contratos/flags.js';
import {
  VENTO_PREDOMINANTE, DISTRITO_INDUSTRIAL, ZONA_UTILIDADES, TIPOS_UTILIDADES, LONGO_ALCANCE, MODOS_CRESCIMENTO, MODO_PADRAO,
  LOTE_MIN, LOTE_MAX, REGRAS_DE_LUGAR,
} from '../data/zon2.js';

// ------------------------------------------------------------------------------------------------ lugar

const plano = (contorno) => Float64Array.from(contorno.flat());
const DISTRITO = plano(DISTRITO_INDUSTRIAL.contorno);
const UTILIDADES = plano(ZONA_UTILIDADES.contorno);

/** true se (x, z) está no Distrito Industrial. */
export const noDistrito = (x, z) => pontoNoPoligono(x, z, DISTRITO);

/** true se (x, z) está na Zona de Utilidades. */
export const naUtilidades = (x, z) => pontoNoPoligono(x, z, UTILIDADES);

/** true se o tipo de colocável só vale na Zona de Utilidades (campo `zona` do catálogo ou a lista de data/zon2.js). */
export const ehUtilidade = (tipo) => SERVICOS[tipo]?.zona === 'utilidades' || TIPOS_UTILIDADES.includes(tipo);

/** true se o tipo só vale no Distrito Industrial (prédio da Holding com `zona: 'industrial'`). */
export const ehIndustrial = (tipo) => PREDIOS_HOLDING[tipo]?.zona === 'industrial';

const dentro = (poli, contorno) => {
  for (let k = 0; k < contorno.length; k += 2) if (!pontoNoPoligono(contorno[k], contorno[k + 1], poli)) return false;
  return true;
};

/**
 * Confere o lugar de um colocável pela regra da ZON2: null se pode, senão { codigo, dados } ('utilidades' ou 'distrito').
 * A planta inteira (os quatro cantos e o centro) tem de estar dentro da área.
 */
export function conferirLugar(tipo, L) {
  if (!REGRAS_DE_LUGAR) return null;
  const util = ehUtilidade(tipo);
  const ind = !util && ehIndustrial(tipo);
  if (!util && !ind) return null;
  const poli = util ? UTILIDADES : DISTRITO;
  if (dentro(poli, L.contorno) && pontoNoPoligono(L.x, L.z, poli)) return null;
  const area = util ? ZONA_UTILIDADES : DISTRITO_INDUSTRIAL;
  return { codigo: util ? 'utilidades' : 'distrito', dados: { area: area.id, nome: area.nome } };
}

/** Células (idx) da lista cujo centro está no Distrito Industrial. */
export function celulasNoDistrito(sim, lista) {
  const C = sim.tabelas.celulas;
  return lista.filter((c) => noDistrito(C.x[c], C.z[c]));
}

// ------------------------------------------------------------------------------------------------ rede de longo alcance

const categoriaDe = (tipo) => SERVICOS[tipo]?.categoria ?? null;

/** Nó (idx) mais perto de (x, z) entre os de vias com canos e cabos, ou -1; d é a distância em metros. */
export function noComRedeMaisPerto(sim, x, z) {
  const A = sim.tabelas.arestas;
  const N = sim.tabelas.nos;
  let melhor = -1;
  let md = Infinity;
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e] || !VIAS[VIAS_ORDEM[A.tipo[e]]]?.redes) continue;
    for (const i of [A.a[e], A.b[e]]) {
      const dx = N.x[i] - x;
      const dz = N.z[i] - z;
      const d = dx * dx + dz * dz;
      if (d < md || (d === md && i < melhor)) {
        md = d;
        melhor = i;
      }
    }
  }
  return { no: melhor, d: melhor < 0 ? Infinity : Math.sqrt(md) };
}

/**
 * A linha de longo alcance de um produtor de rede (água, energia ou esgoto) na Zona de Utilidades cuja via de acesso `e`
 * não leva canos e cabos: { rec, metros, custo, no, alcanca } (alcanca: o nó mais perto está no alcance máximo). null se
 * não vale (o tipo não é produtor, está fora da zona ou a via dele já tem redes).
 */
export function linhaLonga(sim, tipo, x, z, e) {
  const cat = categoriaDe(tipo);
  if (!REGRAS_DE_LUGAR || !cat || !CATEGORIAS_SERVICO[cat]?.rede || !naUtilidades(x, z)) return null;
  const A = sim.tabelas.arestas;
  if (e >= 0 && A.viva[e] && VIAS[VIAS_ORDEM[A.tipo[e]]]?.redes) return null;
  const { no, d } = noComRedeMaisPerto(sim, x, z);
  const metros = no < 0 ? 0 : Math.round(d);
  const alcanca = no >= 0 && d <= LONGO_ALCANCE.alcanceMax;
  const custo = alcanca ? Math.round(metros * (LONGO_ALCANCE.custoPorMetro[cat] ?? 0)) : 0;
  return { rec: cat, metros, custo, no, alcanca };
}

// ------------------------------------------------------------------------------------------------ estado

/** A seção JSON 'zon2' (criada na primeira vez). */
export function estadoZon2(sim) {
  return sim.json.zon2 ?? sim.registrarJson('zon2', { modo: {}, pedido: {}, espera: {}, linhas: {} });
}

/** Guarda a linha paga de um produtor recém-construído (ref) e a tira ao demolir. */
export function guardarLinha(sim, ref, linha) {
  estadoZon2(sim).linhas[ref] = { rec: linha.rec, metros: linha.metros, custo: linha.custo };
}
export function tirarLinha(sim, ref) {
  if (sim.json.zon2) delete sim.json.zon2.linhas[ref];
}

/** Id da zona (string) por índice ou por id; null se não é uma zona pintável. */
export function idDaZona(z) {
  const id = typeof z === 'number' ? ZONAS_ORDEM[z] : z;
  return id && ZONAS[id] ? id : null;
}

export const modoDe = (sim, id) => sim.json.zon2?.modo?.[id] ?? MODO_PADRAO;
export const pedidoDe = (sim, id) => sim.json.zon2?.pedido?.[id] ?? 0;
export const esperaDe = (sim, id) => sim.json.zon2?.espera?.[id] ?? 0;

/**
 * Troca o modo de uma zona (comando e pintura). Do automático para o manual, o que a demanda tinha acumulado (acum, até 3)
 * vira espera; do manual para o automático, o lote que sobrava é cancelado e a espera volta ao acumulador (até 3).
 * Devolve { mudou, cancelados }.
 */
export function definirModo(sim, id, modo) {
  const E = estadoZon2(sim);
  const antes = modoDe(sim, id);
  if (antes === modo) return { mudou: false, cancelados: 0 };
  const acum = sim.json.cidade?.acum;
  let cancelados = 0;
  if (modo === 'manual') {
    E.espera[id] = Math.max(E.espera[id] ?? 0, acum?.[id] ?? 0);
    if (acum) acum[id] = 0;
    E.modo[id] = 'manual';
  } else {
    cancelados = E.pedido[id] ?? 0;
    if (acum) acum[id] = Math.min(3, E.espera[id] ?? 0);
    delete E.pedido[id];
    delete E.espera[id];
    delete E.modo[id];
  }
  return { mudou: true, cancelados };
}

// ------------------------------------------------------------------------------------------------ comandos

/** zona.modo { zona, modo }: automático ou manual. */
function cmdModo(sim, args) {
  const id = idDaZona(args?.zona);
  if (!id || !MODOS_CRESCIMENTO.includes(args?.modo)) return { ok: false, codigo: 'valor' };
  const r = definirModo(sim, id, args.modo);
  if (!r.mudou) return { ok: false, codigo: 'nada' };
  return { ok: true, dados: { zona: ZONAS_ORDEM.indexOf(id), id, modo: args.modo, cancelados: r.cancelados } };
}

/**
 * zona.lote { zona, n }: pede n construções (1 a 1000) à zona em modo Manual; soma ao que já estava pedido, até 1000 no
 * total. n = 0 cancela o que falta. Em modo Automático recusa com 'modo'.
 */
function cmdLote(sim, args) {
  const id = idDaZona(args?.zona);
  const n = args?.n;
  if (!id || !Number.isInteger(n)) return { ok: false, codigo: 'valor' };
  if (modoDe(sim, id) !== 'manual') return { ok: false, codigo: 'modo' };
  const E = estadoZon2(sim);
  const falta = E.pedido[id] ?? 0;
  if (n === 0) {
    if (!falta) return { ok: false, codigo: 'nada' };
    delete E.pedido[id];
    return { ok: true, dados: { zona: ZONAS_ORDEM.indexOf(id), id, pedido: 0, cancelados: falta } };
  }
  if (n < LOTE_MIN || n > LOTE_MAX || falta + n > LOTE_MAX) return { ok: false, codigo: 'lote' };
  E.pedido[id] = falta + n;
  return { ok: true, dados: { zona: ZONAS_ORDEM.indexOf(id), id, pedido: E.pedido[id], cancelados: 0 } };
}

// ------------------------------------------------------------------------------------------------ consultas

/** Prédios de zona por tipo de zona: { construidos, emObra }. */
function contarPredios(sim) {
  const P = sim.tabelas.predios;
  const out = {};
  for (let i = 0; i < P.n; i++) {
    if (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.ZONA) continue;
    const id = ZONAS_ORDEM[P.zona[i]];
    if (!id) continue;
    const c = (out[id] ??= { construidos: 0, emObra: 0 });
    if (P.flags[i] & PREDIO.OBRA && !(P.flags[i] & PREDIO.OBRA_NIVEL)) c.emObra++;
    else c.construidos++;
  }
  return out;
}

/**
 * q.zona.crescimento({ zona? }) → um item por tipo de zona da parte do jogo (ou só o pedido, ou null):
 * { zona (índice), id, nome, familia, modo, pedido (construções que faltam do lote), espera (o que a demanda acumulou,
 * em construções), demanda (0 a 100), frentes (frentes livres pintadas), construidos, emObra }.
 */
function consultaCrescimento(sim, args) {
  const contagem = contarPredios(sim);
  const frentes = frentesLivres(sim);
  const item = (id) => ({
    zona: ZONAS_ORDEM.indexOf(id), id, nome: ZONAS[id].nome, familia: ZONAS[id].familia, modo: modoDe(sim, id),
    pedido: pedidoDe(sim, id), espera: Math.round(esperaDe(sim, id) * 10) / 10, demanda: Math.round(sim.json.cidade?.demanda?.[id] ?? 0),
    frentes: frentes[id] ?? 0, construidos: contagem[id]?.construidos ?? 0, emObra: contagem[id]?.emObra ?? 0,
  });
  if (args && args.zona !== undefined) {
    const id = idDaZona(args.zona);
    return id ? item(id) : null;
  }
  return ZONAS_ORDEM.filter((id) => id && zonaNaParte(id)).map(item);
}

const contornoPares = (c) => c.map((p) => [p[0], p[1]]);

/** q.zona.regras() → as áreas, o vento, os tipos restritos, o custo da rede de longo alcance e os limites do lote. */
function consultaRegras() {
  return {
    ligadas: REGRAS_DE_LUGAR,
    distrito: { id: DISTRITO_INDUSTRIAL.id, nome: DISTRITO_INDUSTRIAL.nome, contorno: contornoPares(DISTRITO_INDUSTRIAL.contorno), zonas: Object.keys(ZONAS).filter((id) => ZONAS[id].zona === 'industrial'), tipos: Object.keys(PREDIOS_HOLDING).filter(ehIndustrial) },
    utilidades: { id: ZONA_UTILIDADES.id, nome: ZONA_UTILIDADES.nome, contorno: contornoPares(ZONA_UTILIDADES.contorno), tipos: [...new Set([...Object.keys(SERVICOS).filter(ehUtilidade), ...TIPOS_UTILIDADES])] },
    vento: { de: VENTO_PREDOMINANTE.de, para: VENTO_PREDOMINANTE.para, angulo: VENTO_PREDOMINANTE.angulo },
    longoAlcance: { custoPorMetro: { ...LONGO_ALCANCE.custoPorMetro }, alcanceMax: LONGO_ALCANCE.alcanceMax },
    modos: [...MODOS_CRESCIMENTO],
    lote: { min: LOTE_MIN, max: LOTE_MAX },
  };
}

/** q.zona.lugar({ x, z }) → { distrito, utilidades } (o ponto está em cada área?); para a dica ao passar o mouse. */
function consultaLugar(sim, args) {
  const { x, z } = args ?? {};
  if (!Number.isFinite(x) || !Number.isFinite(z)) return { distrito: false, utilidades: false };
  return { distrito: noDistrito(x, z), utilidades: naUtilidades(x, z) };
}

export function registrar(sim) {
  estadoZon2(sim);
  sim.registrarComando('zona.modo', cmdModo);
  sim.registrarComando('zona.lote', cmdLote);
  sim.registrarConsulta('zona.crescimento', consultaCrescimento);
  sim.registrarConsulta('zona.regras', () => consultaRegras());
  sim.registrarConsulta('zona.lugar', consultaLugar);
}
