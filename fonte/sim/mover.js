// Mover e girar construções prontas (MOV1, D94; dona: MOV1). Os colocáveis (serviços, prédios da Holding, praças e marcos
// do complexo) mudam de lugar ou de direção por uns 10% do custo, com uma obra curta, como o mover do Planet Coaster e do
// Cities: Skylines II; a Arcologia fica fixa. Os prédios de ZONA também se movem (MOV2, D105, pedido do dono de 08/10/2026,
// que revoga a exclusão da D94), prontos ou em obra: dentro da mesma zona, em outra do mesmo tipo ou em chão livre ao longo de
// uma via, de frente para ela e girados à vontade. As células do lugar antigo voltam a poder crescer um prédio novo e as do
// lugar novo passam a ser dele (blocos.js). O custo é a mesma fração sobre o valor do prédio (os materiais do nível, a mesma
// base da demolição, D54); em obra a base é o que já foi gasto e a obra segue do mesmo ponto de progresso (ini e fim se
// deslocam juntos, só o aplainar alonga). Pronto, o prédio de zona entra na obra de reforma (OBRA e OBRA_NIVEL): segue com os
// moradores, o nível e os empregos e não dispara o evento de subir de nível ao acabar (json.mover.zona).
//
// O prédio é a MESMA linha da tabela: ref, nome, cor, nível, semente, produção em andamento, estoque e trabalhadores são
// os de antes, porque tudo isso mora em tabelas e seções indexadas pela ref ou é derivado da posição. O que muda é o
// lugar (x, z, y, rot), a plataforma do aplainar e as bandeiras da obra: ele sai de serviço (funciona() é falso na obra),
// espera a equipe (`mobilizacao` tiques, em que o Desfazer ainda vale e devolve tudo) e roda a obra curta; ao terminar, o
// mesmo fim de obra de qualquer colocável (sistemaCrescimento) o põe de volta e a cobertura dos serviços, as redes e o
// acesso à via são refeitos no lugar novo. Determinístico: nada aqui sorteia nem lê relógio; o que fica para o Desfazer
// vai na seção JSON 'mover' (save e hash).
//
// Contrato (ainda fora de contratos/, pendência do integrador): comando `mover` { ref, x, z, rot, giro?, alinhar?, aplainar? }
// (os mesmos argumentos do `construir`, mais a ref do prédio), comando `mover.desfazer` { ref } e consulta
// `mover.previa` (o mesmo argumento do comando) → { ok, codigo?, dados?, custo, custoMover, custoDemolir, custoAplainar,
// aplainar, x, z, rot, alinhado, rotVia, giro, via, alcance, pegada, de, tiques, mobilizacao, desfazer, demolir, semRede, muda }.
import { hipot } from '../comum/util.js';
import { cantosRetangulo } from '../comum/vetor.js';
import { RODADA } from '../comum/relogio.js';
import { refDe } from '../contratos/espelho.js';
import { PREDIO, TIPO_PREDIO } from '../contratos/flags.js';
import { ORDEM } from '../contratos/interno.js';
import { SERVICOS, SERVICOS_ORDEM } from '../data/servicos.js';
import { PREDIOS_HOLDING } from '../data/holding.js';
import { prediosNaCaixa } from './vias/validar.js';
import { removerPredio, revalidarRetangulo, soltarCelulas, ocuparCelulas, celulasParaPredio, celulasDoPredio } from './zonas/blocos.js';
import { custoDemolirPredio } from './vias/demolir.js';
import { ZONAS_ORDEM } from '../data/zonas.js';
import { garantirCobertura, buscar } from './servicos.js';
import { armazemPerto } from './holding/producao.js';
import {
  tipoDoPredio, lugarDoColocavel, conferirLugar, acessoDoLugar, acessoDe, trans, sujarVia, custoDosDemolidos, funciona, familiaDe, plantaDe,
  registrarPartePredio, produtorDeRede, viaComRede,
} from './predios.js';

/**
 * Regras de mover (calibrar): `fracao` do custo do prédio (D94, "uns 10%"); a obra curta dura `obraFracao` da obra de
 * construir (no mínimo `obraMin` tiques, mais os do aplainar); `mobilizacao` tiques de espera antes da obra, e é até ali que
 * o Desfazer vale.
 */
export const MOVER = Object.freeze({ fracao: 0.1, obraFracao: 0.4, obraMin: 12, mobilizacao: 12 });

/** A obra de um prédio de zona novo (CRESCIMENTO.obraBase e obraPorAndar, em crescimento.js; cópia para não fechar o ciclo de imports). */
const OBRA_ZONA = Object.freeze({ base: 45, porAndar: 10 });

/** Tolerância para "ficou no mesmo lugar": 25 cm e meio grau. */
const MESMO = Object.freeze({ metros: 0.25, rad: Math.PI / 360 });
const DOIS_PI = 2 * Math.PI;
const diferencaDeAngulo = (a, b) => Math.abs((((a - b) % DOIS_PI) + 3 * Math.PI) % DOIS_PI - Math.PI);

