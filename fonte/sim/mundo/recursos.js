// Recursos naturais em grades 256² de 32 m (Uint8, 0 a 255), a extração e os dados da camada Recursos (dona: S1a).
//
// rocha: granito das serras, dos planaltos e dos morros (mais nos pães de açúcar e na pedra nua); areia: bancos e
// margens do rio (a draga do Areal), praias e restinga; argila: várzea do Held (mais rica na margem oeste, fora da área
// inicial, D3); calcário: a faixa a noroeste, fora da área inicial; terra fértil: planície e várzea; água subterrânea:
// planícies e beira de rio e lagoa. A extração baixa o valor das células (a camada mostra o que resta).
import { AGUA } from '../../contratos/flags.js';
import { smoothstep, clamp } from '../../comum/util.js';
import { alturaEm, decliveEm } from '../../comum/altura.js';
import { pontoNoPoligono } from '../../comum/vetor.js';
import { terrenoBase, ruido, fbm, sementeDe, rioEm, costaEm, aguaEm } from './terreno.js';

/** Recursos na ordem da camada (índice + 1 é a categoria). */
export const RECURSOS = Object.freeze(['rocha', 'areia', 'argila', 'calcario', 'fertil', 'subterranea']);

const N = 256;
const PASSO = 32;
const CACHE = new Map();

/**
 * Recursos do mapa (guardados por id; o espelho recebe cópias). Célula [j * 256 + i] com centro em
 * x = ox + (i + 0.5) * 32.
 * @returns {Record<string, Uint8Array>}
 */
export function gerarRecursos(base, mapa) {
  const guardado = CACHE.get(mapa.id);
  if (guardado) return guardado;
  const g = () => new Uint8Array(N * N);
  const R = { rocha: g(), areia: g(), argila: g(), calcario: g(), fertil: g(), subterranea: g() };
  const [ox, oz] = base.origem;
  const s0 = sementeDe(mapa.semente) + 1777;
  const calc = mapa.calcario.flat();
  const lagoa = base.campos.lagoa;
  const { relevo, tipoDomo } = base.campos;
  const n = base.n;
  const u8 = (v) => Math.round(clamp(v, 0, 1) * 255);
  const terra = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) {
    const z = oz + (j + 0.5) * PASSO;
    for (let i = 0; i < N; i++) {
      const x = ox + (i + 0.5) * PASSO;
      const k = j * N + i;
      if (aguaEm(base, x, z) !== AGUA.TERRA) continue;
      terra[k] = 1;
      const h = alturaEm(base, x, z);
      const decl = decliveEm(base, x, z);
      const kf = Math.round((z - oz) / base.passo) * n + Math.round((x - ox) / base.passo);
      const r = relevo[kf];
      const pao = tipoDomo[kf] === 1;
      const v = fbm(x / 500, z / 500, s0, 2);
      // rocha: granito aflorante nos morros; mais onde a encosta é pedra
      R.rocha[k] = u8(smoothstep(15, 90, r) * (0.5 + 0.2 * v) + 0.45 * smoothstep(0.45, 0.95, decl) * smoothstep(8, 30, r) + (pao ? 0.3 : 0));
      // rio: areia nas margens e bancos, argila na várzea
      const rio = rioEm(base, x, z);
      const sd = costaEm(base, x, z);
      let areia = 0;
      let argila = 0;
      if (rio.a < rio.hw + rio.varzea + 40) {
        const margem = rio.a - rio.hw;
        if (rio.nivel < 20) {
          // bancos de areia e terraços arenosos da margem
          areia = (1 - smoothstep(30, 120, margem)) * (0.78 + 0.22 * ruido(x / 300, z / 300, s0 + 5));
          const oeste = rio.lado > 0 ? 1 : 0.82;
          argila = smoothstep(15, 60, margem) * (1 - smoothstep(rio.varzea - 40, rio.varzea + 30, margem)) * oeste * (0.8 + 0.2 * v);
        }
      }
      // praias e restinga
      if (sd > 0 && sd < 200) areia = Math.max(areia, (1 - smoothstep(60, 200, sd)) * 0.55);
      // margem da lagoa: argila fina
      const lsd = amostraLagoa(base, lagoa, x, z);
      if (lsd < 0 && lsd > -90) argila = Math.max(argila, 0.35 * (1 + lsd / 90));
      R.areia[k] = u8(areia);
      R.argila[k] = u8(argila);
      // calcário: só na faixa do mapa
      if (pontoNoPoligono(x, z, calc)) R.calcario[k] = u8(0.55 + 0.45 * fbm(x / 260, z / 260, s0 + 9, 2));
      // terra fértil: baixada plana, fora da areia
      R.fertil[k] = u8((1 - smoothstep(22, 45, h)) * (1 - smoothstep(0.06, 0.16, decl)) * (1 - areia) * (0.7 + 0.3 * v));
      // água subterrânea: planície, mais perto do rio e da lagoa
      const perto = Math.max(1 - smoothstep(100, 900, rio.a - rio.hw), 1 - smoothstep(0, 500, -lsd));
      R.subterranea[k] = u8((1 - smoothstep(25, 60, h)) * (0.35 + 0.5 * perto + 0.15 * v));
    }
  }
  peDaEncosta(R.rocha, terra);
  CACHE.set(mapa.id, R);
  return R;
}

