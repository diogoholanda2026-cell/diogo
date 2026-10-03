// Prédios (dona: S2a): o estado da cidade que os domínios da S2a dividem (colunas próprias na tabela de prédios, a
// seção JSON 'cidade' e os índices derivados), o comando construir único (serviços da S2a e prédios da Holding da S3a,
// pelo registro sim.colocaveis), demolir (D54), predio.cor e predio.nome, as consultas construir.previa, predio,
// catalogo, avisosPredios e avisos, e as camadas Zonas e Nível.
//
// Determinismo dos derivados: tudo o que não vai no save (acesso de cada prédio à via, cobertura, componentes das
// redes, candidatos de nascimento) é função pura do estado salvo e é refeito antes de ser lido sempre que algo mudou
// (as marcas das tabelas sujam) e inteiro ao carregar. O que muda com o tempo (bem-estar, eficiência, avisos) fica em
// colunas e no JSON, que vão no save e no hash.
//
// Colocável (sim.colocaveis.registrar(tipo, def)): def = { nome, custo, manutencaoHora?, planta: [frente, fundo] (m),
//   marco, parte?, xp?, obraTiques?, barra?: 'servicos' | 'lazer' | 'empresas', categoria?, recurso? (id da grade de
//   recursos), margem? (m até a água), modelo? (predios.modelo), holding?: bool, demolivel?: bool, arcologia?: bool,
//   validar?(sim, lugar) → codigo | null, aoConstruir?(sim, i, ref), aoDemolir?(sim, i), consulta?(sim, i) → parte de
//   q.predio, vagas?: [4] | (sim, i) → [4], consumo?: { agua, energia } }.
import { hipot, sen, cos, atan2 } from '../comum/util.js';
import { cantosRetangulo, pontoNoRetangulo } from '../comum/vetor.js';
import { maisPerto, arcoDoT, tangente } from '../comum/bezier.js';
import { refDe, CELULA_M, progressoObra, faseObra, FASES_OBRA } from '../contratos/espelho.js';
import { PREDIO, TIPO_PREDIO, CELULA, AGUA, GRAVIDADES } from '../contratos/flags.js';
import { PREDIOS, PREDIOS_ORDEM, NIVEIS, nivelDoModelo } from '../data/predios.js';
import { ZONAS, ZONAS_ORDEM, zonaNaParte, PARTE_ATUAL } from '../data/zonas.js';
import { SERVICOS, SERVICOS_ORDEM, CATEGORIAS_SERVICO } from '../data/servicos.js';
import * as dadosHolding from '../data/holding.js';
import { VIAS, VIAS_ORDEM } from '../data/vias.js';
import { prediosNaCaixa, pontoNoPredio, naGleba, eixoDa, distEixo, MEIA_MAX } from './vias/validar.js';
import { removerPredio, celulasNaCaixa, revalidarRetangulo } from './zonas/blocos.js';
import { custoDemolirPredio } from './vias/demolir.js';
import { daHolding } from './mundo/ladrilhos.js';
import { aguaEm } from './mundo/terreno.js';
import { recursoNoPoligono } from './mundo/recursos.js';

// ------------------------------------------------------------------------------------------------ estado comum

/** Avisos de prédio (bits da coluna predios.avisos). */
export const AV = Object.freeze({
  SEM_AGUA: 1, SEM_ENERGIA: 2, SEM_ACESSO: 4, SEM_TRABALHADORES: 8, SEM_CLIENTES: 16, ABANDONO: 32, ABANDONADO: 64,
  SEM_MATERIAL: 128, RACIONADO: 256, DESEMPREGO: 512, BEM_ESTAR: 1024, SEM_REDE: 2048,
});

/** Código, glifo e gravidade de cada aviso, na ordem de prioridade (o primeiro presente é o glifo do marcador). */
export const AVISOS_PREDIO = Object.freeze([
  { bit: AV.ABANDONADO, codigo: 'abandonado', glifo: 'abandonado', gravidade: 'grave' },
  { bit: AV.ABANDONO, codigo: 'abandono', glifo: 'alerta', gravidade: 'atencao' },
  { bit: AV.SEM_AGUA, codigo: 'semAgua', glifo: 'semAgua', gravidade: 'grave' },
  { bit: AV.SEM_ENERGIA, codigo: 'semEnergia', glifo: 'semEnergia', gravidade: 'grave' },
  { bit: AV.RACIONADO, codigo: 'racionado', glifo: 'semEnergia', gravidade: 'atencao' },
  { bit: AV.SEM_ACESSO, codigo: 'semAcesso', glifo: 'semVia', gravidade: 'grave' },
  // produtor (captação, poço, usina) numa rua sem canos nem cabos (terra, D52): não põe nada na rede
  { bit: AV.SEM_REDE, codigo: 'semRede', glifo: 'semVia', gravidade: 'grave' },
  { bit: AV.SEM_MATERIAL, codigo: 'semMaterial', glifo: 'semMaterial', gravidade: 'atencao' },
  { bit: AV.SEM_TRABALHADORES, codigo: 'semTrabalhadores', glifo: 'semTrabalhadores', gravidade: 'atencao' },
  { bit: AV.SEM_CLIENTES, codigo: 'semClientes', glifo: 'poucosClientes', gravidade: 'atencao' },
  { bit: AV.DESEMPREGO, codigo: 'desemprego', glifo: 'trabalho', gravidade: 'info' },
  { bit: AV.BEM_ESTAR, codigo: 'bemEstarBaixo', glifo: 'bemEstarRuim', gravidade: 'info' },
]);

/** Nomes dos glifos de q.avisosPredios().glifo (índice 0 = nenhum). */
export const GLIFOS_AVISO = Object.freeze(['', ...new Set(AVISOS_PREDIO.map((a) => a.glifo))]);

/** Tempos de abandono (D42): aviso âmbar aos 3 min de jogo, vermelho aos 6, abandono aos 10. (calibrar) */
export const ABANDONO = Object.freeze({ ambar: 180, vermelho: 360, abandona: 600, volta: 120 });

const JSON_CIDADE = {
  rodada: 0, // rodadas de 20 tiques já fechadas (versão das camadas)
  acum: {}, // acumulador de nascimento por zona
  demanda: {}, // demanda suavizada por zona (0 a 100)
  fatores: {}, // fatores da última conta, por zona
  bemHist: [], // médias do bem-estar das últimas 30 rodadas (1 mês, D11)
  popAnterior: -1, // -1: a primeira rodada só anota (a população do mapa não conta como chegada)
  semEspaco: {}, // célula da linha 0 -> tique até quando a frente fica sem espaço
  nomes: {}, // ref -> nome dado pelo jogador
  avisosVersao: 0,
  alertas: {}, // id do alerta da cidade -> gravidade atual
  efeitos: {}, // efeitos de área (sim.cidade.efeito): demanda, valor, bem-estar, atratividade
  ocupacao: [0, 0, 0, 0], // fração das vagas ocupada por nível de estudo (mercado de trabalho)
  desemprego: [0, 0, 0, 0],
  clientes: 1, // fração dos clientes esperados que o comércio recebe
  estudoChegada: [0.35, 0.4, 0.2, 0.05], // escolaridade de quem chega (segue as vagas)
};

const TRANS = new WeakMap();

