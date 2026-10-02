// Bem-estar (D50, D11; dona: S2a): 0 a 100 por prédio residencial, base 40; saúde +8, educação +6, segurança +6,
// bombeiros +4 e lazer até +6 (cobertura x eficiência pela via); comércio a até 500 m até +4; sem água -25, sem energia
// -25; desemprego do prédio x -15; Holding de -10 a +10 (decisões por área e efeitos de área). No M1b: esgoto, ar,
// ruído e tempo de viagem. Suavizado em uma rodada por prédio. A média da cidade é ponderada pelos moradores e a
// tarifa sai da média suavizada em 1 mês (30 rodadas) e arredondada (D11); com tarifaPor 'predio', cada prédio paga
// pela sua faixa (a S3a lê a coluna predios.bemEstar).
import { clamp } from '../comum/util.js';
import { RODADA, MES } from '../comum/relogio.js';
import { PREDIO, TIPO_PREDIO } from '../contratos/flags.js';
import { ORDEM } from '../contratos/interno.js';
import { CATEGORIAS_SERVICO, COBERTURAS } from '../data/servicos.js';
import { ZONAS, ZONAS_ORDEM, PARTE_ATUAL } from '../data/zonas.js';
import { PREDIOS, modelosDaZona } from '../data/predios.js';
import { REGRAS_DONO, tarifaDoBemEstar, bemEstarArredondado } from '../data/economia.js';
import { registrarEfeitoMedia } from './zonas/pincel.js';
import { areaDe } from './mundo/areas.js';
import {
  prepararCidade, trans, funciona, familiaDe, nivelZona, registrarPartePredio, registrarAlertas, alertas, AV,
} from './predios.js';
import { desempregoDe, moradiaDe, estudoDe, registrarParteCidade } from './cidadaos.js';
import { coberturaPredio, coberturaNoPonto } from './servicos.js';
import { temOferta } from './redes.js';

/** Pesos do bem-estar (D50). (calibrar) */
export const BEM = Object.freeze({
  base: 40, semAgua: -25, semEnergia: -25, desemprego: -15, comercio: 4, comercioAlvo: 30, holding: 10,
  suavizar: 0.5, rodadasMes: MES / RODADA, ambar: 63,
});

const regras = (sim) => (typeof sim.economia?.regras === 'function' ? sim.economia.regras() : REGRAS_DONO);

// ------------------------------------------------------------------------------------------------ comércio perto

const LADO_COM = 32; // grade de 256 m sobre o mapa de 8.192 m
const PASSO_COM = 256;

/** Vagas de comércio do prédio i agora e o quadrado dele (vagas inteiras: a conta incremental e a inteira dão o mesmo). */
function parteComercio(sim, P, i, out) {
  out[0] = -1;
  out[1] = 0;
  if (i >= P.n || !funciona(P, i) || P.tipo[i] !== TIPO_PREDIO.ZONA || familiaDe(sim, i) !== 'com') return out;
  const a = Math.floor((P.x[i] + 4096) / PASSO_COM);
  const b = Math.floor((P.z[i] + 4096) / PASSO_COM);
  if (a < 0 || b < 0 || a >= LADO_COM || b >= LADO_COM) return out;
  const nv = nivelZona(P, i);
  out[0] = b * LADO_COM + a;
  out[1] = nv ? Math.round(nv.empregos[0] + nv.empregos[1] + nv.empregos[2] + nv.empregos[3]) : 0;
  return out;
}

const PC = [-1, 0];

/**
 * Vagas de comércio (capacidade) em cada quadrado de 256 m. Derivada: conta inteira ao carregar; depois, só os prédios
 * comerciais marcados no diário (fila t.comercioFila) trocam a parte deles, na hora da leitura.
 */
function gradeComercio(sim) {
  const t = trans(sim);
  const P = sim.tabelas.predios;
  let G = t.comercio;
  if (!G || t.comercioSujo || G.cel.length < P.cap) {
    G = { g: new Int32Array(LADO_COM * LADO_COM), cel: new Int32Array(P.cap).fill(-1), val: new Int32Array(P.cap) };
    for (let i = 0; i < P.n; i++) {
      parteComercio(sim, P, i, PC);
      if (PC[0] < 0) continue;
      G.g[PC[0]] += PC[1];
      G.cel[i] = PC[0];
      G.val[i] = PC[1];
    }
    t.comercio = G;
    t.comercioSujo = false;
  } else {
    for (const i of t.comercioFila) {
      if (G.cel[i] >= 0) G.g[G.cel[i]] -= G.val[i];
      parteComercio(sim, P, i, PC);
      G.cel[i] = PC[0];
      G.val[i] = PC[0] >= 0 ? PC[1] : 0;
      if (PC[0] >= 0) G.g[PC[0]] += PC[1];
    }
  }
  for (const i of t.comercioFila) t.comercioMarca[i] = 0;
  t.comercioFila.length = 0;
  return G.g;
}

