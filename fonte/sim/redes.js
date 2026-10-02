// Redes de água e energia (seção 8.2 do desenho da simulação, D52; dona: S2a). Canos e cabos correm nas vias com
// calçada (VIAS[tipo].redes): cada componente conexo dessas vias tem a oferta dos produtores ligados a ele (captação,
// poço e usina solar, os produtores registrados por sim.redes.produtor, como o reservatório da X1b, e a energia da
// rodovia pelo nó de entrada, até 5 MW, a preço por kW) e a demanda dos prédios ligados. Se a oferta não cobre, os
// prédios mais distantes dos produtores pela rede ficam sem o recurso (racionados) até a demanda caber: o problema
// aparece nas pontas, não sorteado. Prédio sem via com redes fica sem ligação. Balanço uma vez por rodada.
//
// Componentes e distâncias são função pura do grafo e dos produtores (refeitos quando um dos dois muda); os bits de
// cada prédio (SEM_AGUA, SEM_ENERGIA, RACIONADO) e os totais vão no save.
import { RODADA } from '../comum/relogio.js';
import { montarCSR } from '../comum/caminhos.js';
import { idxDaRef } from '../contratos/espelho.js';
import { PREDIO, TIPO_PREDIO } from '../contratos/flags.js';
import { ORDEM } from '../contratos/interno.js';
import { VIAS, VIAS_ORDEM } from '../data/vias.js';
import { SERVICOS, SERVICOS_ORDEM, LIGACAO_EXTERNA } from '../data/servicos.js';
import { noDeEntrada } from './mundo/vila.js';
import {
  prepararCidade, trans, acessoDe, garantirAcessos, funciona, tipoDoPredio, nivelZona, FAMILIA_ZONA, registrarPartePredio,
  registrarAlertas,
} from './predios.js';
import { ocupacaoDe, registrarParteCidade } from './cidadaos.js';
import { buscar, pessoalEPagamento } from './servicos.js';

export const RECURSOS_REDE = Object.freeze(['agua', 'energia']);
const BIT_SEM = { agua: PREDIO.SEM_AGUA, energia: PREDIO.SEM_ENERGIA };
/** Consumo de um prédio da Holding por vaga, quando o catálogo dele não diz. (calibrar) */
const CONSUMO_HOLDING = { agua: 0.004, energia: 3 };

const COM_REDES = Uint8Array.from(VIAS_ORDEM, (id) => (VIAS[id]?.redes ? 1 : 0));
const temRedes = (A, e) => e >= 0 && A.viva[e] === 1 && COM_REDES[A.tipo[e]] === 1;

// ------------------------------------------------------------------------------------------------ derivados

/** Nó (idx) de um produtor registrado: ref de nó viva, idx vivo, ou o nó mais perto de { x, z }. */
function noDoProdutor(sim, p) {
  const N = sim.tabelas.nos;
  const no = p.no;
  if (Number.isInteger(no) && no >= 0) {
    if (no >= 1048576 && N.vivaRef(no)) return idxDaRef(no);
    if (no < N.n && N.viva[no]) return no;
  }
  if (Number.isFinite(p.x) && Number.isFinite(p.z) && sim.grafo) {
    let melhor = -1;
    let md = Infinity;
    for (let i = 0; i < N.n; i++) {
      if (!N.viva[i]) continue;
      const dx = N.x[i] - p.x;
      const dz = N.z[i] - p.z;
      const d = dx * dx + dz * dz;
      if (d < md) {
        md = d;
        melhor = i;
      }
    }
    return melhor;
  }
  return -1;
}

const AC = { e: -1, s: 0 };

/** Produtores de um recurso: [{ i (prédio ou -1), id (registro), no, s, cap }] com o nó de ligação. */
function produtoresDe(sim, rec) {
  const P = sim.tabelas.predios;
  const A = sim.tabelas.arestas;
  const out = [];
  for (let i = 0; i < P.n; i++) {
    if (P.tipo[i] !== TIPO_PREDIO.SERVICO || !funciona(P, i)) continue;
    const def = SERVICOS[SERVICOS_ORDEM[P.modelo[i]]];
    if (def?.categoria !== rec) continue;
    acessoDe(sim, i, AC);
    if (!temRedes(A, AC.e)) continue;
    const comp = A.arco[17 * AC.e + 16];
    out.push({ i, id: null, no: AC.s <= comp / 2 ? A.a[AC.e] : A.b[AC.e], cap: def.capacidade });
  }
  for (const p of sim.redes.produtores(rec)) {
    const no = noDoProdutor(sim, p);
    if (no >= 0) out.push({ i: -1, id: p.id, no, cap: +p.capacidade || 0 });
  }
  return out;
}