/** Estado transitório (derivado; nunca vai no save). */
export function trans(sim) {
  let t = TRANS.get(sim);
  if (!t) {
    t = {
      viaE: new Int32Array(0), viaS: new Float32Array(0), viaGer: new Int32Array(0), viaSuja: new Uint8Array(0), sujos: [], viaTudo: true,
      viaFrente: new Uint8Array(0), arestasSujas: [], celDono: new Int32Array(0),
      grafoSujo: true, servSujo: true, redesSujas: true, candSujo: true, celSujas: [], celMarca: new Uint8Array(0),
      cob: null, redes: null, cand: null, aguaDist: null, comercio: null, comercioSujo: true, comercioFila: [], comercioMarca: new Uint8Array(0),
    };
    TRANS.set(sim, t);
  }
  return t;
}

/** Tudo derivado fica sujo (carregar um save, ou montagem fora da ordem). */
export function sujarTudo(sim) {
  const t = trans(sim);
  t.viaTudo = true;
  t.grafoSujo = true;
  t.servSujo = true;
  t.redesSujas = true;
  t.candSujo = true;
  t.comercioSujo = true;
}

/**
 * Prepara o estado da S2a numa simulação (idempotente; cada registrar da S2a chama): colunas próprias na tabela de
 * prédios, a seção JSON 'cidade', os avisos de marca das tabelas e o registro de efeitos de área (sim.cidade).
 * @returns {object} sim.json.cidade
 */
export function prepararCidade(sim) {
  if (sim.json.cidade) return sim.json.cidade;
  const P = sim.tabelas.predios;
  const C = sim.tabelas.celulas;
  const j = sim.registrarJson('cidade', JSON_CIDADE);
  if (P) {
    P.novaColuna('bemEstar', Float32Array); // bem-estar do prédio residencial, 0 a 100 (a S3a lê na tarifa por prédio)
    P.novaColuna('pontos', Uint16Array); // pontos para o próximo nível
    P.novaColuna('problema', Uint16Array); // tiques com problema (abandono, D42)
    P.novaColuna('estudo', [Float32Array, 4]); // fração dos moradores por nível de estudo
    P.novaColuna('efic', Float32Array); // eficiência do serviço, produtividade do trabalho
    P.novaColuna('carga', Float32Array); // carga do serviço (moradores ou estudantes atendidos)
    P.novaColuna('avisos', Uint16Array); // bits de AV
  }
  const t = trans(sim);
  const ligar = (tab, fn) => {
    if (!tab) return;
    const antes = tab.aoMarcar;
    tab.aoMarcar = (i) => {
      if (antes) antes(i);
      fn(i);
    };
  };
  // prédio comercial marcado (nasceu, terminou a obra, subiu, abandonou) ou linha que saiu entra na fila da grade do
  // comércio (bemestar.js troca a parte dele na próxima leitura)
  ligar(P, (i) => {
    if (P.viva[i] && (P.tipo[i] !== TIPO_PREDIO.ZONA || FAMILIA_ZONA[P.zona[i]] !== 'com')) return;
    if (i >= t.comercioMarca.length) {
      const m = new Uint8Array(Math.max(P.cap, i + 1));
      m.set(t.comercioMarca);
      t.comercioMarca = m;
    }
    if (!t.comercioMarca[i]) {
      t.comercioMarca[i] = 1;
      t.comercioFila.push(i);
    }
  });
  // aresta que mudou: os acessos pela frente (serviços, Holding, prédios sem célula) e os que apontam para ela saem de
  // novo (a via partida por um cruzamento fica com o mesmo idx e outro comprimento)
  ligar(sim.tabelas.arestas, (e) => {
    t.grafoSujo = true;
    t.redesSujas = true;
    if (t.arestasSujas.length < 4096) t.arestasSujas.push(e);
    else t.viaTudo = true;
  });
  ligar(sim.tabelas.nos, () => {
    t.grafoSujo = true;
    t.redesSujas = true;
  });
  // célula marcada: o acesso do dono novo e o do dono velho (a célula que soltou do prédio já chega com predio -1, e o
  // dono velho fica em t.celDono) é refeito na próxima leitura
  ligar(C, (c) => {
    if (c < t.celDono.length) {
      const novo = c < C.n && C.viva[c] ? C.predio[c] : -1;
      const velho = t.celDono[c];
      if (velho >= 0 && velho !== novo) sujarVia(t, velho);
      if (novo >= 0) sujarVia(t, novo);
      t.celDono[c] = novo;
    } else t.viaTudo = true;
    if (c >= t.celMarca.length) {
      const m = new Uint8Array(Math.max(C.cap, c + 1));
      m.set(t.celMarca);
      t.celMarca = m;
    }
    if (!t.celMarca[c]) {
      t.celMarca[c] = 1;
      t.celSujas.push(c);
    }
  });
  // ao carregar, os derivados saem na hora (o primeiro tique depois da carga fica leve)
  sim.aoCarregar(() => {
    sujarTudo(sim);
    garantirAcessos(sim);
  });
  // efeitos de área de outros domínios (X1b: torre.e3 e torre.e4; S3a: Legado): salvos, lidos pela demanda, pelo
  // valor do terreno e pelo bem-estar
  sim.cidade = {
    /**
     * def: { x?, z?, raio? (m; sem raio vale a cidade inteira), demanda?: { zona: +n }, valor?: n, bemEstar?: n,
     * atratividade?: n }. Só números finitos ficam (um NaN no valor do terreno ficaria na grade para sempre).
     */
    efeito(id, def = {}) {
      const ef = {};
      for (const k of ['x', 'z', 'raio', 'valor', 'bemEstar', 'atratividade']) if (Number.isFinite(def[k])) ef[k] = def[k];
      if (def.demanda && typeof def.demanda === 'object') {
        ef.demanda = {};
        for (const [z, v] of Object.entries(def.demanda)) if (Number.isFinite(v)) ef.demanda[z] = v;
      }
      sim.json.cidade.efeitos[String(id)] = ef;
    },
    remover(id) {
      delete sim.json.cidade.efeitos[id];
    },
    lista: () => Object.keys(sim.json.cidade.efeitos).sort().map((id) => ({ id, ...sim.json.cidade.efeitos[id] })),
  };
  return j;
}

function sujarVia(t, i) {
  if (i >= t.viaSuja.length) return void (t.viaTudo = true);
  if (!t.viaSuja[i]) {
    t.viaSuja[i] = 1;
    t.sujos.push(i);
  }
}

// ------------------------------------------------------------------------------------------------ tipo e catálogo

/** O que é o prédio i: { tipo: 'zona' | 'servico' | 'holding', id, def, nv } (nv: o nível do catálogo, só zona). */
export function tipoDoPredio(sim, i) {
  const P = sim.tabelas.predios;
  const tp = P.tipo[i];
  if (tp === TIPO_PREDIO.ZONA) {
    const id = PREDIOS_ORDEM[P.modelo[i]];
    return { tipo: 'zona', id, def: PREDIOS[id] ?? null, nv: nivelDoModelo(P.modelo[i], P.nivel[i] || 1) };
  }
  if (tp === TIPO_PREDIO.SERVICO) {
    const id = SERVICOS_ORDEM[P.modelo[i]];
    return { tipo: 'servico', id, def: sim.colocaveis.obter(id) ?? SERVICOS[id] ?? null, nv: null };
  }
  const id = dadosHolding.HOLDING_ORDEM?.[P.modelo[i]] ?? null;
  return { tipo: 'holding', id, def: id ? sim.colocaveis.obter(id) ?? dadosHolding.PREDIOS_HOLDING?.[id] ?? null : null, nv: null };
}