/** Vagas de comércio a até uns 500 m de (x, z) (os 3 x 3 quadrados de 256 m em volta). */
export function comercioPerto(sim, x, z) {
  const g = gradeComercio(sim);
  const a = Math.floor((x + 4096) / PASSO_COM);
  const b = Math.floor((z + 4096) / PASSO_COM);
  let s = 0;
  for (let j = b - 1; j <= b + 1; j++) {
    if (j < 0 || j >= LADO_COM) continue;
    for (let i = a - 1; i <= a + 1; i++) if (i >= 0 && i < LADO_COM) s += g[j * LADO_COM + i];
  }
  return s;
}

// ------------------------------------------------------------------------------------------------ Holding e efeitos

/** Termo da Holding no ponto (-10 a +10): decisões por área (S3a) e efeitos de área (sim.cidade, X1b). */
export function termoHolding(sim, x, z) {
  let v = 0;
  const dec = typeof sim.economia?.efeitos === 'function' ? sim.economia.efeitos('bemArea') : [];
  if (dec.length) {
    const area = areaDe(sim, x, z);
    for (const e of dec) if (!e.area || e.area === 'cidade' || e.area === area) v += +e.v || 0;
  }
  const ef = sim.json.cidade.efeitos;
  for (const id of Object.keys(ef).sort()) {
    const e = ef[id];
    if (!e.bemEstar) continue;
    if (e.raio && Number.isFinite(e.x) && (x - e.x) * (x - e.x) + (z - e.z) * (z - e.z) > e.raio * e.raio) continue;
    v += e.bemEstar;
  }
  return clamp(v, -BEM.holding, BEM.holding);
}

// ------------------------------------------------------------------------------------------------ prédio

/**
 * Bem-estar do prédio residencial i agora (0 a 100), sem suavizar. `fatores`, se vier, recebe [{ id, v }] de cada
 * termo diferente de zero (a folha do prédio e a tela Cidade mostram).
 */
export function calcularBemEstar(sim, i, fatores = null) {
  const P = sim.tabelas.predios;
  let b = BEM.base;
  const add = (id, v) => {
    if (!v) return;
    b += v;
    if (fatores) fatores.push({ id, v: Math.round(v * 10) / 10 });
  };
  if (fatores) fatores.push({ id: 'base', v: BEM.base });
  for (const cat of COBERTURAS) add(cat, CATEGORIAS_SERVICO[cat].bemEstar * coberturaPredio(sim, i, cat));
  add('comercio', BEM.comercio * Math.min(1, comercioPerto(sim, P.x[i], P.z[i]) / BEM.comercioAlvo));
  const f = P.flags[i];
  if (f & PREDIO.SEM_AGUA) add('agua', BEM.semAgua);
  if (f & PREDIO.SEM_ENERGIA) add('energia', BEM.semEnergia);
  add('desemprego', BEM.desemprego * desempregoDe(sim, i));
  add('holding', termoHolding(sim, P.x[i], P.z[i]));
  return clamp(b, 0, 100);
}

/** Atualiza a coluna predios.bemEstar do prédio i (suavizado em uma rodada; `direto` na estreia). */
export function atualizarBemEstar(sim, i, direto = false) {
  const P = sim.tabelas.predios;
  const b = calcularBemEstar(sim, i);
  P.bemEstar[i] = direto ? b : P.bemEstar[i] + (b - P.bemEstar[i]) * BEM.suavizar;
  return P.bemEstar[i];
}

// ------------------------------------------------------------------------------------------------ cidade (D11)

/** Média do bem-estar ponderada pelos moradores (prédios residenciais que funcionam). */
export function mediaBemEstar(sim) {
  const P = sim.tabelas.predios;
  let s = 0;
  let m = 0;
  for (let i = 0; i < P.n; i++) {
    if (!funciona(P, i) || !P.moradores[i] || P.tipo[i] !== TIPO_PREDIO.ZONA) continue;
    s += P.bemEstar[i] * P.moradores[i];
    m += P.moradores[i];
  }
  return { media: m ? s / m : 0, moradores: m };
}