const J = (sim) => sim.json.mover;
const AC = { e: -1, s: 0 };

// ------------------------------------------------------------------------------------------------ regras

/**
 * O que impede mover o prédio i: null (pode) ou { codigo, dados } com o motivo ('arcologia' ou 'obra'). O prédio de zona
 * pode, pronto ou em obra (MOV2, D105); o colocável em obra espera acabar.
 */
export function impedimentoDeMover(sim, i) {
  const P = sim.tabelas.predios;
  const k = tipoDoPredio(sim, i);
  if (k.tipo === 'zona') return k.def?.demolivel === false ? { codigo: 'fixo', dados: { fixo: 'arcologia' } } : null;
  if (!k.def || k.def.arcologia || k.def.demolivel === false) return { codigo: 'fixo', dados: { fixo: 'arcologia' } };
  if (P.flags[i] & PREDIO.OBRA) return { codigo: 'ocupado', dados: { fixo: 'obra' } };
  return null;
}

/** Quanto custa mover um colocável (uns 10% do custo dele, D94). */
export const custoDeMover = (def) => Math.round(MOVER.fracao * (def?.custo ?? 0));

/** Tiques da obra curta de mover (sem o aplainar). */
export const tiquesDaObra = (def) => Math.max(MOVER.obraMin, Math.round(MOVER.obraFracao * (def?.obraTiques ?? 60)));

// ------------------------------------------------------------------------------------------------ prédio de zona (MOV2)

/** O prédio de zona i está na obra de nascimento (a que se mantém ao mover), e não na reforma de nível? */
const nascendo = (P, i) => !!(P.flags[i] & PREDIO.OBRA) && !(P.flags[i] & PREDIO.OBRA_NIVEL);

/** Progresso (0 a 1) da obra do prédio i no tique de agora. */
export function progressoDaObra(sim, i) {
  const P = sim.tabelas.predios;
  const total = P.obraFim[i] - P.obraIni[i];
  return total > 0 ? Math.min(1, Math.max(0, (sim.tique - P.obraIni[i]) / total)) : 1;
}

/**
 * A base do custo de mover um prédio de zona: o valor dele (os materiais do nível a 100% do preço base, a mesma conta da
 * demolição, D54) e, na obra de nascimento, só a fração já gasta (o progresso; parada por falta de material, nada foi gasto).
 */
export function baseDoCustoDeZona(sim, i) {
  const P = sim.tabelas.predios;
  const valor = custoDemolirPredio(sim, i);
  if (!nascendo(P, i)) return valor;
  return P.flags[i] & PREDIO.SEM_MATERIAL ? 0 : Math.round(valor * progressoDaObra(sim, i));
}

/** Custo de mover o prédio i (a fração da MOV1): do catálogo no colocável, da base de cima na zona. */
export const custoDeMoverPredio = (sim, i, k) => (k.tipo === 'zona' ? Math.round(MOVER.fracao * baseDoCustoDeZona(sim, i)) : custoDeMover(k.def));

/** Tiques da obra de mover o prédio i, sem o aplainar: a curta (pronto e colocável) ou o que falta da obra de nascimento. */
export function tiquesDoMover(sim, i, k) {
  const P = sim.tabelas.predios;
  if (k.tipo !== 'zona') return tiquesDaObra(k.def);
  if (nascendo(P, i)) return P.flags[i] & PREDIO.SEM_MATERIAL ? 0 : Math.max(0, P.obraFim[i] - sim.tique);
  const andares = k.nv ? (k.nv.andares[0] + k.nv.andares[1]) / 2 : 1;
  return tiquesDaObra({ obraTiques: OBRA_ZONA.base + OBRA_ZONA.porAndar * andares });
}

/**
 * Alonga a obra em curso (ini, fim) em `extra` tiques (o aplainar do lugar novo) sem mexer no progresso de agora: o que falta
 * cresce exatamente `extra` (a prévia soma o aplainar ao que faltava) e ini recua p/(1-p) do que falta, porque
 * progresso = (T - ini) / (fim - ini). Devolve [ini, fim].
 */
export function alongarObra(T, ini, fim, extra) {
  const total = fim - ini;
  const p = total > 0 ? Math.min(0.99, Math.max(0, (T - ini) / total)) : 0;
  const resto = Math.max(0, fim - T) + extra;
  return [T - Math.round((p / (1 - p)) * resto), T + resto];
}

/** O colocável de mentira que a conferência de lugar usa: o prédio de zona tem a planta em células no catálogo; a de verdade (metros) é a da tabela. */
const defDoLugar = (sim, i, k) => (k.tipo === 'zona' ? { ...k.def, planta: [sim.tabelas.predios.w[i], sim.tabelas.predios.d[i]] } : k.def);

/** Opções do conferirLugar de cada tipo: a zona só tem acesso pela frente. */
const opcoesDoLugar = (k, i, aplainar) => ({ aplainar, ignorar: i, semMarco: true, soFrente: k.tipo === 'zona' });