/** Família de cada zona pelo índice (celulas.zona e predios.zona). */
export const FAMILIA_ZONA = Object.freeze(ZONAS_ORDEM.map((id) => (id ? ZONAS[id].familia : null)));

/** Família da zona do prédio ('res', 'com', 'ind', 'esc') ou null. */
export function familiaDe(sim, i) {
  const P = sim.tabelas.predios;
  return P.tipo[i] === TIPO_PREDIO.ZONA ? FAMILIA_ZONA[P.zona[i]] : null;
}

/** Nível do catálogo do prédio de zona i (null fora da zona). */
export function nivelZona(P, i) {
  return P.tipo[i] === TIPO_PREDIO.ZONA ? NIVEIS[P.modelo[i]]?.[Math.max(1, Math.min(5, P.nivel[i])) - 1] ?? null : null;
}

/** Vagas por nível de estudo do prédio i no nível atual (zona pelo catálogo, serviço e Holding pelo colocável). */
export function vagasDe(sim, i, out = [0, 0, 0, 0]) {
  const P = sim.tabelas.predios;
  out[0] = out[1] = out[2] = out[3] = 0;
  if (P.tipo[i] === TIPO_PREDIO.ZONA) {
    const nv = nivelZona(P, i);
    if (nv) for (let n = 0; n < 4; n++) out[n] = nv.empregos[n];
    return out;
  }
  const k = tipoDoPredio(sim, i);
  let v = null;
  if (k.def) {
    if (typeof k.def.vagas === 'function') v = k.def.vagas(sim, i);
    else if (k.tipo === 'holding' && typeof dadosHolding.vagasDoNivel === 'function') v = dadosHolding.vagasDoNivel(k.id, P.nivel[i] || 1);
    else v = k.def.vagas ?? k.def.empregos;
  }
  if (Array.isArray(v)) for (let n = 0; n < 4; n++) out[n] = v[n] || 0;
  else if (typeof v === 'number') out[0] = v;
  return out;
}

/** true se o prédio funciona: vivo, fora da obra de nascimento e não abandonado (a obra de nível segue funcionando). */
export function funciona(P, i) {
  if (!P.viva[i]) return false;
  const f = P.flags[i];
  if (f & PREDIO.ABANDONADO) return false;
  return !(f & PREDIO.OBRA) || !!(f & PREDIO.OBRA_NIVEL);
}

/** Marco atual (0 a 7) e o modo livre. */
export function marcoAtual(sim) {
  return sim.progresso?.marco ? sim.progresso.marco().n : 0;
}

/**
 * true se o colocável pode ser construído agora: a parte do jogo, o desbloqueio do progresso (def.liberado ou
 * 'servico.<tipo>') e o marco; tudo no Modo livre.
 */
export function colocavelLiberado(sim, tipo, def = sim.colocaveis.obter(tipo)) {
  if (!def) return false;
  if (!parteOk(def.parte)) return false;
  if (sim.json.partida?.modo === 'livre') return true;
  const id = typeof def.liberado === 'string' ? def.liberado : SERVICOS[tipo] ? `servico.${tipo}` : null;
  if (id && sim.progresso?.liberado && sim.progresso.liberado(id) === false) return false;
  return marcoAtual(sim) >= (def.marco ?? 0);
}

const PARTES = ['M1a', 'M1b', 'M2', 'M3', 'M4'];
/** true se a parte (do colocável) já chegou no jogo. */
export const parteOk = (parte) => PARTES.indexOf(parte ?? 'M1a') <= PARTES.indexOf(PARTE_ATUAL);

/** Planta [frente, fundo] em metros de um colocável. */
export function plantaDe(def) {
  const p = def?.planta ?? def?.pegada;
  return Array.isArray(p) && p[0] > 0 && p[1] > 0 ? [p[0], p[1]] : [24, 24];
}

const BARRAS = ['servicos', 'lazer', 'empresas'];
/** Categoria da barra de construção (D24) de um colocável (def.barra; a S3a manda a dela em def.categoria). */
export const barraDe = (tipo, def) =>
  def?.barra ?? (SERVICOS[tipo] ? SERVICOS[tipo].barra : BARRAS.includes(def?.categoria) ? def.categoria : 'empresas');

/** true se o colocável é serviço da cidade (o resto é prédio da Holding). */
export const ehServico = (tipo, def) =>
  def?.tipoPredio !== undefined ? def.tipoPredio === TIPO_PREDIO.SERVICO : !!SERVICOS[tipo] && !def?.holding;

// ------------------------------------------------------------------------------------------------ acesso à via

function garantirVia(sim, t) {
  const P = sim.tabelas.predios;
  if (t.viaE.length < P.cap) {
    const e = new Int32Array(P.cap).fill(-1);
    e.set(t.viaE.subarray(0, Math.min(t.viaE.length, P.cap)));
    const s = new Float32Array(P.cap);
    s.set(t.viaS.subarray(0, Math.min(t.viaS.length, P.cap)));
    const u = new Uint8Array(P.cap);
    u.set(t.viaSuja.subarray(0, Math.min(t.viaSuja.length, P.cap)));
    const g = new Int32Array(P.cap).fill(-1);
    g.set(t.viaGer.subarray(0, Math.min(t.viaGer.length, P.cap)));
    t.viaE = e;
    t.viaS = s;
    t.viaSuja = u;
    t.viaGer = g;
    t.viaFrente = new Uint8Array(P.cap);
    t.viaTudo = true;
  }
}

/** Fase (0 a 8) das células da aresta e. */
const faseDa = (A, e) => {
  const f = A.fase ? A.fase[e] % CELULA_M : 0;
  return f < 0 ? f + CELULA_M : f;
};

const MP = { t: 0, d: 0, x: 0, z: 0 };

/** Acesso pela frente (sem células): a via mais perto da frente do prédio, até 24 m. */
function viaPelaFrente(sim, i, out) {
  const P = sim.tabelas.predios;
  const A = sim.tabelas.arestas;
  const G = sim.grafo;
  const fx = sen(P.rot[i]);
  const fz = cos(P.rot[i]);
  const off = P.d[i] / 2 + 4;
  const x = P.x[i] + fx * off;
  const z = P.z[i] + fz * off;
  const R = 24 + MEIA_MAX;
  const ids = Array.from(G.gradeArestas.consultar(x - R, z - R, x + R, z + R));
  let melhor = -1;
  let md = Infinity;
  let mt = 0;
  for (const e of ids) {
    if (!A.viva[e]) continue;
    maisPerto(A.p, x, z, 8 * e, MP);
    const d = MP.d - VIAS[VIAS_ORDEM[A.tipo[e]]].largura / 2;
    if (d < md && d <= 24) {
      md = d;
      melhor = e;
      mt = MP.t;
    }
  }
  out.e = melhor;
  out.s = melhor >= 0 ? arcoDoT(A.arco.subarray(17 * melhor, 17 * melhor + 17), mt) : 0;
}