/**
 * Tálus e matacões: o granito também aparece até duas células (64 m) além do pé da encosta, mais fraco (é por ali
 * que a pedreira abre a frente). Só em terra.
 */
function peDaEncosta(g, terra) {
  const src = g.slice();
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = j * N + i;
      if (!terra[k]) continue;
      let m = src[k];
      for (let dj = -2; dj <= 2; dj++) {
        const jj = j + dj;
        if (jj < 0 || jj >= N) continue;
        for (let di = -2; di <= 2; di++) {
          const ii = i + di;
          if (ii < 0 || ii >= N || (di === 0 && dj === 0)) continue;
          const f = Math.max(di < 0 ? -di : di, dj < 0 ? -dj : dj) === 1 ? 0.8 : 0.55;
          const v = src[jj * N + ii] * f;
          if (v > m) m = v;
        }
      }
      g[k] = Math.round(m);
    }
  }
}

function amostraLagoa(base, lagoa, x, z) {
  const { G } = base.campos;
  const i = Math.round((x - G.ox) / G.pc);
  const j = Math.round((z - G.oz) / G.pc);
  if (i < 0 || j < 0 || i >= G.nc || j >= G.nc) return -1e6;
  return lagoa.sd[j * G.nc + i];
}

/** Valor (0 a 255) de um recurso na célula de (x, z). */
export function recursoEm(E, tipo, x, z) {
  const i = Math.floor((x - E.origem[0]) / E.passo);
  const j = Math.floor((z - E.origem[1]) / E.passo);
  if (i < 0 || j < 0 || i >= E.n || j >= E.n) return 0;
  return E[tipo][j * E.n + i];
}

/** Soma e média de um recurso dentro de um polígono (pares x, z), pelas células cujo centro cai nele. */
export function recursoNoPoligono(E, tipo, poligono) {
  let soma = 0;
  let n = 0;
  forCelulas(E, poligono, (k) => {
    soma += E[tipo][k];
    n++;
  });
  return { soma, n, media: n ? soma / n : 0 };
}

function forCelulas(E, poligono, fn) {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (let k = 0; k + 1 < poligono.length; k += 2) {
    x0 = Math.min(x0, poligono[k]);
    x1 = Math.max(x1, poligono[k]);
    z0 = Math.min(z0, poligono[k + 1]);
    z1 = Math.max(z1, poligono[k + 1]);
  }
  const [ox, oz] = E.origem;
  const i0 = Math.max(0, Math.floor((x0 - ox) / E.passo));
  const i1 = Math.min(E.n - 1, Math.floor((x1 - ox) / E.passo));
  const j0 = Math.max(0, Math.floor((z0 - oz) / E.passo));
  const j1 = Math.min(E.n - 1, Math.floor((z1 - oz) / E.passo));
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const x = ox + (i + 0.5) * E.passo;
      const z = oz + (j + 0.5) * E.passo;
      if (pontoNoPoligono(x, z, poligono)) fn(j * E.n + i);
    }
  }
}