/** A seção json.mover guarda os prédios de zona em reforma de mover (para o fim da obra não contar nível). */
const zonasEmMover = (sim) => (J(sim).zona ??= {});

/**
 * O que o lugar L pede a mais para um prédio de zona (já conferido o geral): outro prédio de zona na planta é colisão (mover
 * não derruba o vizinho), zona de outro tipo pintada embaixo também; senão, as células que ele ocupa no lugar novo.
 * @returns {{ codigo: string, dados: object } | { celulas: number[], liberam: number }}
 */
function conferirZona(sim, i, L, c) {
  const P = sim.tabelas.predios;
  if (c.demolir?.length) {
    const b = c.demolir[0];
    return { codigo: 'colisao', dados: { com: 'predio', ref: P.ref(b), afastar: 1, nome: tipoDoPredio(sim, b).def?.nome ?? null } };
  }
  const z = celulasParaPredio(sim, { x: L.x, z: L.z, rot: L.rot, w: L.w, d: L.d }, P.zona[i], i);
  if (z.outraZona) return { codigo: 'colisao', dados: { com: 'zona', zona: ZONAS_ORDEM[z.outraZona] ?? null } };
  return { celulas: z.ocupar, liberam: celulasDoPredio(sim, i).length };
}

/** O que a folha precisa de um prédio: { pode, custo, codigo?, motivo?, desfazer?: { ate, restam } }. */
export function infoDeMover(sim, i) {
  const P = sim.tabelas.predios;
  const k = tipoDoPredio(sim, i);
  const imp = impedimentoDeMover(sim, i);
  if (imp) return { pode: false, custo: 0, codigo: imp.codigo, motivo: imp.dados.fixo };
  const out = { pode: true, custo: custoDeMoverPredio(sim, i, k) };
  if (k.tipo === 'zona') out.zona = true;
  if (P.flags[i] & PREDIO.OBRA) out.emObra = true;
  const rec = J(sim)?.pend[String(P.ref(i))];
  if (rec && sim.tique < rec.ate) out.desfazer = { ate: rec.ate, restam: rec.ate - sim.tique };
  return out;
}

// ------------------------------------------------------------------------------------------------ o que muda

/** Fontes de um tipo de serviço (menos `ignorar`): [{ i, e, s }] em ordem de índice, como servicos.js as vê. */
function fontesSem(sim, tipo, ignorar) {
  const P = sim.tabelas.predios;
  const A = sim.tabelas.arestas;
  const m = SERVICOS_ORDEM.indexOf(tipo);
  const out = [];
  for (let i = 0; i < P.n; i++) {
    if (i === ignorar || P.tipo[i] !== TIPO_PREDIO.SERVICO || P.modelo[i] !== m || !funciona(P, i)) continue;
    acessoDe(sim, i, AC);
    if (AC.e < 0 || !A.viva[AC.e]) continue;
    out.push({ i, e: AC.e, s: AC.s });
  }
  return out;
}

/** A busca do tipo sem o prédio i (a mesma em toda a prévia de um arrasto): guardada até a cobertura mudar. */
function baseSem(sim, i, tipo, cob) {
  const t = trans(sim);
  const chave = `${cob.versao}:${i}:${tipo}`;
  if (t.moverBase?.chave === chave) return t.moverBase;
  const A = sim.tabelas.arestas;
  const N = sim.tabelas.nos;
  const lista = fontesSem(sim, tipo, i);
  const fontes = [];
  for (const f of lista) fontes.push([A.a[f.e], f.s, f.i], [A.b[f.e], Math.max(0, A.arco[17 * f.e + 16] - f.s), f.i]);
  const dist = new Float64Array(N.n);
  const rot = new Int32Array(N.n);
  buscar(cob.csr, fontes, SERVICOS[tipo].raio, dist, rot);
  t.moverBase = { chave, lista, dist, rot };
  return t.moverBase;
}

/**
 * Distância pela via do ponto (e, s) até o serviço mais perto do tipo, na busca `dist` e `rot` mais as fontes `extras`
 * da mesma aresta: a mesma conta de distanciaTipo (servicos.js), sobre as listas de uma busca que o jogo ainda não tem.
 */
function distanciaEm(A, dist, rot, porAresta, e, s, out) {
  out.d = Infinity;
  out.r = -1;
  const a = A.a[e];
  const b = A.b[e];
  const comp = A.arco[17 * e + 16];
  if (a < dist.length) {
    out.d = dist[a] + s;
    out.r = rot[a];
  }
  if (b < dist.length) {
    const db = dist[b] + Math.max(0, comp - s);
    if (db < out.d || (db === out.d && rot[b] < out.r)) {
      out.d = db;
      out.r = rot[b];
    }
  }
  for (const f of porAresta.get(e) ?? []) {
    const dd = Math.abs(f.s - s);
    if (dd < out.d || (dd === out.d && f.i < out.r)) {
      out.d = dd;
      out.r = f.i;
    }
  }
  return out;
}