/** Acesso pelas células da linha 0 do prédio: a aresta delas e o arco médio das colunas. */
function viaPelasCelulas(sim, i, out) {
  const P = sim.tabelas.predios;
  const C = sim.tabelas.celulas;
  const A = sim.tabelas.arestas;
  const r = (P.w[i] + P.d[i]) / 2 + 4;
  let e = -1;
  let soma = 0;
  let n = 0;
  for (const c of celulasNaCaixa(sim, P.x[i] - r, P.z[i] - r, P.x[i] + r, P.z[i] + r)) {
    if (C.predio[c] !== i || C.linha[c] !== 0) continue;
    if (e < 0) e = C.aresta[c];
    if (C.aresta[c] !== e) continue;
    soma += C.coluna[c];
    n++;
  }
  if (e < 0 || !A.viva[e]) return false;
  out.e = e;
  out.s = faseDa(A, e) + CELULA_M * (soma / n) + CELULA_M / 2;
  return true;
}

const OV = { e: -1, s: 0 };

/** Refaz o acesso dos prédios sujos (ou de todos). */
export function garantirAcessos(sim) {
  const t = trans(sim);
  const P = sim.tabelas.predios;
  garantirVia(sim, t);
  if (t.viaTudo) {
    t.viaTudo = false;
    t.sujos.length = 0;
    t.arestasSujas.length = 0;
    t.viaSuja.fill(0);
    t.viaE.fill(-1);
    t.viaFrente.fill(0);
    // passada única pelas células: o dono de cada uma e a aresta e o arco médio da linha 0 de cada prédio
    const C = sim.tabelas.celulas;
    const A = sim.tabelas.arestas;
    const soma = new Float64Array(P.n);
    const n = new Int32Array(P.n);
    if (C) {
      if (t.celDono.length < C.cap) t.celDono = new Int32Array(C.cap);
      t.celDono.fill(-1);
      for (let c = 0; c < C.n; c++) {
        if (!C.viva[c]) continue;
        const i = C.predio[c];
        t.celDono[c] = i;
        if (C.linha[c] !== 0 || i < 0 || i >= P.n) continue;
        const e = C.aresta[c];
        if (t.viaE[i] < 0) t.viaE[i] = e;
        if (t.viaE[i] !== e) continue;
        soma[i] += C.coluna[c];
        n[i]++;
      }
    }
    for (let i = 0; i < P.n; i++) {
      if (!P.viva[i]) {
        t.viaE[i] = -1;
        continue;
      }
      t.viaGer[i] = P.ger[i];
      const e = t.viaE[i];
      if (e >= 0 && n[i] && A.viva[e]) t.viaS[i] = faseDa(A, e) + CELULA_M * (soma[i] / n[i]) + CELULA_M / 2;
      else {
        viaPelaFrente(sim, i, OV);
        t.viaE[i] = OV.e;
        t.viaS[i] = OV.s;
        t.viaFrente[i] = 1;
      }
    }
    return;
  }
  // arestas que mudaram: refaz quem acessa pela frente (a via mais perto pode ser outra) e quem aponta para elas
  if (t.arestasSujas.length) {
    const mudou = new Set(t.arestasSujas);
    t.arestasSujas.length = 0;
    for (let i = 0; i < P.n; i++) if (P.viva[i] && (t.viaFrente[i] || mudou.has(t.viaE[i]))) sujarVia(t, i);
  }
  if (!t.sujos.length) return;
  // um prédio sozinho custa uns 30 µs (a busca das células dele); a passada inteira, uns 2 ms com 12 mil prédios e
  // 126 mil células: acima de umas 64 marcas a inteira sai mais barata (o resultado é o mesmo)
  if (t.sujos.length > 64) {
    t.viaTudo = true;
    garantirAcessos(sim);
    return;
  }
  for (const i of t.sujos) {
    t.viaSuja[i] = 0;
    if (i >= P.n || !P.viva[i]) {
      t.viaE[i] = -1;
      continue;
    }
    resolverUm(sim, t, i);
  }
  t.sujos.length = 0;
}

function resolverUm(sim, t, i) {
  const P = sim.tabelas.predios;
  const celulas = P.tipo[i] === TIPO_PREDIO.ZONA && viaPelasCelulas(sim, i, OV);
  if (!celulas) viaPelaFrente(sim, i, OV);
  t.viaE[i] = OV.e;
  t.viaS[i] = OV.s;
  t.viaGer[i] = P.ger[i];
  t.viaFrente[i] = celulas ? 0 : 1;
}

/** Aresta de acesso do prédio i (-1 sem acesso) e o arco a partir do nó a: out = { e, s }. */
export function acessoDe(sim, i, out = { e: -1, s: 0 }) {
  garantirAcessos(sim);
  const t = trans(sim);
  const P = sim.tabelas.predios;
  // vaga reaproveitada por um prédio novo (a geração mudou): resolve agora
  if (t.viaGer[i] !== P.ger[i] && P.viva[i]) resolverUm(sim, t, i);
  out.e = t.viaE[i];
  out.s = t.viaS[i];
  return out;
}

// ------------------------------------------------------------------------------------------------ colocar