/** Garante componentes e distâncias das redes. Devolve { comp, nComp, dist: { agua, energia }, prod, entrada }. */
export function garantirRedes(sim) {
  const t = trans(sim);
  const N = sim.tabelas.nos;
  if (t.redes && !t.redesSujas && t.redes.nNos === N.n) return t.redes;
  t.redesSujas = false;
  const A = sim.tabelas.arestas;
  // componentes pelas vias com redes
  const pai = new Int32Array(N.n);
  for (let i = 0; i < N.n; i++) pai[i] = i;
  const raiz = (i) => {
    while (pai[i] !== i) {
      pai[i] = pai[pai[i]];
      i = pai[i];
    }
    return i;
  };
  const de = [];
  const para = [];
  const peso = [];
  const tem = new Uint8Array(N.n);
  for (let e = 0; e < A.n; e++) {
    if (!temRedes(A, e)) continue;
    const a = A.a[e];
    const b = A.b[e];
    tem[a] = tem[b] = 1;
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra !== rb) {
      if (ra < rb) pai[rb] = ra;
      else pai[ra] = rb;
    }
    const w = A.arco[17 * e + 16];
    de.push(a, b);
    para.push(b, a);
    peso.push(w, w);
  }
  const comp = new Int32Array(N.n).fill(-1);
  const rot = new Int32Array(N.n).fill(-1);
  let nComp = 0;
  for (let i = 0; i < N.n; i++) {
    if (!N.viva[i] || !tem[i]) continue;
    const r = raiz(i);
    if (rot[r] < 0) rot[r] = nComp++;
    comp[i] = rot[r];
  }
  const csr = montarCSR(N.n, de, para, peso);
  const prod = {};
  const dist = {};
  for (const rec of RECURSOS_REDE) {
    prod[rec] = produtoresDe(sim, rec);
    const d = new Float64Array(N.n);
    const r = new Int32Array(N.n);
    const fontes = prod[rec].filter((p) => comp[p.no] >= 0).map((p, k) => [p.no, 0, k]);
    const ent = rec === 'energia' && LIGACAO_EXTERNA.energia > 0 ? noDeEntrada(sim) : -1;
    if (ent >= 0 && comp[ent] >= 0) fontes.push([ent, 0, fontes.length]);
    buscar(csr, fontes, Infinity, d, r);
    dist[rec] = d;
  }
  const entrada = noDeEntrada(sim);
  t.redes = { nNos: N.n, comp, nComp, dist, prod, entrada: entrada >= 0 && comp[entrada] >= 0 ? entrada : -1 };
  return t.redes;
}

// ------------------------------------------------------------------------------------------------ consumo e balanço

/** Consumo do prédio i (m³/h de água ou kW de energia) no estado de agora. */
export function consumoDe(sim, i, rec) {
  const P = sim.tabelas.predios;
  if (!funciona(P, i)) return 0;
  if (P.tipo[i] === TIPO_PREDIO.ZONA) {
    const nv = nivelZona(P, i);
    if (!nv) return 0;
    if (FAMILIA_ZONA[P.zona[i]] === 'res') return nv.moradores ? (nv[rec] * P.moradores[i]) / nv.moradores : 0;
    return nv[rec] * ocupacaoDe(sim, i).frac;
  }
  const k = tipoDoPredio(sim, i);
  const c = k.def?.consumo?.[rec];
  if (Number.isFinite(c)) return c;
  if (k.tipo === 'holding') return ocupacaoDe(sim, i).vagas * CONSUMO_HOLDING[rec];
  return 0;
}