const DR = { d: Infinity, r: -1 };

/**
 * Moradores atendidos pela categoria do serviço antes e depois de ele ir para (e, s): { categoria, raio, antes, depois,
 * deixam, passam } (moradores). Antes é a cobertura que o jogo mede; depois refaz a busca do tipo sem o serviço e com ele
 * no lugar novo (o resto das categorias e dos tipos fica como está).
 */
function efeitoNaCobertura(sim, i, tipo, L, novo) {
  const s = SERVICOS[tipo];
  const P = sim.tabelas.predios;
  const A = sim.tabelas.arestas;
  const cob = garantirCobertura(sim);
  if (!s?.raio || !cob.tipos[tipo]) return null;
  const base = baseSem(sim, i, tipo, cob);
  const dist = base.dist.slice();
  const rot = base.rot.slice();
  const porAresta = new Map();
  for (const f of base.lista) {
    const l = porAresta.get(f.e);
    if (l) l.push(f);
    else porAresta.set(f.e, [f]);
  }
  if (novo.e >= 0 && A.viva[novo.e]) {
    const f = { i, e: novo.e, s: novo.s };
    buscar(cob.csr, [[A.a[f.e], f.s, i], [A.b[f.e], Math.max(0, A.arco[17 * f.e + 16] - f.s), i]], s.raio, dist, rot, true);
    const l = porAresta.get(f.e);
    if (l) l.push(f);
    else porAresta.set(f.e, [f]);
  }
  const eficI = P.efic[i] > 0 ? P.efic[i] : 1;
  const outrosTipos = Object.keys(SERVICOS).filter((t) => t !== tipo && SERVICOS[t].raio && SERVICOS[t].categoria === s.categoria);
  const centrosX = [P.x[i], L.x];
  const centrosZ = [P.z[i], L.z];
  const vistos = new Set();
  let antes = 0;
  let depois = 0;
  let deixam = 0;
  let passam = 0;
  for (let k = 0; k < 2; k++) {
    for (const b of prediosNaCaixa(sim, centrosX[k] - s.raio, centrosZ[k] - s.raio, centrosX[k] + s.raio, centrosZ[k] + s.raio)) {
      if (vistos.has(b)) continue;
      vistos.add(b);
      if (!funciona(P, b) || P.tipo[b] !== TIPO_PREDIO.ZONA || !P.moradores[b] || familiaDe(sim, b) !== 'res') continue;
      acessoDe(sim, b, AC);
      if (AC.e < 0 || !A.viva[AC.e]) continue;
      const e = AC.e;
      const pos = AC.s;
      // antes: o jogo como está (este serviço onde está e os outros)
      let cobAntes = 0;
      let cobDepois = 0;
      for (const t2 of [tipo, ...outrosTipos]) {
        const tc = cob.tipos[t2];
        if (!tc?.n) continue;
        const raio2 = SERVICOS[t2].raio;
        distanciaTipoOficial(A, tc, e, pos, DR);
        if (DR.r >= 0 && DR.d < raio2) cobAntes = Math.max(cobAntes, (1 - DR.d / raio2) * (P.efic[DR.r] || 0));
        if (t2 === tipo) {
          distanciaEm(A, dist, rot, porAresta, e, pos, DR);
          if (DR.r >= 0 && DR.d < raio2) cobDepois = Math.max(cobDepois, (1 - DR.d / raio2) * (DR.r === i ? eficI : P.efic[DR.r] || 0));
        } else if (DR.r >= 0 && DR.d < raio2) cobDepois = Math.max(cobDepois, (1 - DR.d / raio2) * (P.efic[DR.r] || 0));
      }
      const m = P.moradores[b];
      if (cobAntes > 0) antes += m;
      if (cobDepois > 0) depois += m;
      if (cobAntes > 0 && cobDepois <= 0) deixam += m;
      if (cobAntes <= 0 && cobDepois > 0) passam += m;
    }
  }
  return { categoria: s.categoria, raio: s.raio, antes, depois, deixam, passam };
}

/** A distância de distanciaTipo (servicos.js) sobre a busca de um tipo, sem pedir ao jogo para refazê-la. */
function distanciaTipoOficial(A, tc, e, s, out) {
  distanciaEm(A, tc.dist, tc.rot, tc.porAresta, e, s, out);
}

/** Nome e ref da via de uma aresta (sim.q.aresta, como o q.predio). */
function viaDe(sim, e) {
  const A = sim.tabelas.arestas;
  if (e < 0 || !A.viva[e]) return null;
  const ref = refDe(e, A.ger[e]);
  let nome = null;
  try {
    nome = sim.q.aresta ? sim.q.aresta(ref)?.nome ?? null : null;
  } catch {
    nome = null;
  }
  return { ref, nome };
}

/**
 * O que muda ao mover o prédio i para o lugar L (já conferido): a via a que se liga, o alcance do serviço (moradores
 * atendidos antes e depois e os que deixam de ser), a rede dos produtores e a distância ao armazém dos prédios da Holding
 * que pagam por ela (D47). Cada parte só aparece quando vale para o tipo.
 */