const MEIA_VOLTA = Math.PI / 2;
const normRot = (r) => ((r % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

/** Via mais perto de (x, z) que dá acesso a um colocável (qualquer uma, menos a rodovia), até 60 m da borda. */
function viaParaColocar(sim, x, z) {
  const A = sim.tabelas.arestas;
  const G = sim.grafo;
  if (!G) return null;
  const R = 60 + MEIA_MAX;
  let melhor = null;
  for (const e of Array.from(G.gradeArestas.consultar(x - R, z - R, x + R, z + R))) {
    if (!A.viva[e]) continue;
    const tipo = VIAS[VIAS_ORDEM[A.tipo[e]]];
    if (!tipo || VIAS_ORDEM[A.tipo[e]] === 'rodovia') continue;
    maisPerto(A.p, x, z, 8 * e, MP);
    const d = MP.d - tipo.largura / 2;
    if (d <= 60 && (!melhor || d < melhor.d)) melhor = { e, t: MP.t, d, px: MP.x, pz: MP.z, meia: tipo.largura / 2 };
  }
  return melhor;
}

/**
 * Lugar de um colocável de frente para a via: { x, z, rot, w, d, e, contorno, giro } ou { codigo: 'acesso' }.
 * `absoluto`: rot é a rotação final (o comando construir com o x, z, rot da prévia); senão é o giro da ferramenta
 * (0, 90, 180 ou 270 graus somados à frente para a via).
 */
export function lugarDoColocavel(sim, def, { x, z, rot = 0 }, absoluto = false) {
  const [w, d] = plantaDe(def);
  const v = viaParaColocar(sim, x, z);
  if (!v) return { codigo: 'acesso' };
  const A = sim.tabelas.arestas;
  const tg = tangente(A.p, v.t, [0, 0], 8 * v.e);
  const c = hipot(tg[0], tg[1]) || 1;
  const tx = tg[0] / c;
  const tz = tg[1] / c;
  const lado = (x - v.px) * -tz + (z - v.pz) * tx >= 0 ? 1 : -1;
  const nx = -tz * lado;
  const nz = tx * lado;
  const rotVia = normRot(atan2(-nx, -nz));
  let giro = absoluto ? Math.round(normRot(rot - rotVia) / MEIA_VOLTA) % 4 : Math.round(normRot(rot) / MEIA_VOLTA) % 4;
  if (!Number.isFinite(giro)) giro = 0;
  const fundo = giro % 2 ? w : d;
  const off = v.meia + fundo / 2 + 1;
  const cx = v.px + nx * off;
  const cz = v.pz + nz * off;
  const rf = normRot(rotVia + giro * MEIA_VOLTA);
  return { x: cx, z: cz, rot: rf, w, d, e: v.e, giro, contorno: cantosRetangulo(cx, cz, rf, w, d) };
}

/** Pontos de amostra dentro da planta (cantos, meio das bordas e uma grade a cada ~8 m). */
function amostrasDaPlanta(L, passo = 8) {
  const out = [];
  const fx = sen(L.rot);
  const fz = cos(L.rot);
  const nu = Math.max(1, Math.round(L.w / passo));
  const nv = Math.max(1, Math.round(L.d / passo));
  for (let a = 0; a <= nu; a++) {
    for (let b = 0; b <= nv; b++) {
      const u = (a / nu - 0.5) * L.w;
      const vv = (b / nv - 0.5) * L.d;
      // eixo da frente (largura) é (cos rot, -sen rot); o fundo é a frente (sen, cos)
      out.push(L.x + u * fz + vv * fx, L.z - u * fx + vv * fz);
    }
  }
  return out;
}

/**
 * Confere o lugar (sem mudar nada). Devolve { codigo, demolir: [idx de prédios de zona sob a planta], cota }.
 */
export function conferirLugar(sim, tipo, def, L) {
  const P = sim.tabelas.predios;
  const A = sim.tabelas.arestas;
  const T = sim.espelho.terreno;
  if (!colocavelLiberado(sim, tipo, def)) return { codigo: 'marco' };
  const pts = amostrasDaPlanta(L);
  let hmin = Infinity;
  let hmax = -Infinity;
  for (let k = 0; k < pts.length; k += 2) {
    const x = pts[k];
    const z = pts[k + 1];
    if (sim.espelho.ladrilhos && !daHolding(sim, x, z)) return { codigo: 'ladrilho' };
    if (naGleba(sim, x, z, 0)) return { codigo: 'gleba' };
    if (T?.agua && aguaEm(T, x, z) !== AGUA.TERRA) return { codigo: 'agua' };
    const h = sim.alturaEm(x, z);
    if (h < hmin) hmin = h;
    if (h > hmax) hmax = h;
  }
  if (hmax - hmin > Math.max(4, 0.12 * Math.max(L.w, L.d))) return { codigo: 'declive' };
  // vias que cortam a planta
  const R = Math.max(L.w, L.d) / 2 + MEIA_MAX;
  const ids = Array.from(sim.grafo.gradeArestas.consultar(L.x - R, L.z - R, L.x + R, L.z + R));
  const DE = { d: 0, s: 0 };
  for (const e of ids) {
    if (!A.viva[e]) continue;
    const meia = VIAS[VIAS_ORDEM[A.tipo[e]]].largura / 2;
    const ex = eixoDa(sim, e);
    for (let k = 0; k < pts.length; k += 2) {
      distEixo(ex, pts[k], pts[k + 1], DE, meia + 1);
      if (DE.d < meia - 0.25) return { codigo: 'colisao' };
    }
  }
  // prédios: de zona saem (CS2); serviço e Holding batem
  const demolir = [];
  const caixa = [Infinity, Infinity, -Infinity, -Infinity];
  for (let k = 0; k < 8; k += 2) {
    caixa[0] = Math.min(caixa[0], L.contorno[k]);
    caixa[2] = Math.max(caixa[2], L.contorno[k]);
    caixa[1] = Math.min(caixa[1], L.contorno[k + 1]);
    caixa[3] = Math.max(caixa[3], L.contorno[k + 1]);
  }
  for (const i of prediosNaCaixa(sim, caixa[0], caixa[1], caixa[2], caixa[3])) {
    if (!sobrepoe(P, i, L)) continue;
    if (P.tipo[i] === TIPO_PREDIO.ZONA) demolir.push(i);
    else return { codigo: 'colisao' };
  }
  // água na margem (captação, ETE): água a até `margem` metros do fundo da planta
  if (def.margem && T?.agua) {
    const fx = sen(L.rot);
    const fz = cos(L.rot);
    let achou = false;
    const meio = L.giro % 2 ? L.w : L.d;
    for (let s = -1; s <= 1 && !achou; s += 0.5) {
      for (let m = 0; m <= def.margem && !achou; m += 4) {
        // o fundo fica do lado oposto à frente
        const off = meio / 2 + m;
        const lx = fz * s * (L.w / 2);
        const lz = -fx * s * (L.w / 2);
        if (aguaEm(T, L.x - fx * off + lx, L.z - fz * off + lz) !== AGUA.TERRA) achou = true;
      }
    }
    if (!achou) return { codigo: 'agua' };
  }
  if (def.recurso && sim.espelho.recursos) {
    const r = recursoNoPoligono(sim.espelho.recursos, def.recurso, L.contorno);
    if (!(r.media >= 20)) return { codigo: 'recurso' };
  }
  if (typeof def.validar === 'function') {
    const c = def.validar(sim, L);
    if (c) return { codigo: c };
  }
  return { codigo: null, demolir, cota: Math.floor(sim.alturaEm(L.x, L.z) * 100) / 100 };
}

function sobrepoe(P, i, L) {
  const c = cantosRetangulo(P.x[i], P.z[i], P.rot[i], P.w[i], P.d[i]);
  for (let k = 0; k < 8; k += 2) if (pontoNoRetangulo(c[k], c[k + 1], L.x, L.z, L.rot, L.w, L.d, -0.5)) return true;
  for (let k = 0; k < 8; k += 2) if (pontoNoPredio(P, i, L.contorno[k], L.contorno[k + 1], -0.5)) return true;
  return pontoNoPredio(P, i, L.x, L.z, -0.5) || pontoNoRetangulo(P.x[i], P.z[i], L.x, L.z, L.rot, L.w, L.d, -0.5);
}

/** Manutenção por hora de um colocável (o custo que entra em sim.custos quando pronto). */
export const manutencaoDe = (def) => def?.manutencaoHora ?? def?.manutencao ?? def?.manut ?? 0;

/**
 * q.construir.previa({ tipo, x, z, rot }) → { ok, codigo?, x, z, rot, custo, custoDemolir, manutencaoHora, alcance, efeitos,
 * pegada, demolir }. O custo já soma a demolição dos prédios de zona sob a planta (D54).
 */
export function previaConstruir(sim, args = {}) {
  const { tipo } = args;
  const def = sim.colocaveis.obter(tipo);
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  if (!def || !num(args.x) || !num(args.z)) return { ok: false, codigo: 'valor', x: args.x, z: args.z, rot: args.rot ?? 0, custo: 0, manutencaoHora: 0, alcance: 0, efeitos: [] };
  const base = { custo: def.custo ?? 0, manutencaoHora: manutencaoDe(def), alcance: def.raio ?? def.alcance ?? 0, pegada: plantaDe(def) };
  const L = lugarDoColocavel(sim, def, { x: args.x, z: args.z, rot: num(args.rot) ? args.rot : 0 }, !!args.absoluto);
  if (L.codigo) return { ok: false, codigo: L.codigo, x: args.x, z: args.z, rot: args.rot ?? 0, ...base, efeitos: [] };
  const c = conferirLugar(sim, tipo, def, L);
  const P = sim.tabelas.predios;
  const dem = custoDosDemolidos(sim, c.demolir);
  const out = {
    ...base, custo: base.custo + dem, custoDemolir: dem, x: L.x, z: L.z, rot: L.rot, efeitos: efeitosDaPrevia(sim, tipo, def, L),
    demolir: (c.demolir ?? []).map((i) => P.ref(i)),
    // produtor de rede de frente para uma rua sem canos nem cabos (terra): pode construir, mas não liga até melhorar
    semRede: produtorDeRede(tipo, def) && !viaComRede(sim, L.e),
  };
  if (c.codigo) return { ok: false, codigo: c.codigo, ...out };
  const caixa = sim.holding.caixa();
  if (caixa < out.custo) return { ok: false, codigo: 'creditos', dados: { faltam: out.custo - caixa }, ...out };
  return { ok: true, ...out };
}

/** true se o colocável põe água, energia ou esgoto na rede (captação, poço, usina, ETE, termelétrica). */
export const produtorDeRede = (tipo, def) => !!CATEGORIAS_SERVICO[(def ?? SERVICOS[tipo])?.categoria]?.rede;

/** true se a aresta e leva canos e cabos (via com calçada, VIAS[tipo].redes). */
export const viaComRede = (sim, e) => e >= 0 && sim.tabelas.arestas.viva[e] === 1 && !!VIAS[VIAS_ORDEM[sim.tabelas.arestas.tipo[e]]]?.redes;

/** D54: os prédios de zona que saem para o colocável custam os materiais do nível deles, como na via. */
function custoDosDemolidos(sim, lista) {
  let s = 0;
  for (const i of lista ?? []) s += custoDemolirPredio(sim, i);
  return s;
}

// efeitos previstos na vizinhança (as setas do Anno 117): moradores que passam a ser atendidos e a oferta da rede
const efeitosPrevia = [];
/** Outro domínio (servicos.js) diz os efeitos da prévia de um tipo: fn(sim, tipo, def, lugar) → [{ camada, delta }]. */
export function registrarEfeitosPrevia(fn) {
  if (!efeitosPrevia.includes(fn)) efeitosPrevia.push(fn);
}
function efeitosDaPrevia(sim, tipo, def, L) {
  const out = [];
  for (const fn of efeitosPrevia) for (const e of fn(sim, tipo, def, L) ?? []) out.push(e);
  return out;
}

/** comando construir { tipo, x, z, rot } (o x, z e rot da prévia; rot é a rotação final). */
export function construir(sim, args = {}) {
  const { tipo } = args;
  const def = sim.colocaveis.obter(tipo);
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  if (!def || !num(args.x) || !num(args.z)) return { ok: false, codigo: 'valor' };
  const L = lugarDoColocavel(sim, def, { x: args.x, z: args.z, rot: num(args.rot) ? args.rot : 0 }, true);
  if (L.codigo) return { ok: false, codigo: L.codigo };
  const c = conferirLugar(sim, tipo, def, L);
  if (c.codigo) return { ok: false, codigo: c.codigo };
  const custo = (def.custo ?? 0) + custoDosDemolidos(sim, c.demolir);
  if (sim.holding.caixa() < custo) return { ok: false, codigo: 'creditos', dados: { faltam: custo - sim.holding.caixa() } };
  if (custo > 0 && !sim.holding.pagar(custo, 'construcao')) return { ok: false, codigo: 'creditos' };
  const P = sim.tabelas.predios;
  const demolidos = [];
  for (const i of c.demolir) {
    demolidos.push(P.ref(i));
    removerPredio(sim, i);
  }
  const i = P.alocar();
  if (i < 0) return { ok: false, codigo: 'erro' };
  const servico = ehServico(tipo, def);
  const T = sim.tique;
  P.tipo[i] = servico ? TIPO_PREDIO.SERVICO : TIPO_PREDIO.HOLDING;
  P.modelo[i] = servico ? SERVICOS_ORDEM.indexOf(tipo) : def.modelo ?? Math.max(0, dadosHolding.HOLDING_ORDEM?.indexOf(tipo) ?? 0);
  P.zona[i] = 0;
  P.x[i] = L.x;
  P.z[i] = L.z;
  P.y[i] = c.cota;
  P.rot[i] = L.rot;
  P.w[i] = Math.round(L.w);
  P.d[i] = Math.round(L.d);
  P.nivel[i] = 1;
  P.estilo[i] = 0;
  P.semente[i] = sim.rng('construir').u32();
  const dur = Math.max(1, def.obraTiques ?? 60);
  P.flags[i] = PREDIO.OBRA | (servico ? 0 : PREDIO.HOLDING);
  P.obraIni[i] = T;
  P.obraFim[i] = T + dur;
  P.cor[i] = 0;
  P.efic[i] = 0;
  P.marcar(i);
  const ref = P.ref(i);
  sim.formas.registrar({ tipo: 'plataforma', ref, contorno: L.contorno, cota: P.y[i] });
  const pad = Math.max(L.w, L.d) / 2 + 8;
  revalidarRetangulo(sim, L.x - pad, L.z - pad, L.x + pad, L.z + pad);
  const t = trans(sim);
  t.servSujo = true;
  t.redesSujas = true;
  if (typeof def.aoConstruir === 'function') def.aoConstruir(sim, i, ref);
  if (def.xp) sim.progresso.xp(def.xp, servico ? 'servico' : 'holding');
  if (demolidos.length) sim.emitir('demolido', { tipo: 'predio', refs: demolidos });
  sim.emitir('construido', { tipo, refs: [ref] });
  return { ok: true, id: ref, dados: { ref, demolidos } };
}

// ------------------------------------------------------------------------------------------------ demolir

/** Quanto demolir o prédio i custa (positivo) ou devolve (negativo): D54 na zona, 50% de volta no colocável. */
export function custoDemolir(sim, i) {
  const k = tipoDoPredio(sim, i);
  if (k.tipo === 'zona') return custoDemolirPredio(sim, i);
  if (typeof k.def?.custoDemolir === 'function') return k.def.custoDemolir(sim, i);
  return -Math.round(0.5 * (k.def?.custo ?? 0));
}

/** Tira um prédio da cidade (sem cobrar): plataforma, células, avisos e os índices. Devolve a ref. */
export function tirarPredio(sim, i) {
  const P = sim.tabelas.predios;
  const k = tipoDoPredio(sim, i);
  if (k.tipo !== 'zona' && typeof k.def?.aoDemolir === 'function') k.def.aoDemolir(sim, i);
  const ref = P.ref(i);
  const r = Math.max(P.w[i], P.d[i]) + 8;
  const caixa = [P.x[i] - r, P.z[i] - r, P.x[i] + r, P.z[i] + r];
  delete sim.json.cidade.nomes[ref];
  const colocado = P.tipo[i] !== TIPO_PREDIO.ZONA;
  removerPredio(sim, i);
  if (colocado) {
    revalidarRetangulo(sim, caixa[0], caixa[1], caixa[2], caixa[3]);
    const t = trans(sim);
    t.servSujo = true;
    t.redesSujas = true;
  }
  return ref;
}

/** comando demolir { refs }: D54 (a zona custa os materiais do nível a 100%); serviço e Holding devolvem 50%. */
export function demolir(sim, { refs } = {}) {
  const P = sim.tabelas.predios;
  if (!Array.isArray(refs) || !refs.length) return { ok: false, codigo: 'valor' };
  const lista = [];
  let custo = 0;
  for (const r of refs) {
    const i = P.idxVivo(r);
    if (i < 0) return { ok: false, codigo: 'inexistente' };
    const k = tipoDoPredio(sim, i);
    if (k.def?.arcologia || k.def?.demolivel === false) return { ok: false, codigo: 'arcologia' };
    if (!lista.includes(i)) {
      lista.push(i);
      custo += custoDemolir(sim, i);
    }
  }
  if (custo > 0 && !sim.holding.pagar(custo, 'demolicao')) return { ok: false, codigo: 'creditos', dados: { faltam: custo - sim.holding.caixa() } };
  if (custo < 0) sim.holding.receber(-custo, 'demolicao');
  const out = lista.sort((a, b) => a - b).map((i) => tirarPredio(sim, i));
  sim.emitir('demolido', { tipo: 'predio', refs: out });
  return { ok: true, dados: { refs: out, custo } };
}

// ------------------------------------------------------------------------------------------------ cor e nome

function predioCor(sim, { ref, cor } = {}) {
  const P = sim.tabelas.predios;
  const i = P.idxVivo(ref);
  if (i < 0) return { ok: false, codigo: 'inexistente' };
  if (!Number.isInteger(cor) || cor < 0 || cor > 15) return { ok: false, codigo: 'valor' };
  P.cor[i] = cor;
  P.marcar(i);
  return { ok: true };
}

function predioNome(sim, { ref, nome } = {}) {
  const P = sim.tabelas.predios;
  const i = P.idxVivo(ref);
  if (i < 0) return { ok: false, codigo: 'inexistente' };
  if (nome === null || nome === '') {
    delete sim.json.cidade.nomes[ref];
    return { ok: true };
  }
  if (typeof nome !== 'string' || !nome.trim() || nome.trim().length > 40) return { ok: false, codigo: 'valor' };
  sim.json.cidade.nomes[ref] = nome.trim();
  return { ok: true };
}

// ------------------------------------------------------------------------------------------------ avisos

/** Gravidade (índice em GRAVIDADES) e glifo (índice em GLIFOS_AVISO) do pior aviso de uma máscara, ou null. */
export function piorAviso(mascara, problema = 0) {
  for (const a of AVISOS_PREDIO) {
    if (!(mascara & a.bit)) continue;
    let g = a.gravidade;
    if (a.bit === AV.ABANDONO && problema >= ABANDONO.vermelho) g = 'grave';
    return { codigo: a.codigo, glifo: GLIFOS_AVISO.indexOf(a.glifo), gravidade: GRAVIDADES.indexOf(g), g };
  }
  return null;
}

/**
 * q.avisosPredios() → { versao, idx, glifo, gravidade, nomes } (os nomes dos glifos pelo índice). Vão todos os avisos,
 * os de informação também (desemprego, bem-estar baixo): o filtro "Graves e atenção" da UI é quem os tira (desenho da
 * UI 8.9: "todos · só graves e atenção · nenhum").
 */
export function avisosPredios(sim) {
  const P = sim.tabelas.predios;
  const idx = [];
  const glifo = [];
  const grav = [];
  for (let i = 0; i < P.n; i++) {
    if (!P.viva[i] || !P.avisos[i]) continue;
    const a = piorAviso(P.avisos[i], P.problema[i]);
    if (!a) continue;
    idx.push(i);
    glifo.push(a.glifo);
    grav.push(a.gravidade);
  }
  return { versao: sim.json.cidade.avisosVersao, idx: Int32Array.from(idx), glifo: Uint8Array.from(glifo), gravidade: Uint8Array.from(grav), nomes: GLIFOS_AVISO };
}

const alertasCidade = [];
/** Outro domínio da S2a registra alertas da cidade: fn(sim) → [{ id, gravidade, glifo, codigo, params, alvo }]. */
export function registrarAlertas(fn) {
  if (!alertasCidade.includes(fn)) alertasCidade.push(fn);
}

/** Alertas da cidade (falta de água e energia, desemprego, abandono...), os mais graves primeiro. */
export function alertas(sim) {
  const out = [];
  for (const fn of alertasCidade) for (const a of fn(sim) ?? []) out.push(a);
  const ordem = { grave: 0, atencao: 1, info: 2 };
  return out.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade] || (a.id < b.id ? -1 : 1));
}

