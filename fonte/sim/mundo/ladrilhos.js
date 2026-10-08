// Ladrilhos de 512 m: posse, preço (D3), licenças e o comando ladrilho.comprar (dona: S1a).
//
// 16 x 16 ladrilhos; a partida começa com os 4 x 4 do meio (6 a 9 nos dois eixos) da Holding. Comprar pede um vizinho
// da Holding (lado com lado), uma licença (vêm dos marcos e de torre.e1: concederLicencas) e o preço
// 40.000 x (1 + 0,15 x comprados pelo jogador) x (1 - 0,2 x Influência / 100), com os 16 iniciais fora da conta
// (o primeiro custa 40 mil). No Modo livre (D56) não pede licença.
//
// Espelho: ladrilhos { n: 16, estado: Uint8Array(256) (0 trancado, 1 comprável, 2 da Holding), preco: Float64Array(256) }.
import { LADRILHO } from '../../contratos/flags.js';
import { terrenoBase } from './terreno.js';
import { MAPA_HELDOPOLIS } from '../../data/mapa-heldopolis.js';
import { AREAS_COMPRAVEIS } from '../../data/areas-compraveis.js';
import { pontoNoPoligono, segmentosCruzam } from '../../comum/vetor.js';

export const PRECO_BASE = 40000;
export const SUBIDA_POR_COMPRA = 0.15;
export const DESCONTO_INFLUENCIA = 0.2;

/** Ladrilho (i, j) de um ponto; fora do mapa, [-1, -1]. */
export function ladrilhoDe(x, z, mapa = MAPA_HELDOPOLIS) {
  const i = Math.floor((x - mapa.origem[0]) / mapa.ladrilho);
  const j = Math.floor((z - mapa.origem[1]) / mapa.ladrilho);
  if (i < 0 || j < 0 || i >= mapa.ladrilhos || j >= mapa.ladrilhos) return [-1, -1];
  return [i, j];
}

/** true se o ponto cai num ladrilho da Holding. */
export function daHolding(sim, x, z) {
  const L = sim.espelho.ladrilhos;
  const [i, j] = ladrilhoDe(x, z, terrenoBase(sim)?.mapa ?? MAPA_HELDOPOLIS);
  return i >= 0 && L.estado[j * L.n + i] === LADRILHO.HOLDING;
}

/** Influência da Holding (0 a 100) pela consulta de S3a, quando existir. */
function influencia(sim) {
  try {
    const h = sim.q.holding ? sim.q.holding() : null;
    const v = h?.influencia;
    return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
  } catch {
    return 0;
  }
}

/** Preço do próximo ladrilho (D3). */
export function preco(sim) {
  const comprados = sim.json.ladrilhos.comprados;
  const v = PRECO_BASE * (1 + SUBIDA_POR_COMPRA * comprados) * (1 - (DESCONTO_INFLUENCIA * influencia(sim)) / 100);
  return Math.round(v);
}

const VIZ = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Refaz 'comprável' (vizinho da Holding) e o preço de cada ladrilho que não é da Holding. */
export function atualizar(sim) {
  const L = sim.espelho.ladrilhos;
  const n = L.n;
  const p = preco(sim);
  let mudou = false;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      if (L.estado[k] === LADRILHO.HOLDING) {
        if (L.preco[k] !== 0) {
          L.preco[k] = 0;
          mudou = true;
        }
        continue;
      }
      const viz = VIZ.some(([di, dj]) => {
        const a = i + di;
        const b = j + dj;
        return a >= 0 && b >= 0 && a < n && b < n && L.estado[b * n + a] === LADRILHO.HOLDING;
      });
      const e = viz ? LADRILHO.COMPRAVEL : LADRILHO.TRANCADO;
      if (L.estado[k] !== e || L.preco[k] !== p) mudou = true;
      L.estado[k] = e;
      L.preco[k] = p;
    }
  }
  if (mudou) sim.mudancas.marcar('ladrilhos');
  return mudou;
}

/** Soma licenças de ladrilho (marcos de S3a, torre.e1 de X1b). */
export function concederLicencas(sim, n = 1) {
  if (!(n > 0)) return;
  sim.json.ladrilhos.licencas += Math.floor(n);
  sim.mudancas.marcar('ladrilhos');
}

/** Código de recusa para comprar (i, j), ou null se pode. */
export function podeComprar(sim, i, j) {
  const L = sim.espelho.ladrilhos;
  if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0 || i >= L.n || j >= L.n) return 'valor';
  const e = L.estado[j * L.n + i];
  if (e === LADRILHO.HOLDING) return 'comprado';
  if (e !== LADRILHO.COMPRAVEL) return 'vizinho';
  const livre = sim.json.partida?.modo === 'livre';
  if (!livre && sim.json.ladrilhos.licencas < 1) return 'licenca';
  return null;
}