export function oQueMuda(sim, i, k, L) {
  const P = sim.tabelas.predios;
  const novo = acessoDoLugar(sim, L, { soFrente: k.tipo === 'zona' });
  const antesE = acessoDe(sim, i, AC).e;
  const muda = { via: { antes: viaDe(sim, antesE), depois: viaDe(sim, novo.e) } };
  if (k.tipo === 'servico' && SERVICOS[k.id]?.raio) muda.cobertura = efeitoNaCobertura(sim, i, k.id, L, novo);
  if (produtorDeRede(k.id, k.def)) muda.rede = { antes: viaComRede(sim, antesE), depois: viaComRede(sim, novo.e) };
  const da = k.tipo === 'holding' && !k.def?.armazem ? PREDIOS_HOLDING[k.id]?.distanciaArmazem : null;
  if (da) {
    const a0 = armazemPerto(sim, P.x[i], P.z[i]);
    const a1 = armazemPerto(sim, L.x, L.z);
    if (a0 && a1) {
      const penal = (d) => Math.min(da.max, Math.max(0, ((d - da.livre) / 100) * da.porCem));
      muda.armazem = { antes: Math.round(a0.d), depois: Math.round(a1.d), livre: da.livre, penalAntes: penal(a0.d), penalDepois: penal(a1.d) };
    }
  }
  return muda;
}

// ------------------------------------------------------------------------------------------------ prévia e comando

/** Os argumentos de lugar do `construir`, aplicados ao prédio i (a rotação de agora se vier sem). */
function lugarDe(sim, def, args, i, zona = false) {
  const P = sim.tabelas.predios;
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  const x = num(args.x) ? args.x : P.x[i];
  const z = num(args.z) ? args.z : P.z[i];
  // sem x e z (só girar) a planta fica onde está; com eles, o alinhar à via é o padrão, como no construir
  const alinhar = typeof args.alinhar === 'boolean' ? args.alinhar : num(args.x) && num(args.z);
  // prédio de zona alinhado sem giro dito: de frente para a via (o colocável arredonda o que tinha ao quarto de volta)
  const giro = num(args.giro) ? args.giro : zona && alinhar && num(args.x) && num(args.z) ? 0 : null;
  return lugarDoColocavel(sim, def, { x, z, rot: num(args.rot) ? args.rot : P.rot[i], giro, alinhar }, true);
}

/** Um argumento de lugar que veio e não é número finito (ausente vale: fica o de agora). */
const valorRuim = (v) => v !== undefined && !(typeof v === 'number' && Number.isFinite(v));

const refDoArg = (a) => (Number.isInteger(a?.ref) ? a.ref : Number.isInteger(a?.id) ? a.id : -1);

/** O lugar é o de agora (nem andou nem girou)? */
const ficouNoMesmo = (P, i, L) => hipot(L.x - P.x[i], L.z - P.z[i]) < MESMO.metros && diferencaDeAngulo(L.rot, P.rot[i]) < MESMO.rad;

/**
 * q.mover.previa({ ref, x, z, rot, giro?, alinhar?, aplainar? }): tudo o que a ferramenta mostra antes de confirmar. O custo
 * soma os 10% de mover, a demolição dos prédios de zona sob a planta nova (D54) e o aplainar. Sem x e z (ou com o lugar de
 * agora) devolve 'nada': o prédio já está ali.
 */
