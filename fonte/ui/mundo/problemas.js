// Problemas da cidade (aba Problemas da tela Cidade; X3b; D29, D41): junta os alertas da cidade (q.barra().alertas) e os
// avisos de prédio (q.avisosPredios()) numa lista só, agrupada, ordenada por gravidade e com o alvo de cada problema.
// Sem Preact (os testes importam no Node): a frase do alerta vem de fora (textoAlerta, da faixa de alerta).
//   - um alerta da cidade que cobre um grupo de prédios (falta de água, de energia, de esgoto, obras paradas...) fica com
//     os prédios do grupo como alvos: "Ver na camada" vai ao primeiro, e de novo ao seguinte, e assim por diante
//   - os avisos de prédio que nenhum alerta cobre viram "<frase>: N", um grupo por tipo e gravidade
//   - a ordem é grave, atenção, informação; dentro da gravidade, a maior contagem primeiro
import { CAMADA_DO_ALERTA } from './camadas.js';

export const PESO_GRAVIDADE = Object.freeze({ grave: 3, atencao: 2, info: 1 });
const GRAVIDADES = ['info', 'atencao', 'grave'];
/** Teto de alvos guardados por problema (a lista de prédios; o resto não muda o "Próximo"). */
export const MAX_ALVOS = 400;

/**
 * Grupos de aviso de prédio: "<glifo>.<gravidade>" -> { texto (chave), camada }. O glifo e a gravidade vêm de
 * q.avisosPredios() (um aviso por prédio, o pior); a mesma pista separa o "perto do abandono" (alerta, atenção) do ar e do
 * ruído (alerta, informação).
 */
export const GRUPOS_PREDIO = Object.freeze({
  'abandonado.grave': { texto: 'x3.prob.abandonado', camada: 'bemEstar' },
  'alerta.grave': { texto: 'x3.prob.quaseAbandonado', camada: 'bemEstar' },
  'alerta.atencao': { texto: 'x3.prob.pertoAbandono', camada: 'bemEstar' },
  'alerta.info': { texto: 'x3.prob.arRuido', camada: 'ar' },
  'semAgua.grave': { texto: 'x3.prob.semAgua', camada: 'agua' },
  'semEnergia.grave': { texto: 'x3.prob.semEnergia', camada: 'energia' },
  'semEnergia.atencao': { texto: 'x3.prob.racionado', camada: 'energia' },
  'semVia.grave': { texto: 'x3.prob.semAcesso', camada: 'zonas' },
  'esgoto.grave': { texto: 'x3.prob.semEsgoto', camada: 'esgoto' },
  'semMaterial.atencao': { texto: 'x3.prob.semMaterial', camada: 'recursos' },
  'semTrabalhadores.atencao': { texto: 'x3.prob.semTrabalhadores', camada: 'empregos' },
  'poucosClientes.atencao': { texto: 'x3.prob.poucosClientes', camada: 'zonas' },
  'trabalho.info': { texto: 'x3.prob.semEmprego', camada: 'empregos' },
  'bemEstarRuim.info': { texto: 'x3.prob.bemEstarBaixo', camada: 'bemEstar' },
});

/** Grupos de prédio que um alerta da cidade já descreve (o alerta absorve o grupo e herda os prédios como alvos). */
export const ALERTA_COBRE = Object.freeze({
  faltaAgua: ['semAgua.grave'],
  faltaEnergia: ['semEnergia.grave'],
  faltaEsgoto: ['esgoto.grave'],
  abandonoPerto: ['alerta.atencao', 'alerta.grave'],
  obrasParadas: ['semMaterial.atencao'],
  faltamTrabalhadores: ['semTrabalhadores.atencao'],
  desempregoAlto: ['trabalho.info'],
  poluicaoAr: ['alerta.info'],
});

const graveDe = (g) => (g in PESO_GRAVIDADE ? g : 'atencao');

/**
 * Lista de problemas: [{ id, origem: 'cidade' | 'predios', gravidade, texto, glifo, camada (id ou null), n (prédios, 0 sem
 * contagem), alvos: [{ x, z }] }].
 *   alertas: q.barra().alertas; avisos: q.avisosPredios(); predios: o espelho (x, z por índice); textoAlerta(alerta) e
 *   t(chave, params) dão as frases.
 */