/** Uma vez por rodada: média, média do mês (30 rodadas), tarifa e os alertas da cidade que mudaram (evento aviso). */
export function sistemaBemEstar(sim) {
  const j = sim.json.cidade;
  const ag = sim.agregados;
  const { media, moradores } = mediaBemEstar(sim);
  if (moradores > 0) {
    j.bemHist.push(Math.round(media * 1000) / 1000);
    if (j.bemHist.length > BEM.rodadasMes) j.bemHist.splice(0, j.bemHist.length - BEM.rodadasMes);
  }
  let suave = media;
  if (j.bemHist.length) suave = j.bemHist.reduce((a, b) => a + b, 0) / j.bemHist.length;
  ag.bemEstarMedio = Math.round(media * 10) / 10;
  ag.bemEstarSuave = Math.round(suave * 100) / 100;
  ag.bemEstarTarifa = moradores > 0 ? bemEstarArredondado(suave) : 0;
  ag.tarifa = tarifaDoBemEstar(ag.bemEstarTarifa, regras(sim));
  j.rodada++;
  // alertas da cidade: o evento sai quando um aparece ou piora
  const atuais = {};
  for (const a of alertas(sim)) {
    atuais[a.id] = a.gravidade;
    const antes = j.alertas[a.id];
    if (antes !== a.gravidade && (antes !== 'grave' || a.gravidade === 'grave')) {
      sim.emitir('aviso', { id: a.id, gravidade: a.gravidade, codigo: a.codigo, params: a.params, alvo: a.alvo });
    }
  }
  j.alertas = atuais;
}

/**
 * Efeito previsto de uma pintura de zona na média do bem-estar (q.zona.previa, D11): os moradores que as células
 * novas trazem no nível 1, com o bem-estar da via delas, entram na média de agora.
 */
export function efeitoMedia(sim, celulas, zona) {
  const id = ZONAS_ORDEM[zona];
  if (!id || ZONAS[id].familia !== 'res' || !celulas.length) return 0;
  const C = sim.tabelas.celulas;
  // moradores por célula no nível 1 (média dos modelos da zona)
  let dens = 0;
  const ms = modelosDaZona(id);
  for (const m of ms) dens += PREDIOS[m].niveis[0].moradores / (PREDIOS[m].planta[0] * PREDIOS[m].planta[1]);
  dens /= ms.length || 1;
  const novos = celulas.length * dens;
  // bem-estar das células novas: base, cobertura das vias delas e as redes (sem rede ligada a quem produz, -25 cada)
  const passo = Math.max(1, Math.floor(celulas.length / 8));
  let soma = 0;
  let n = 0;
  for (let k = 0; k < celulas.length; k += passo) {
    const c = celulas[k];
    const e = C.aresta[c];
    let b = BEM.base;
    for (const cat of COBERTURAS) b += CATEGORIAS_SERVICO[cat].bemEstar * coberturaNoPonto(sim, cat, e, 0);
    if (!temOferta(sim, e, 'agua')) b += BEM.semAgua;
    if (!temOferta(sim, e, 'energia')) b += BEM.semEnergia;
    soma += clamp(b, 0, 100);
    n++;
  }
  const bNovo = n ? soma / n : BEM.base;
  const { media, moradores } = mediaBemEstar(sim);
  if (moradores + novos <= 0) return 0;
  return Math.round(((media * moradores + bNovo * novos) / (moradores + novos) - media) * 10) / 10;
}

// ------------------------------------------------------------------------------------------------ camada, partes, alertas

function camadaBemEstar(sim) {
  const P = sim.tabelas.predios;
  const dados = new Float32Array(P.n).fill(-1);
  for (let i = 0; i < P.n; i++) {
    if (!funciona(P, i) || P.tipo[i] !== TIPO_PREDIO.ZONA || familiaDe(sim, i) !== 'res' || !P.moradores[i]) continue;
    dados[i] = P.bemEstar[i];
  }
  const ag = sim.agregados;
  return {
    id: 'bemEstar', fonte: 'predios', dados, grade: null, tipo: 'seq', escala: { min: 0, max: 100, meio: 60, unidade: '' },
    categorias: null,
    legenda: [{ v: 30, chave: 'camada.bemEstar.faixa5' }, { v: 60, chave: 'camada.bemEstar.faixa8' }, { v: 100, chave: 'camada.bemEstar.faixa11' }],
    resumo: { chave: 'camada.bemEstar.resumo', params: { media: ag.bemEstarMedio, tarifa: ag.tarifa } },
    versao: sim.json.cidade.rodada,
  };
}

function partePredio(sim, i, out) {
  const P = sim.tabelas.predios;
  if (P.tipo[i] !== TIPO_PREDIO.ZONA || familiaDe(sim, i) !== 'res') return;
  const cap = moradiaDe(sim, i);
  const fatores = [];
  calcularBemEstar(sim, i, fatores);
  const r = regras(sim);
  const tarifa = r.renda.tarifaPor === 'predio' ? tarifaDoBemEstar(P.bemEstar[i], r) : sim.agregados.tarifa;
  const m = P.moradores[i];
  out.moradia = {
    lares: cap.moradores ? Math.round((cap.lares * m) / cap.moradores) : 0, moradores: m, capacidade: cap.moradores,
    escolaridade: [0, 1, 2, 3].map((n) => Math.round(estudoDe(P, i, n) * 1000) / 1000), bemEstar: Math.round(P.bemEstar[i] * 10) / 10,
    fatores, tarifa, contribuicaoHora: m * tarifa,
  };
}