export function previaMover(sim, args = {}) {
  const P = sim.tabelas.predios;
  const A = sim.tabelas.arestas;
  const ref = refDoArg(args);
  const i = ref >= 0 ? P.idxVivo(ref) : -1;
  if (i < 0) return { ok: false, codigo: 'inexistente', ref, custo: 0, efeitos: [] };
  if (valorRuim(args.x) || valorRuim(args.z) || valorRuim(args.rot) || valorRuim(args.giro)) return { ok: false, codigo: 'valor', ref, custo: 0, efeitos: [] };
  const k = tipoDoPredio(sim, i);
  const imp = impedimentoDeMover(sim, i);
  const def = k.def;
  const zona = k.tipo === 'zona';
  const de = { x: P.x[i], z: P.z[i], rot: P.rot[i] };
  const custoBase = custoDeMoverPredio(sim, i, k);
  const base = {
    ref, tipo: k.id, de, valor: zona ? baseDoCustoDeZona(sim, i) : def?.custo ?? 0, custo: custoBase, custoMover: custoBase, manutencaoHora: 0,
    alcance: def?.raio ?? def?.alcance ?? 0, pegada: zona ? [P.w[i], P.d[i]] : plantaDe(def), efeitos: [], mobilizacao: MOVER.mobilizacao, tiques: tiquesDoMover(sim, i, k),
    ...(zona ? { zona: { emObra: nascendo(P, i), progresso: nascendo(P, i) ? progressoDaObra(sim, i) : 1, celulas: null } } : {}),
  };
  if (imp) return { ok: false, codigo: imp.codigo, dados: imp.dados, ...base, x: de.x, z: de.z, rot: de.rot };
  const L = lugarDe(sim, defDoLugar(sim, i, k), args, i, k.tipo === 'zona');
  if (L.codigo) return { ok: false, codigo: L.codigo, ...base, x: args.x, z: args.z, rot: args.rot ?? de.rot };
  // o prédio já está ali: nada a conferir nem a cobrar (e um prédio antigo, de antes das regras de agora, não fica vermelho no lugar dele)
  if (ficouNoMesmo(P, i, L)) return { ok: false, codigo: 'nada', ...base, x: de.x, z: de.z, rot: de.rot, alinhado: L.alinhado, giro: L.giro ?? null, custo: 0 };
  let c = conferirLugar(sim, k.id, defDoLugar(sim, i, k), L, opcoesDoLugar(k, i, args.aplainar === true));
  L.e = c.e ?? L.e;
  let celulas = null;
  if (zona && !c.codigo) {
    const zc = conferirZona(sim, i, L, c);
    if (zc.codigo) c = { ...c, codigo: zc.codigo, dados: zc.dados, demolir: [] };
    else celulas = { liberam: zc.liberam, ocupam: zc.celulas.length };
    c = { ...c, demolir: [] };
  }
  const dem = zona ? 0 : custoDosDemolidos(sim, c.demolir);
  const apl = c.aplainar?.custo ?? 0;
  const out = {
    ...base, custo: base.custoMover + dem + apl, custoDemolir: dem, custoAplainar: apl, aplainar: c.aplainar ?? null,
    tiques: base.tiques + (c.aplainar?.tiques ?? 0), x: L.x, z: L.z, rot: L.rot, alinhado: L.alinhado, rotVia: L.rotVia ?? null, giro: L.giro ?? null,
    via: L.e >= 0 && A.viva[L.e] ? refDe(L.e, A.ger[L.e]) : null, demolir: (c.demolir ?? []).map((b) => P.ref(b)), desfazer: !(c.demolir?.length),
    semRede: produtorDeRede(k.id, def) && !viaComRede(sim, L.e),
  };
  if (zona) out.zona = { ...base.zona, celulas };
  if (c.codigo) return { ok: false, codigo: c.codigo, dados: c.dados ?? null, ...out };
  const caixa = sim.holding.caixa();
  if (caixa < out.custo) return { ok: false, codigo: 'creditos', dados: { faltam: out.custo - caixa }, ...out, muda: oQueMuda(sim, i, k, L) };
  return { ok: true, ...out, muda: oQueMuda(sim, i, k, L) };
}

/**
 * comando mover { ref, x, z, rot, giro?, alinhar?, aplainar? }: o lugar é o do construir (alinhar à via, giro livre,
 * aplainar), o custo são os 10% (mais demolição e aplainar) e a obra curta abre no lugar novo com o prédio fora de serviço.
 * Devolve { ok, id: ref, dados: { ref, de, custo, tiques, desfazer, ate, demolidos, aplainar } }.
 */