export function listarProblemas({ alertas = [], avisos = null, predios = null, textoAlerta, t }) {
  // prédios por grupo
  const grupos = new Map();
  if (avisos?.idx?.length) {
    const nomes = avisos.nomes ?? [];
    for (let k = 0; k < avisos.idx.length; k++) {
      const nome = nomes[avisos.glifo[k]];
      const g = GRAVIDADES[avisos.gravidade[k]];
      if (!nome || !g) continue;
      const chave = `${nome}.${g}`;
      let e = grupos.get(chave);
      if (!e) grupos.set(chave, (e = { chave, gravidade: g, nome, idx: [] }));
      e.idx.push(avisos.idx[k]);
    }
  }
  const alvoDe = (i) => (predios && i < predios.n && Number.isFinite(predios.x?.[i]) ? { x: Math.round(predios.x[i]), z: Math.round(predios.z[i]) } : null);
  const alvosDe = (grupo) => grupo.idx.slice(0, MAX_ALVOS).map(alvoDe).filter(Boolean);
  const absorvidos = new Set();
  const lista = [];
  for (const a of Array.isArray(alertas) ? alertas : []) {
    if (!a?.codigo) continue;
    const g = graveDe(a.gravidade);
    const alvos = [];
    let n = 0;
    for (const chave of ALERTA_COBRE[a.codigo] ?? []) {
      const e = grupos.get(chave);
      if (!e) continue;
      absorvidos.add(chave);
      n += e.idx.length;
      alvos.push(...alvosDe(e));
    }
    if (!alvos.length && Number.isFinite(a.alvo?.x) && Number.isFinite(a.alvo?.z)) alvos.push({ x: a.alvo.x, z: a.alvo.z });
    lista.push({
      id: `alerta.${a.codigo}`, origem: 'cidade', gravidade: g, texto: textoAlerta ? textoAlerta(a) : a.codigo, glifo: a.glifo ?? 'alerta',
      camada: CAMADA_DO_ALERTA[a.codigo] ?? null, n, alvos: alvos.slice(0, MAX_ALVOS), tela: typeof a.alvo?.tela === 'string' ? a.alvo.tela : null,
    });
  }
  for (const e of grupos.values()) {
    if (absorvidos.has(e.chave)) continue;
    const def = GRUPOS_PREDIO[e.chave];
    lista.push({
      id: `predios.${e.chave}`, origem: 'predios', gravidade: e.gravidade, texto: t(def?.texto ?? `x3.prob.generico.${e.gravidade}`, { n: e.idx.length }),
      glifo: e.nome, camada: def?.camada ?? null, n: e.idx.length, alvos: alvosDe(e), tela: null,
    });
  }
  return ordenarProblemas(lista);
}

/** Grave, atenção, informação; dentro da gravidade, mais prédios primeiro; empate, a ordem em que chegaram (estável). */
export function ordenarProblemas(l) {
  return l
    .map((p, i) => [p, i])
    .sort((a, b) => (PESO_GRAVIDADE[b[0].gravidade] ?? 0) - (PESO_GRAVIDADE[a[0].gravidade] ?? 0) || b[0].n - a[0].n || a[1] - b[1])
    .map(([p]) => p);
}

/** O problema depois do atual (volta ao primeiro no fim); sem lista, -1. */
export const proximoProblema = (lista, atual) => (lista.length ? (atual + 1 + lista.length) % lista.length : -1);

/** Conta por gravidade: { grave, atencao, info, total }. */
export function contarProblemas(lista) {
  const c = { grave: 0, atencao: 0, info: 0, total: 0 };
  for (const p of lista) {
    c[p.gravidade] += 1;
    c.total += 1;
  }
  return c;
}

/**
 * "Ver na camada" de um problema (puro): o que fazer com o jogo. Devolve { camada, alvo, tela }: a camada a ligar (ou
 * null), o ponto a centralizar (o alvo `vez` da lista, voltando ao primeiro) e a tela de gestão do alerta, se não tem ponto.
 */
export function destinoDoProblema(p, vez = 0) {
  if (!p) return null;
  const alvo = p.alvos?.length ? p.alvos[vez % p.alvos.length] : null;
  return { camada: p.camada ?? null, alvo, tela: alvo ? null : p.tela ?? null };
}