/** Consumo de água (out[0]) e de energia (out[1]) do prédio i, na mesma conta de consumoDe (uma passada só). */
function consumos(sim, P, i, out) {
  out[0] = 0;
  out[1] = 0;
  if (!funciona(P, i)) return out;
  if (P.tipo[i] === TIPO_PREDIO.ZONA) {
    const nv = nivelZona(P, i);
    if (!nv) return out;
    if (FAMILIA_ZONA[P.zona[i]] === 'res') {
      if (nv.moradores) {
        out[0] = (nv.agua * P.moradores[i]) / nv.moradores;
        out[1] = (nv.energia * P.moradores[i]) / nv.moradores;
      }
      return out;
    }
    const f = ocupacaoDe(sim, i).frac;
    out[0] = nv.agua * f;
    out[1] = nv.energia * f;
    return out;
  }
  out[0] = consumoDe(sim, i, 'agua');
  out[1] = consumoDe(sim, i, 'energia');
  return out;
}

const CO = [0, 0];
const QDIST = 1073741824; // 2^30: distâncias até 67 mil km em 1/16 de metro
const IDX_BASE = 2097152; // 2^21: acima de qualquer idx de prédio (o teto da tabela é 2^20)

/**
 * Balanço das redes (uma vez por rodada): oferta e demanda por componente, energia da rodovia até 5 MW no componente
 * do nó de entrada, racionamento dos mais distantes. Escreve os bits dos prédios e S.agregados.redes.
 */
export function sistemaRedes(sim) {
  const R = garantirRedes(sim);
  const P = sim.tabelas.predios;
  const A = sim.tabelas.arestas;
  const ag = sim.agregados;
  const n = P.n;
  const novos = new Uint32Array(n);
  const consumo = { agua: new Float32Array(n), energia: new Float32Array(n) };
  const compDe = new Int32Array(n).fill(-1);
  const distDe = { agua: new Float64Array(n), energia: new Float64Array(n) };
  const cA = consumo.agua;
  const cE = consumo.energia;
  const dA = distDe.agua;
  const dE = distDe.energia;
  const rA = R.dist.agua;
  const rE = R.dist.energia;
  garantirAcessos(sim);
  const t = trans(sim);
  for (let i = 0; i < n; i++) {
    if (!P.viva[i]) continue;
    let e = t.viaE[i];
    let s = t.viaS[i];
    if (t.viaGer[i] !== P.ger[i]) {
      acessoDe(sim, i, AC);
      e = AC.e;
      s = AC.s;
    }
    if (temRedes(A, e)) {
      const a = A.a[e];
      const b = A.b[e];
      compDe[i] = R.comp[a];
      const resto = Math.max(0, A.arco[17 * e + 16] - s);
      dA[i] = Math.min(rA[a] + s, rA[b] + resto);
      dE[i] = Math.min(rE[a] + s, rE[b] + resto);
    }
    consumos(sim, P, i, CO);
    cA[i] = CO[0];
    cE[i] = CO[1];
  }
  let importado = 0;
  for (const rec of RECURSOS_REDE) {
    const cons = consumo[rec];
    const bit = BIT_SEM[rec];
    const oferta = new Float64Array(R.nComp);
    const demanda = new Float64Array(R.nComp);
    for (const p of R.prod[rec]) {
      const c = R.comp[p.no];
      if (c < 0) continue;
      oferta[c] += p.i >= 0 ? p.cap * pessoalEPagamento(sim, p.i) : p.cap;
    }
    for (let i = 0; i < P.n; i++) if (cons[i] > 0 && compDe[i] >= 0) demanda[compDe[i]] += cons[i];
    // energia de fora: só o que falta, até o teto, no componente do nó de entrada (D52)
    const imp = new Float64Array(R.nComp);
    if (rec === 'energia' && R.entrada >= 0) {
      const c = R.comp[R.entrada];
      imp[c] = Math.min(LIGACAO_EXTERNA.energia, Math.max(0, demanda[c] - oferta[c]));
      importado = imp[c];
    }
    // racionamento: em cada componente com falta, corta dos mais distantes até caber (sem oferta nenhuma, corta todos)
    const cortar = new Uint8Array(P.n);
    const falta = new Uint8Array(R.nComp);
    let algum = false;
    for (let c = 0; c < R.nComp; c++) {
      if (demanda[c] > oferta[c] + imp[c] + 1e-9) {
        falta[c] = oferta[c] + imp[c] > 0 ? 2 : 1;
        algum = true;
      }
    }
    if (algum) {
      const listas = new Map();
      for (let i = 0; i < P.n; i++) {
        const c = compDe[i];
        if (c < 0 || !falta[c] || !(cons[i] > 0)) continue;
        if (falta[c] === 1) cortar[i] = 1;
        else {
          let l = listas.get(c);
          if (!l) listas.set(c, (l = []));
          l.push(i);
        }
      }
      const dd = distDe[rec];
      for (const [c, lista] of [...listas].sort((a, b) => a[0] - b[0])) {
        // do mais distante (em 1/16 de metro) ao mais perto, o menor idx primeiro no empate: chave numérica num
        // Float64Array (a ordenação nativa, sem comparador)
        const chaves = new Float64Array(lista.length);
        for (let k = 0; k < lista.length; k++) {
          const q = Math.min(QDIST, Math.round(dd[lista[k]] * 16));
          chaves[k] = (QDIST - q) * IDX_BASE + lista[k];
        }
        chaves.sort();
        const tem = oferta[c] + imp[c];
        let resta = demanda[c];
        for (let k = 0; k < chaves.length; k++) {
          if (resta <= tem + 1e-9) break;
          const i = chaves[k] % IDX_BASE;
          cortar[i] = 1;
          resta -= cons[i];
        }
      }
    }
    let ofT = 0;
    let deT = 0;
    for (let c = 0; c < R.nComp; c++) {
      ofT += oferta[c] + imp[c];
      deT += demanda[c];
    }
    // os prédios sem ligação também pedem (aparecem na demanda da cidade)
    for (let i = 0; i < P.n; i++) {
      if (!(cons[i] > 0)) continue;
      if (compDe[i] < 0) {
        deT += cons[i];
        novos[i] |= bit;
      } else if (cortar[i]) {
        novos[i] |= bit | (oferta[compDe[i]] + imp[compDe[i]] > 0 ? PREDIO.RACIONADO : 0);
      }
    }
    ag.redes[rec].oferta = Math.round(ofT * 100) / 100;
    ag.redes[rec].demanda = Math.round(deT * 100) / 100;
  }
  ag.redes.importado.energia = Math.round(importado * 10) / 10;
  // bits dos prédios: marca só quem mudou
  const mascara = PREDIO.SEM_AGUA | PREDIO.SEM_ENERGIA | PREDIO.RACIONADO;
  for (let i = 0; i < P.n; i++) {
    if (!P.viva[i]) continue;
    const f = P.flags[i];
    const nf = (f & ~mascara) | novos[i];
    if (nf !== f) {
      P.flags[i] = nf;
      P.marcar(i);
    }
  }
}