export function mover(sim, args = {}) {
  const P = sim.tabelas.predios;
  const ref = refDoArg(args);
  const i = ref >= 0 ? P.idxVivo(ref) : -1;
  if (valorRuim(args.x) || valorRuim(args.z) || valorRuim(args.rot) || valorRuim(args.giro)) return { ok: false, codigo: 'valor' };
  if (i < 0) return { ok: false, codigo: ref >= 0 ? 'inexistente' : 'valor' };
  const imp = impedimentoDeMover(sim, i);
  if (imp) return { ok: false, codigo: imp.codigo, dados: imp.dados };
  const k = tipoDoPredio(sim, i);
  const def = k.def;
  const zona = k.tipo === 'zona';
  const L = lugarDe(sim, defDoLugar(sim, i, k), args, i, k.tipo === 'zona');
  if (L.codigo) return { ok: false, codigo: L.codigo };
  if (ficouNoMesmo(P, i, L)) return { ok: false, codigo: 'nada' };
  const c = conferirLugar(sim, k.id, defDoLugar(sim, i, k), L, opcoesDoLugar(k, i, args.aplainar === true));
  if (c.codigo) return { ok: false, codigo: c.codigo, dados: c.dados ?? null };
  if (zona) {
    const zc = conferirZona(sim, i, L, c);
    if (zc.codigo) return { ok: false, codigo: zc.codigo, dados: zc.dados };
    c.demolir = [];
  }
  const custo = custoDeMoverPredio(sim, i, k) + custoDosDemolidos(sim, c.demolir) + (c.aplainar?.custo ?? 0);
  if (sim.holding.caixa() < custo) return { ok: false, codigo: 'creditos', dados: { faltam: custo - sim.holding.caixa() } };
  if (custo > 0 && !sim.holding.pagar(custo, 'mover')) return { ok: false, codigo: 'creditos' };

  const de = { x: P.x[i], z: P.z[i], y: P.y[i], rot: P.rot[i], w: P.w[i], d: P.d[i], flags: P.flags[i], obraIni: P.obraIni[i], obraFim: P.obraFim[i], efic: P.efic[i] };
  const velha = [...sim.formas.porId.values()].find((f) => f.tipo === 'plataforma' && f.ref === ref);
  const demolidos = [];
  for (const b of c.demolir) {
    demolidos.push(P.ref(b));
    removerPredio(sim, b);
  }
  const T = sim.tique;
  const marcadaAntes = zona && !!zonasEmMover(sim)[String(ref)];
  const extra = c.aplainar?.tiques ?? 0;
  let ini = T + MOVER.mobilizacao;
  let fim = ini + tiquesDoMover(sim, i, k) + extra;
  // as células de zona do lugar antigo voltam a valer; o prédio sai delas antes de a planta mudar
  const celulasAntes = zona ? soltarCelulas(sim, i) : [];
  P.x[i] = L.x;
  P.z[i] = L.z;
  P.y[i] = c.cota;
  P.rot[i] = L.rot;
  P.w[i] = Math.round(L.w);
  P.d[i] = Math.round(L.d);
  if (zona) {
    // zona em obra: o progresso e o já pago ficam (ini e fim se deslocam juntos; só o aplainar alonga); pronta: reforma
    if (nascendo(P, i) || de.flags & PREDIO.OBRA) {
      ini = P.obraIni[i];
      fim = P.obraFim[i];
      if (!(P.flags[i] & PREDIO.SEM_MATERIAL) && extra > 0) {
        [ini, fim] = alongarObra(T, ini, fim, extra);
      }
    } else {
      P.flags[i] |= PREDIO.OBRA | PREDIO.OBRA_NIVEL;
      zonasEmMover(sim)[String(ref)] = 1;
    }
  } else {
    P.flags[i] = (P.flags[i] | PREDIO.OBRA) & ~(PREDIO.OBRA_NIVEL | PREDIO.SEM_MATERIAL);
    P.efic[i] = 0;
  }
  P.obraIni[i] = ini;
  P.obraFim[i] = fim;
  P.marcar(i);
  if (zona) ocuparCelulas(sim, i, celulasParaPredio(sim, { x: L.x, z: L.z, rot: L.rot, w: P.w[i], d: P.d[i] }, P.zona[i], i).ocupar);
  // a plataforma segue o prédio: a de antes sai (o chão volta ao natural ali) e a nova entra na cota do lugar novo
  sim.formas.removerRef('plataforma', ref);
  sim.formas.registrar({ tipo: 'plataforma', ref, contorno: L.contorno, cota: P.y[i] });
  const velhoPad = Math.max(de.w, de.d) / 2 + 8;
  const pad = Math.max(L.w, L.d) / 2 + 8;
  revalidarRetangulo(sim, de.x - velhoPad, de.z - velhoPad, de.x + velhoPad, de.z + velhoPad);
  revalidarRetangulo(sim, L.x - pad, L.z - pad, L.x + pad, L.z + pad);
  const t = trans(sim);
  sujarVia(t, i);
  t.servSujo = true;
  t.redesSujas = true;
  t.eficVersao = (t.eficVersao ?? 0) + 1;
  const desfazer = demolidos.length === 0;
  const prontoAntes = zona && !(de.flags & PREDIO.OBRA);
  if (desfazer) {
    J(sim).pend[String(ref)] = {
      de, forma: velha ? { contorno: Array.from(velha.contorno), cota: velha.cota } : null, custo, ate: T + MOVER.mobilizacao,
      ...(zona ? { zona: true, pronto: prontoAntes, marcada: marcadaAntes, celulas: celulasAntes } : {}),
    };
  } else delete J(sim).pend[String(ref)];
  if (typeof def.aoMover === 'function') def.aoMover(sim, i, ref);
  if (demolidos.length) sim.emitir('demolido', { tipo: 'predio', refs: demolidos });
  sim.emitir('construido', { tipo: k.id, refs: [ref], movido: true });
  return { ok: true, id: ref, dados: { ref, de: { x: de.x, z: de.z, rot: de.rot }, custo, tiques: fim - T, desfazer, ate: T + MOVER.mobilizacao, demolidos, aplainar: c.aplainar ?? null } };
}

/**
 * comando mover.desfazer { ref }: enquanto a obra não começou (a equipe ainda está chegando) o prédio volta ao lugar de
 * antes, com a plataforma, as bandeiras e o dinheiro todo. Depois que a obra começa, 'ocupado'. Um mover que derrubou
 * prédios de zona não guarda o que desfazer ('nada'). Se alguém ocupou o lugar de antes, a recusa é a do lugar ('colisao').
 */