function comprar(sim, { i, j } = {}) {
  const codigo = podeComprar(sim, i, j);
  if (codigo) return { ok: false, codigo };
  const livre = sim.json.partida?.modo === 'livre';
  const valor = preco(sim);
  if (!livre && !sim.holding.pagar(valor, 'ladrilho')) return { ok: false, codigo: 'creditos' };
  const L = sim.espelho.ladrilhos;
  L.estado[j * L.n + i] = LADRILHO.HOLDING;
  const J = sim.json.ladrilhos;
  if (!livre) J.licencas--;
  J.comprados++;
  J.historico.push({ i, j, tique: sim.tique, valor: livre ? 0 : valor });
  atualizar(sim);
  sim.mudancas.marcar('ladrilhos');
  sim.emitir('ladrilho', { i, j });
  return { ok: true, dados: { valor: livre ? 0 : valor } };
}

// ------------------------------------------------------------------------------------------------ compra por área (D107)

/** true se o contorno (pares x, z) toca o quadrado [x0, z0, x1, z1]: vértice dentro, canto dentro do contorno ou lados que se cruzam. */
export function contornoTocaQuadrado(contorno, x0, z0, x1, z1) {
  const n = contorno.length / 2;
  for (let k = 0; k < n; k++) {
    const x = contorno[2 * k];
    const z = contorno[2 * k + 1];
    if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return true;
  }
  const cantos = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  if (cantos.some(([x, z]) => pontoNoPoligono(x, z, contorno))) return true;
  for (let k = 0, m = n - 1; k < n; m = k++) {
    const ax = contorno[2 * m];
    const az = contorno[2 * m + 1];
    const bx = contorno[2 * k];
    const bz = contorno[2 * k + 1];
    for (let c = 0; c < 4; c++) {
      const [cx, cz] = cantos[c];
      const [dx, dz] = cantos[(c + 1) % 4];
      if (segmentosCruzam(ax, az, bx, bz, cx, cz, dx, dz)) return true;
    }
  }
  return false;
}

const TOCADOS = new WeakMap(); // contorno -> { mapa, lista } (a geometria não muda com a posse)

/** Ladrilhos [{ i, j }] que o contorno toca (ordem j, i). */
export function ladrilhosDoContorno(contorno, mapa = MAPA_HELDOPOLIS) {
  const guardado = TOCADOS.get(contorno);
  if (guardado?.mapa === mapa) return guardado.lista;
  const n = mapa.ladrilhos;
  const L = mapa.ladrilho;
  const [ox, oz] = mapa.origem;
  const out = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (contornoTocaQuadrado(contorno, ox + i * L, oz + j * L, ox + (i + 1) * L, oz + (j + 1) * L)) out.push({ i, j });
    }
  }
  TOCADOS.set(contorno, { mapa, lista: out });
  return out;
}

/**
 * Situação da compra de uma área: { ok, codigo, ladrilhos: [{ i, j, valor }] (os que faltam, em ordem de adjacência a
 * partir da Holding), preco (soma sequencial), criterios: [{ id, ok, chave, dados }], pode }. Sem efeito.
 * Ordem: a cada passo entra o ladrilho que falta de menor (j, i) entre os que tocam a Holding (a posse já comprada
 * conta); o preço de cada um é o D3 com `comprados` subindo a cada entrada, o desconto da Influência fixo.
 */