function parteCidade(sim, out) {
  // fatores médios do bem-estar da cidade (amostra de até 400 prédios, ponderada pelos moradores)
  const P = sim.tabelas.predios;
  const soma = {};
  let m = 0;
  const lista = [];
  for (let i = 0; i < P.n; i++) if (funciona(P, i) && P.moradores[i] && P.tipo[i] === TIPO_PREDIO.ZONA && familiaDe(sim, i) === 'res') lista.push(i);
  const passo = Math.max(1, Math.floor(lista.length / 400));
  for (let k = 0; k < lista.length; k += passo) {
    const i = lista[k];
    const f = [];
    calcularBemEstar(sim, i, f);
    for (const x of f) soma[x.id] = (soma[x.id] ?? 0) + x.v * P.moradores[i];
    m += P.moradores[i];
  }
  out.fatoresBemEstar = Object.keys(soma).map((id) => ({ id, v: Math.round((10 * soma[id]) / m) / 10 }));
  out.bemEstarSuave = sim.agregados.bemEstarSuave ?? sim.agregados.bemEstarMedio;
  out.parte = PARTE_ATUAL;
}

function alertasBemEstar(sim) {
  const ag = sim.agregados;
  const out = [];
  if (ag.populacao > 0 && ag.bemEstarTarifa >= 61 && ag.bemEstarTarifa < BEM.ambar) {
    out.push({ id: 'bemEstar', gravidade: 'atencao', glifo: 'bemEstarMedio', codigo: 'bemEstarPerto', params: { delta: ag.bemEstarTarifa - 61 }, alvo: { tela: 'cidade' } });
  }
  const taxa = ag.empregos.taxa ?? 0;
  if (ag.populacao > 500 && taxa > 0.15) {
    out.push({ id: 'desemprego', gravidade: taxa > 0.3 ? 'grave' : 'atencao', glifo: 'trabalho', codigo: 'desempregoAlto', params: { pct: Math.round(taxa * 100) }, alvo: { tela: 'cidade' } });
  }
  const vagas = ag.empregos.vagas.reduce((a, b) => a + b, 0);
  const ocup = ag.empregos.ocupadas.reduce((a, b) => a + b, 0);
  // só depois da primeira rodada do mercado de trabalho (antes dela as ocupadas ainda não foram contadas)
  if (sim.json.cidade.rodada > 0 && vagas > 50 && ocup < 0.75 * vagas) {
    out.push({ id: 'trabalhadores', gravidade: 'atencao', glifo: 'semTrabalhadores', codigo: 'faltamTrabalhadores', params: { n: vagas - ocup }, alvo: { tela: 'cidade' } });
  }
  // prédios perto do abandono e obras paradas por falta de material (D48)
  const P = sim.tabelas.predios;
  let abandono = 0;
  let parado = 0;
  let alvoA = null;
  let alvoM = null;
  for (let i = 0; i < P.n; i++) {
    if (!P.viva[i]) continue;
    if (P.avisos[i] & AV.ABANDONO) {
      abandono++;
      if (!alvoA) alvoA = { x: P.x[i], z: P.z[i] };
    }
    if (P.flags[i] & PREDIO.SEM_MATERIAL) {
      parado++;
      if (!alvoM) alvoM = { x: P.x[i], z: P.z[i] };
    }
  }
  if (abandono) out.push({ id: 'abandono', gravidade: 'atencao', glifo: 'abandonado', codigo: 'abandonoPerto', params: { n: abandono }, alvo: alvoA });
  if (parado) out.push({ id: 'obrasParadas', gravidade: 'atencao', glifo: 'semMaterial', codigo: 'obrasParadas', params: { n: parado }, alvo: alvoM });
  return out;
}

// ------------------------------------------------------------------------------------------------ registro

export function registrar(sim) {
  if (!sim.tabelas.predios || !sim.grafo) return;
  prepararCidade(sim);
  sim.registrarSistema(RODADA, 0, sistemaBemEstar, 1, { nome: 'bemestar', ordem: ORDEM.cidade });
  sim.camadas.registrar('bemEstar', camadaBemEstar);
  registrarEfeitoMedia(sim, efeitoMedia);
  registrarPartePredio(partePredio);
  registrarParteCidade(parteCidade);
  registrarAlertas(alertasBemEstar);
  sim.registrarParteBarra('s2a', (b, s) => {
    for (const a of alertas(s)) b.alertas.push({ ...a });
    b.bemEstar = s.agregados.bemEstarMedio;
  });
}