/**
 * true se o prédio i tem acesso por uma via com canos e cabos. Fora dela (as ruas de terra da Vila, D52) a falta é da
 * rua e não da rede: tira bem-estar e trava o nível, mas não conta para o abandono (melhorar a rua liga o prédio).
 */
export function naRede(sim, i) {
  acessoDe(sim, i, AC);
  return temRedes(sim.tabelas.arestas, AC.e);
}

/** true se a aresta e está numa rede com quem produza o recurso (a prévia de zona usa). */
export function temOferta(sim, e, rec) {
  const A = sim.tabelas.arestas;
  if (!temRedes(A, e)) return false;
  const R = garantirRedes(sim);
  const c = R.comp[A.a[e]];
  if (c < 0) return false;
  if (rec === 'energia' && R.entrada >= 0 && R.comp[R.entrada] === c) return true;
  return R.prod[rec].some((p) => R.comp[p.no] === c);
}

/** Estado da rede de um recurso no prédio i: 'ok' | 'racionado' | 'sem' | null (não consome). */
export function estadoRede(sim, i, rec) {
  const P = sim.tabelas.predios;
  if (!funciona(P, i)) return null;
  const f = P.flags[i];
  if (!(f & BIT_SEM[rec])) return consumoDe(sim, i, rec) > 0 || P.tipo[i] === TIPO_PREDIO.ZONA ? 'ok' : null;
  return f & PREDIO.RACIONADO ? 'racionado' : 'sem';
}

// ------------------------------------------------------------------------------------------------ camadas, partes, alertas