export function situacaoArea(sim, id) {
  const area = AREAS_COMPRAVEIS.includes(id) ? sim.espelho.areas?.find((a) => a.id === id) : null;
  if (!area) return { ok: false, codigo: 'inexistente', id, ladrilhos: [], preco: 0, criterios: [], pode: false };
  const L = sim.espelho.ladrilhos;
  const n = L.n;
  const mapa = terrenoBase(sim)?.mapa ?? MAPA_HELDOPOLIS;
  const faltam = ladrilhosDoContorno(area.contorno, mapa).filter(({ i, j }) => L.estado[j * n + i] !== LADRILHO.HOLDING);
  const livre = sim.json.partida?.modo === 'livre';
  const J = sim.json.ladrilhos;
  const desc = (DESCONTO_INFLUENCIA * influencia(sim)) / 100;
  // ordem de adjacência (simula a posse sem tocar no espelho)
  const posse = new Uint8Array(L.estado.length);
  for (let k = 0; k < posse.length; k++) posse[k] = L.estado[k] === LADRILHO.HOLDING ? 1 : 0;
  const resto = faltam.slice();
  const ordem = [];
  const toca = (i, j) => VIZ.some(([di, dj]) => {
    const a = i + di;
    const b = j + dj;
    return a >= 0 && b >= 0 && a < n && b < n && posse[b * n + a] === 1;
  });
  for (;;) {
    const q = resto.findIndex((c) => toca(c.i, c.j));
    if (q < 0) break;
    const [c] = resto.splice(q, 1);
    posse[c.j * n + c.i] = 1;
    ordem.push({ i: c.i, j: c.j, valor: Math.round(PRECO_BASE * (1 + SUBIDA_POR_COMPRA * (J.comprados + ordem.length)) * (1 - desc)) });
  }
  // os que ainda não se alcançam entram no preço como se fossem comprados depois (o total mostrado é o da área toda)
  const alcanca = faltam.length > 0 && resto.length === 0;
  const todos = [...ordem];
  for (const c of resto) todos.push({ i: c.i, j: c.j, valor: Math.round(PRECO_BASE * (1 + SUBIDA_POR_COMPRA * (J.comprados + todos.length)) * (1 - desc)) });
  const total = livre ? 0 : todos.reduce((a, c) => a + c.valor, 0);
  const temLicenca = livre || J.licencas >= 1;
  const caixa = sim.holding.caixa();
  const temCreditos = livre || caixa >= total;
  const criterios = [
    { id: 'vizinho', ok: alcanca, chave: 'area.criterio.vizinho', dados: null },
    { id: 'licenca', ok: temLicenca, chave: livre ? 'area.criterio.licencaLivre' : 'area.criterio.licenca', dados: { tem: J.licencas } },
    { id: 'creditos', ok: temCreditos, chave: 'area.criterio.creditos', dados: { preco: total, caixa: Math.floor(caixa) } },
  ];
  const codigo = faltam.length === 0 ? 'comprado' : (criterios.find((c) => !c.ok)?.id ?? null);
  return { ok: true, codigo, id, nome: area.nome, ladrilhos: todos, preco: total, criterios, pode: codigo === null };
}

/** Comando area.comprar { id }: todos os ladrilhos que faltam, uma licença, um pagamento; tudo ou nada. */
function comprarArea(sim, { id } = {}) {
  const s = situacaoArea(sim, id);
  if (!s.ok || !s.pode) return { ok: false, codigo: s.codigo };
  const livre = sim.json.partida?.modo === 'livre';
  if (!livre && !sim.holding.pagar(s.preco, 'ladrilho')) return { ok: false, codigo: 'creditos' };
  const L = sim.espelho.ladrilhos;
  const J = sim.json.ladrilhos;
  if (!livre) J.licencas--;
  for (const c of s.ladrilhos) {
    L.estado[c.j * L.n + c.i] = LADRILHO.HOLDING;
    J.comprados++;
    J.historico.push({ i: c.i, j: c.j, tique: sim.tique, valor: livre ? 0 : c.valor });
  }
  atualizar(sim);
  sim.mudancas.marcar('ladrilhos');
  for (const c of s.ladrilhos) sim.emitir('ladrilho', { i: c.i, j: c.j });
  return { ok: true, dados: { valor: s.preco, n: s.ladrilhos.length } };
}

/** Consulta q.area.compra({ id }). */
function consultaAreaCompra(sim, args) {
  const s = situacaoArea(sim, args?.id);
  return { ...s, ladrilhos: s.ladrilhos.map(({ i, j }) => ({ i, j })) };
}

/** Consulta q.ladrilhos(): estado, preço e licenças (cópias). */
function consulta(sim) {
  const L = sim.espelho.ladrilhos;
  return {
    estado: L.estado.slice(),
    preco: L.preco.slice(),
    licencas: sim.json.ladrilhos.licencas,
    comprados: sim.json.ladrilhos.comprados,
    proximo: preco(sim),
  };
}

export function registrar(sim) {
  const mapa = terrenoBase(sim)?.mapa ?? MAPA_HELDOPOLIS;
  const n = mapa.ladrilhos;
  const estado = new Uint8Array(n * n);
  const [[i0, j0], [i1, j1]] = mapa.inicio;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) estado[j * n + i] = LADRILHO.HOLDING;
  sim.espelho.ladrilhos = { n, estado, preco: new Float64Array(n * n) };
  sim.registrarGrade('ladrilhos', { n, passo: mapa.ladrilho, dados: estado });
  sim.registrarJson('ladrilhos', { comprados: 0, licencas: 0, historico: [] });
  atualizar(sim);
  sim.registrarComando('ladrilho.comprar', comprar);
  sim.registrarComando('area.comprar', comprarArea);
  sim.registrarConsulta('ladrilhos', consulta);
  sim.registrarConsulta('area.compra', consultaAreaCompra);
  // o preço anda com a Influência (S3a): confere a cada rodada
  sim.registrarSistema(20, 3, (s) => atualizar(s), 1, { nome: 'ladrilhos', ordem: 100 });
  sim.aoCarregar(() => atualizar(sim));
}