export function desfazerMover(sim, args = {}) {
  const P = sim.tabelas.predios;
  const ref = refDoArg(args);
  const i = ref >= 0 ? P.idxVivo(ref) : -1;
  const j = J(sim);
  const rec = j.pend[String(ref)];
  if (!rec) return { ok: false, codigo: i < 0 && ref >= 0 ? 'inexistente' : 'nada' };
  if (i < 0) {
    delete j.pend[String(ref)];
    return { ok: false, codigo: 'inexistente' };
  }
  if (sim.tique >= rec.ate) {
    delete j.pend[String(ref)];
    return { ok: false, codigo: 'ocupado' };
  }
  const k = tipoDoPredio(sim, i);
  const de = rec.de;
  const L = { x: de.x, z: de.z, rot: de.rot, w: de.w, d: de.d, e: -1, alinhado: false, alinhar: false, contorno: cantosRetangulo(de.x, de.z, de.rot, de.w, de.d) };
  const zona = k.tipo === 'zona';
  const c = conferirLugar(sim, k.id, zona ? { ...k.def, planta: [de.w, de.d] } : k.def, L, opcoesDoLugar(k, i, true));
  if (c.codigo) return { ok: false, codigo: c.codigo, dados: c.dados ?? null };
  if (c.demolir.length) return { ok: false, codigo: 'colisao' };
  if (zona) soltarCelulas(sim, i);
  const nx = P.x[i];
  const nz = P.z[i];
  const npad = Math.max(P.w[i], P.d[i]) / 2 + 8;
  P.x[i] = de.x;
  P.z[i] = de.z;
  P.y[i] = de.y;
  P.rot[i] = de.rot;
  P.w[i] = de.w;
  P.d[i] = de.d;
  if (zona) {
    // zona: pronta, só sai da reforma; em obra, segue a de agora (o material pode ter sido comprado nesse meio tempo)
    if (rec.pronto) P.flags[i] &= ~(PREDIO.OBRA | PREDIO.OBRA_NIVEL | PREDIO.SEM_MATERIAL);
    else if (P.flags[i] & PREDIO.OBRA && !(P.flags[i] & PREDIO.SEM_MATERIAL) && !(de.flags & PREDIO.SEM_MATERIAL)) {
      P.obraIni[i] = de.obraIni;
      P.obraFim[i] = de.obraFim;
    }
    // a marca de reforma de mover volta ao que era (um segundo mover sobre a reforma do primeiro não a perde)
    if (!rec.marcada) delete zonasEmMover(sim)[String(ref)];
    // as mesmas células de antes; se alguma deixou de existir, o que a planta de antes cobre
    // (também quando só parte delas serve: completa com as livres da planta, para a pegada não voltar incompleta)
    const guardadas = rec.celulas ?? [];
    if (ocuparCelulas(sim, i, guardadas) < guardadas.length) ocuparCelulas(sim, i, celulasParaPredio(sim, { x: de.x, z: de.z, rot: de.rot, w: de.w, d: de.d }, P.zona[i], i).ocupar);
  } else {
    P.flags[i] = de.flags;
    P.obraIni[i] = de.obraIni;
    P.obraFim[i] = de.obraFim;
    P.efic[i] = de.efic;
  }
  P.marcar(i);
  sim.formas.removerRef('plataforma', ref);
  if (rec.forma) sim.formas.registrar({ tipo: 'plataforma', ref, contorno: rec.forma.contorno, cota: rec.forma.cota });
  const pad = Math.max(de.w, de.d) / 2 + 8;
  revalidarRetangulo(sim, nx - npad, nz - npad, nx + npad, nz + npad);
  revalidarRetangulo(sim, de.x - pad, de.z - pad, de.x + pad, de.z + pad);
  const t = trans(sim);
  sujarVia(t, i);
  t.servSujo = true;
  t.redesSujas = true;
  t.eficVersao = (t.eficVersao ?? 0) + 1;
  if (rec.custo > 0) sim.holding.receber(rec.custo, 'mover');
  delete j.pend[String(ref)];
  sim.emitir('construido', { tipo: k.id, refs: [ref], movido: true });
  return { ok: true, id: ref, dados: { ref, devolvido: rec.custo } };
}

/** Uma vez por rodada: o que passou do fim da janela do Desfazer sai da seção (ela só guarda o que ainda dá para desfazer). */
function limparJanelas(sim) {
  const j = J(sim);
  for (const ref of Object.keys(j.pend)) if (sim.tique >= j.pend[ref].ate) delete j.pend[ref];
  // a reforma de mover de um prédio de zona que foi demolido no meio não deixa marca para trás
  const P = sim.tabelas.predios;
  if (j.zona) for (const ref of Object.keys(j.zona)) if (!(P.idxVivo(Number(ref)) >= 0)) delete j.zona[ref];
}

export function registrarMover(sim) {
  if (!sim.json.mover) sim.registrarJson('mover', { pend: {}, zona: {} });
  sim.registrarComando('mover', mover);
  sim.registrarComando('mover.desfazer', desfazerMover);
  sim.registrarConsulta('mover.previa', previaMover);
  sim.registrarSistema(RODADA, 11, limparJanelas, 1, { nome: 'mover', ordem: ORDEM.cidade + 50 });
  registrarPartePredio((s, i, out) => {
    out.mover = infoDeMover(s, i);
  });
}