/** q.avisos({ perto, limite }) → alertas da cidade, os de alvo mais perto primeiro dentro da mesma gravidade. */
export function consultaAvisos(sim, { perto = null, limite = 20 } = {}) {
  let lista = alertas(sim);
  if (perto && Number.isFinite(perto.x) && Number.isFinite(perto.z)) {
    const ordem = { grave: 0, atencao: 1, info: 2 };
    const d = (a) => (a.alvo && Number.isFinite(a.alvo.x) ? hipot(a.alvo.x - perto.x, a.alvo.z - perto.z) : Infinity);
    lista = lista.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade] || d(a) - d(b));
  }
  return lista.slice(0, Math.max(0, limite | 0));
}

// ------------------------------------------------------------------------------------------------ catálogo

/** q.catalogo(categoria) → [{ tipo, nome, custo, manutencaoHora, marco, liberado, grupo, capacidade, alcance, pegada, faz }]. */
export function catalogo(sim, categoria) {
  const out = [];
  const tipos = sim.colocaveis.tipos();
  const ordem = (a) => (SERVICOS[a] ? SERVICOS_ORDEM.indexOf(a) : 1000 + (dadosHolding.HOLDING_ORDEM?.indexOf(a) ?? 0));
  for (const tipo of [...tipos].sort((a, b) => ordem(a) - ordem(b) || (a < b ? -1 : 1))) {
    const def = sim.colocaveis.obter(tipo);
    const barra = barraDe(tipo, def);
    if (categoria && barra !== categoria) continue;
    if (!parteOk(def.parte)) continue;
    out.push({
      tipo, nome: def.nome ?? tipo, categoria: barra, grupo: BARRAS.includes(def.categoria) ? null : def.categoria ?? null, custo: def.custo ?? 0,
      manutencaoHora: manutencaoDe(def), marco: def.marco ?? 0, liberado: colocavelLiberado(sim, tipo, def),
      capacidade: def.capacidade ?? null, alcance: def.raio ?? def.alcance ?? 0, pegada: plantaDe(def), faz: def.faz ?? null,
    });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ q.predio

const partesPredio = [];
/** Outro domínio da S2a completa q.predio: fn(sim, i, saida). */
export function registrarPartePredio(fn) {
  if (!partesPredio.includes(fn)) partesPredio.push(fn);
}

/** q.predio(ref): o formato da seção 2.6 (com tipo 'zona' | 'servico' | 'holding' e o id do catálogo). */
export function consultaPredio(sim, ref) {
  const P = sim.tabelas.predios;
  const i = P.idxVivo(ref);
  if (i < 0) return null;
  const k = tipoDoPredio(sim, i);
  const f = P.flags[i];
  const T = sim.tique;
  const frac = sim.espelho.tempo?.frac ?? 0;
  const zonaId = ZONAS_ORDEM[P.zona[i]] || null;
  let obra = null;
  if (f & PREDIO.OBRA) {
    const p = progressoObra(T, frac, P.obraIni[i], P.obraFim[i]);
    obra = {
      fase: FASES_OBRA[Math.max(0, faseObra(p))].id, progresso: f & PREDIO.SEM_MATERIAL ? 0 : p, ini: P.obraIni[i],
      fimTique: P.obraFim[i], semMaterial: !!(f & PREDIO.SEM_MATERIAL), nivel: !!(f & PREDIO.OBRA_NIVEL),
    };
  }
  const via = acessoDe(sim, i);
  const A = sim.tabelas.arestas;
  let viaInfo = null;
  if (via.e >= 0 && A.viva[via.e]) {
    const r = refDe(via.e, A.ger[via.e]);
    let nome = null;
    try {
      nome = sim.q.aresta ? sim.q.aresta(r)?.nome ?? null : null;
    } catch {
      nome = null;
    }
    viaInfo = { ref: r, nome };
  }
  const out = {
    ref, idx: i, tipo: k.tipo, id: k.id, modelo: P.modelo[i], nome: sim.json.cidade.nomes[ref] ?? k.def?.nome ?? k.id,
    zona: P.zona[i], zonaId, familia: zonaId ? ZONAS[zonaId].familia : null, nivel: P.nivel[i],
    estado: f & PREDIO.ABANDONADO ? 'abandonado' : f & PREDIO.OBRA && !(f & PREDIO.OBRA_NIVEL) ? 'obra' : 'ok',
    obra, moradia: null, trabalho: null, nivelProx: null, servicos: null, servico: null, holding: null, avisos: [],
    cor: P.cor[i], via: viaInfo, x: P.x[i], z: P.z[i], y: P.y[i], rot: P.rot[i], w: P.w[i], d: P.d[i],
    faz: k.tipo === 'zona' ? ZONAS[zonaId]?.faz ?? null : k.def?.faz ?? null,
    custoDemolir: custoDemolir(sim, i),
  };
  for (const a of AVISOS_PREDIO) {
    if (!(P.avisos[i] & a.bit)) continue;
    const g = a.bit === AV.ABANDONO && P.problema[i] >= ABANDONO.vermelho ? 'grave' : a.gravidade;
    out.avisos.push({ codigo: a.codigo, gravidade: g, desde: Math.max(0, T - P.problema[i]), acao: acaoDoAviso(a.codigo) });
  }
  for (const fn of partesPredio) fn(sim, i, out);
  if (k.tipo === 'holding' && typeof sim.holding.folha === 'function') out.holding = sim.holding.folha(ref) ?? null;
  if (k.tipo !== 'zona' && typeof k.def?.consulta === 'function') Object.assign(out, k.def.consulta(sim, i) ?? {});
  return out;
}

const ACOES = {
  semAgua: 'verCamadaAgua', semEnergia: 'verCamadaEnergia', racionado: 'verCamadaEnergia', semAcesso: 'construirVia', semRede: 'construirVia',
  semTrabalhadores: 'verCamadaEmpregos', abandonado: 'demolir', abandono: 'verCamadaBemEstar', bemEstarBaixo: 'verCamadaBemEstar',
};
const acaoDoAviso = (codigo) => ACOES[codigo] ?? null;

// ------------------------------------------------------------------------------------------------ camadas

/**
 * Versão de uma camada pelos próprios dados (FNV-1a dos valores): muda quando o dado muda, também com o jogo pausado
 * (zona pintada, prédio demolido), e fica igual entre rodadas sem mudança (o render não recebe a camada à toa).
 */
function versaoDosDados(dados, extra = 0) {
  let h = Math.imul(2166136261 ^ extra, 16777619);
  for (let k = 0; k < dados.length; k++) h = Math.imul(h ^ ((dados[k] | 0) + 7 * k), 16777619);
  return h >>> 0;
}

function camadaZonas(sim) {
  const C = sim.tabelas.celulas;
  const dados = new Float32Array(C.n);
  let ocupadas = 0;
  let pintadas = 0;
  for (let c = 0; c < C.n; c++) {
    if (!C.viva[c] || C.estado[c] === CELULA.INVALIDA) continue;
    dados[c] = C.zona[c];
    if (C.zona[c]) pintadas++;
    if (C.estado[c] === CELULA.OCUPADA) ocupadas++;
  }
  const cats = ZONAS_ORDEM.map((id, v) => ({ v, chave: id ? `zona.${id}` : 'zona.nenhuma' })).filter((x) => !x.v || zonaNaParte(ZONAS_ORDEM[x.v]));
  return {
    id: 'zonas', fonte: 'celulas', dados, grade: null, tipo: 'cat', escala: { min: 0, max: ZONAS_ORDEM.length - 1, unidade: '' },
    categorias: cats, legenda: cats.filter((x) => x.v), resumo: { chave: 'camada.zonas.resumo', params: { pintadas, ocupadas } },
    versao: versaoDosDados(dados, ocupadas),
  };
}

function camadaNivel(sim) {
  const P = sim.tabelas.predios;
  const dados = new Float32Array(P.n);
  const conta = [0, 0, 0, 0, 0];
  for (let i = 0; i < P.n; i++) {
    if (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.ZONA) continue;
    dados[i] = P.nivel[i];
    conta[P.nivel[i] - 1]++;
  }
  const cats = [1, 2, 3, 4, 5].map((v) => ({ v, chave: `camada.nivel.${v}` }));
  return {
    id: 'nivel', fonte: 'predios', dados, grade: null, tipo: 'cat', escala: { min: 1, max: 5, unidade: '' }, categorias: cats,
    legenda: cats, resumo: { chave: 'camada.nivel.resumo', params: { n1: conta[0], n2: conta[1], n3: conta[2], n4: conta[3], n5: conta[4] } },
    versao: versaoDosDados(dados),
  };
}

// ------------------------------------------------------------------------------------------------ registro

/**
 * Depois que o aplainar refaz um retângulo do chão, a cota dos prédios dele acompanha o chão no centro (invariante do
 * espelho). Lotes de 8 m de frente dividem as amostras de 8 m da grade com o vizinho: a plataforma de um prédio novo ao
 * lado mexe alguns centímetros no chão do outro.
 */
function acompanharChao(sim, x0, z0, x1, z1) {
  const P = sim.tabelas.predios;
  for (const i of prediosNaCaixa(sim, x0, z0, x1, z1)) {
    const h = Math.fround(sim.alturaEm(P.x[i], P.z[i]));
    if (Math.abs(P.y[i] - h) > 0.001) {
      P.y[i] = h;
      P.marcar(i);
    }
  }
}

export function registrar(sim) {
  if (!sim.tabelas.predios || !sim.grafo) return;
  prepararCidade(sim);
  const antes = sim.formas.marcarRet;
  sim.formas.marcarRet = (x0, z0, x1, z1) => {
    if (antes) antes(x0, z0, x1, z1);
    acompanharChao(sim, x0, z0, x1, z1);
  };
  sim.registrarComando('construir', construir);
  sim.registrarComando('demolir', demolir);
  sim.registrarComando('predio.cor', predioCor);
  sim.registrarComando('predio.nome', predioNome);
  sim.registrarConsulta('construir.previa', previaConstruir);
  sim.registrarConsulta('predio', consultaPredio);
  sim.registrarConsulta('catalogo', catalogo);
  sim.registrarConsulta('avisosPredios', avisosPredios);
  sim.registrarConsulta('avisos', consultaAvisos);
  sim.camadas.registrar('zonas', camadaZonas);
  sim.camadas.registrar('nivel', camadaNivel);
}