function camadaRede(rec) {
  return (sim) => {
    const P = sim.tabelas.predios;
    const dados = new Float32Array(P.n);
    for (let i = 0; i < P.n; i++) {
      if (!P.viva[i]) continue;
      if (P.tipo[i] === TIPO_PREDIO.SERVICO && SERVICOS[SERVICOS_ORDEM[P.modelo[i]]]?.categoria === rec) {
        dados[i] = 4;
        continue;
      }
      const e = estadoRede(sim, i, rec);
      dados[i] = e === 'ok' ? 1 : e === 'racionado' ? 2 : e === 'sem' ? 3 : 0;
    }
    const ag = sim.agregados.redes;
    const cats = [
      { v: 1, chave: `camada.${rec}.ok` }, { v: 2, chave: `camada.${rec}.racionado` }, { v: 3, chave: `camada.${rec}.sem` },
      { v: 4, chave: `camada.${rec}.produtor` },
    ];
    return {
      id: rec, fonte: 'predios', dados, grade: null, tipo: 'cat', escala: { min: 0, max: 4, unidade: rec === 'agua' ? 'm³/h' : 'kW' },
      categorias: cats, legenda: cats,
      resumo: { chave: `camada.${rec}.resumo`, params: { oferta: ag[rec].oferta, demanda: ag[rec].demanda, importado: rec === 'energia' ? ag.importado.energia : 0 } },
      versao: sim.json.cidade.rodada,
    };
  };
}

function partePredio(sim, i, out) {
  out.servicos = { ...(out.servicos ?? {}), agua: estadoRede(sim, i, 'agua'), energia: estadoRede(sim, i, 'energia'), esgoto: null };
}

function parteCidade(sim, out) {
  const R = garantirRedes(sim);
  out.ligacaoExterna = { energia: { teto: LIGACAO_EXTERNA.energia, usado: sim.agregados.redes.importado.energia, ligada: R.entrada >= 0 } };
}

function alertasRedes(sim) {
  const P = sim.tabelas.predios;
  const out = [];
  for (const rec of RECURSOS_REDE) {
    let n = 0;
    let rac = 0;
    let total = 0;
    let alvo = null;
    for (let i = 0; i < P.n; i++) {
      if (!P.viva[i] || !funciona(P, i)) continue;
      total++;
      if (!(P.flags[i] & BIT_SEM[rec])) continue;
      n++;
      if (P.flags[i] & PREDIO.RACIONADO) rac++;
      if (!alvo) alvo = { x: P.x[i], z: P.z[i] };
    }
    if (!n) continue;
    const ag = sim.agregados.redes[rec];
    out.push({
      id: rec, gravidade: n > 0.1 * total ? 'grave' : 'atencao', glifo: rec === 'agua' ? 'semAgua' : 'semEnergia',
      codigo: rec === 'agua' ? 'faltaAgua' : 'faltaEnergia', params: { n, racionados: rac, oferta: ag.oferta, demanda: ag.demanda }, alvo,
    });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ registro

export function registrar(sim) {
  if (!sim.tabelas.predios || !sim.grafo) return;
  prepararCidade(sim);
  const t = trans(sim);
  // quem registra ou tira um produtor (X1b: o reservatório de lago.e1) suja as redes
  const { produtor, remover } = sim.redes;
  sim.redes.produtor = (p) => {
    t.redesSujas = true;
    return produtor(p);
  };
  sim.redes.remover = (id) => {
    t.redesSujas = true;
    return remover(id);
  };
  sim.redes.balanco = () => JSON.parse(JSON.stringify(sim.agregados.redes));
  sim.redes.estado = (i, rec) => estadoRede(sim, i, rec);
  sim.registrarSistema(RODADA, 0, sistemaRedes, 1, { nome: 'redes', ordem: ORDEM.zonas + 50 });
  // energia de fora pela rodovia a preço por kW por hora de jogo (D52)
  sim.custos.registrar('ligacao', (s) => s.agregados.redes.importado.energia * LIGACAO_EXTERNA.precoKwHora);
  sim.camadas.registrar('agua', camadaRede('agua'));
  sim.camadas.registrar('energia', camadaRede('energia'));
  registrarPartePredio(partePredio);
  registrarParteCidade(parteCidade);
  registrarAlertas(alertasRedes);
  sim.aoCarregar(() => garantirRedes(sim));
}