/**
 * Extrai n unidades de um recurso das células dentro do polígono (a planta do prédio que extrai): esgota primeiro a
 * célula com mais recurso, depois a seguinte (empate: a de menor índice; determinístico). Devolve quanto tirou; marca
 * a versão da camada.
 */
export function extrair(sim, tipo, poligono, n) {
  const E = sim.espelho.recursos;
  if (!E || !E[tipo] || !(n > 0)) return 0;
  const celulas = [];
  forCelulas(E, poligono, (k) => celulas.push(k));
  let tirou = 0;
  const g = E[tipo];
  while (tirou < n) {
    let melhor = -1;
    for (const k of celulas) if (g[k] > 0 && (melhor < 0 || g[k] > g[melhor])) melhor = k;
    if (melhor < 0) break;
    const q = Math.min(g[melhor], n - tirou);
    g[melhor] -= q;
    tirou += q;
  }
  if (tirou) sim.json.recursos.versao++;
  return tirou;
}

/** Dados da camada Recursos (contratos/camadas.js): o recurso que domina em cada célula e quanto resta dele. */
export function camadaRecursos(sim) {
  const E = sim.espelho.recursos;
  const n = E.n;
  const dados = new Float32Array(n * n);
  const categoria = new Uint8Array(n * n);
  const conta = new Array(RECURSOS.length).fill(0);
  for (let k = 0; k < n * n; k++) {
    let melhor = 0;
    let v = 0;
    // os de indústria primeiro: calcário, argila, areia, rocha; depois a água do poço e a terra fértil
    for (const [c, tipo] of [[4, 'calcario'], [3, 'argila'], [2, 'areia'], [1, 'rocha'], [6, 'subterranea'], [5, 'fertil']]) {
      const x = E[tipo][k];
      if (x >= 70 && x > v * 1.15) {
        v = x;
        melhor = c;
      }
    }
    if (melhor) {
      categoria[k] = melhor;
      dados[k] = v / 255;
      conta[melhor - 1]++;
    }
  }
  const legenda = RECURSOS.map((id, i) => ({ v: i + 1, chave: `recurso.${id}` }));
  return {
    id: 'recursos',
    fonte: 'grade',
    dados,
    categoria, // acréscimo: o recurso que domina (1 a 6, 0 nenhum), para a cor; dados é quanto resta dele (0 a 1)
    grade: { n, passo: E.passo, origem: [...E.origem] },
    tipo: 'seq',
    escala: { min: 0, max: 1, unidade: '' },
    categorias: legenda,
    legenda,
    resumo: { chave: 'camada.recursos.resumo', params: { celulas: conta.reduce((a, b) => a + b, 0) } },
    versao: sim.json.recursos.versao,
  };
}

/**
 * Publica espelho.recursos { n: 256, passo: 32, origem, rocha, areia, argila, calcario, fertil, subterranea } (seis
 * grades salvas: a extração fica) e a camada Recursos.
 */
export function registrar(sim) {
  const tb = terrenoBase(sim);
  if (!tb) return;
  const R = gerarRecursos(tb.base, tb.mapa);
  const E = { n: N, passo: PASSO, origem: [...tb.base.origem] };
  for (const tipo of RECURSOS) {
    E[tipo] = R[tipo].slice();
    sim.registrarGrade(`recursos.${tipo}`, { n: N, passo: PASSO, dados: E[tipo] });
  }
  sim.espelho.recursos = E;
  sim.registrarJson('recursos', { versao: 1 });
  sim.camadas.registrar('recursos', camadaRecursos);
}
