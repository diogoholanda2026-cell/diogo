// Ferramenta de via (desenho da UI 9.2, D18, D32): máquina de estados PURA (sem DOM, sem render, sem relógio; o tempo
// chega no evento), a geometria das alças e o planejador substituto. Testada em Node com sequências de ponteiros
// (ferramentas/testes/ui-ferramentas.teste.mjs); a cola com a entrada, a simulação e o render fica em sessao.js.
//
//   ocioso --toque--> mirandoA --solta--> aFixo --toque ou arrasto--> mirandoB --solta--> previa
//   previa --arrasta alça (a, b, meio, fundo)--> arrastando --solta--> previa
//   previa --Construir--> (Contínua? B vira A e volta a aFixo : ocioso);  Cancelar volta a ocioso; em ocioso, sai
//
// Atalho: tocar em A e arrastar logo (antes de 220 ms) leva direto a B num gesto só; quem segura o dedo parado mira A
// com a lupa e só então solta. A alça do meio curva a via (Bézier); na Reta, um toque nela volta a reta. Grade: A e B
// dão a primeira rua e a alça do fundo abre as quadras. Melhorar: tocar ou arrastar sobre as vias escolhe as arestas.
//
// O encaixe de verdade é um só, o planejar() da simulação (D18: q.via.previa). planejarLocal() é o SUBSTITUTO que a
// interface usa enquanto a S1b não publica a consulta (e na vitrine): mesmo formato de resposta, as mesmas regras
// principais (nó, aresta, ângulo, prolongamento, quadra, passo de 15 graus, comprimento múltiplo de 8 m).
import { VIAS, VIAS_ORDEM, GRADE_EIXOS } from '../../data/vias.js';
import { reta, deQuadratica, tabelaArco, ponto as pontoBz, direcao, maisPerto, caixa as caixaBz } from '../../comum/bezier.js';
import { alturaEm } from '../../comum/altura.js';
import { ARESTA, AGUA, LADRILHO } from '../../contratos/flags.js';
import { refDe } from '../../contratos/espelho.js';
import { COTAS_VIADUTO } from '../../comum/viaduto.js';

/** Números da ferramenta (px de tela, ms, metros). */
export const VIA = Object.freeze({
  alcaPx: 30, // raio de toque das alças (alvo de 44 a 60 px)
  atalhoMs: 220, // arrastar antes disso é o atalho A e B num gesto
  atalhoPx: 14,
  toquePx: 10, // abaixo disso, soltar é um toque
  minComp: 16, // comprimento mínimo (m)
  tolPx: 20, // encaixe em nó e aresta: 20 px de tela
  tolMin: 6, // nunca abaixo de 6 m
  folgaAng: 3, // graus de folga do encaixe de ângulo
  passoAng: 15,
  passoComp: 8,
  fundoZona: 48, // 6 células de 8 m
  quadrasPadrao: 2, // fundo da grade ao abrir
});

/** Modos do segmentado da barra (Contínua e Encaixe são interruptores). */
export const MODOS_VIA = Object.freeze(['reta', 'curva', 'grade', 'melhorar']);

/** Tipos que o jogador traça (a rodovia e as ruas de terra são do mapa). */
export const TIPOS_VIA = Object.freeze(VIAS_ORDEM.filter((k) => VIAS[k].constroi));

const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
const dist = (a, b) => Math.sqrt(d2(a, b));
const medio = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const copia = (p) => (p ? [p[0], p[1]] : null);

// ------------------------------------------------------------------------------------------------ geometria

/** Controle da quadrática cujo ponto do meio (t = 0,5) é a alça h: C = 2h - (a + b) / 2. */
export const controleDaAlca = (a, b, h) => [2 * h[0] - (a[0] + b[0]) / 2, 2 * h[1] - (a[1] + b[1]) / 2];

/** Ponto do meio (t = 0,5) da quadrática a, c, b: onde a alça do meio fica desenhada. */
export const alcaDoControle = (a, c, b) => [(a[0] + 2 * c[0] + b[0]) / 4, (a[1] + 2 * c[1] + b[1]) / 4];

/**
 * Controle da curva que sai de a na direção tan (unitária) e chega em b (Contínua): no raio que faz um arco quase
 * circular. Com b atrás ou de lado demais (acima de 80 graus), a curva fica mais aberta e o encaixe da simulação decide.
 */
export function controleTangente(a, tan, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const L = Math.hypot(dx, dz) || 1;
  const cosT = (dx * tan[0] + dz * tan[1]) / L;
  const s = L / (2 * Math.max(0.18, cosT));
  const k = Math.min(s, L * 1.5);
  return [a[0] + tan[0] * k, a[1] + tan[1] * k];
}

/** Direção unitária de a para b (ou [0, -1]). */
export function direcaoDe(a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const L = Math.hypot(dx, dz);
  return L > 1e-9 ? [dx / L, dz / L] : [0, -1];
}

/** Distância entre eixos da grade do tipo (seção 2.3): 112 com rua, 120 com avenida, 128 com avenida grande. */
export const espacamentoGrade = (tipo) => GRADE_EIXOS[tipo] ?? GRADE_EIXOS.rua;

/**
 * Canto oposto a A do retângulo da grade: B mais o fundo, perpendicular a AB, em múltiplos do espaçamento (mínimo 1).
 * `fundo` é um ponto qualquer (a alça): vale a projeção dele na perpendicular, com sinal (o lado).
 */
export function cantoDaGrade(a, b, fundo, tipo) {
  const u = direcaoDe(a, b);
  const v = [-u[1], u[0]];
  const passo = espacamentoGrade(tipo);
  let prof = fundo ? (fundo[0] - b[0]) * v[0] + (fundo[1] - b[1]) * v[1] : passo * VIA.quadrasPadrao;
  const n = Math.max(1, Math.round(Math.abs(prof) / passo));
  prof = Math.sign(prof || 1) * n * passo;
  return [b[0] + v[0] * prof, b[1] + v[1] * prof];
}

/**
 * Ruas da grade (retângulo A, B, C): paralelas a AB a cada espaçamento até o fundo e perpendiculares a cada espaçamento
 * ao longo de AB (mais a da ponta B). Devolve [[x0, z0, x1, z1]].
 */
export function ruasDaGrade(a, b, c, tipo) {
  const passo = espacamentoGrade(tipo);
  const u = direcaoDe(a, b);
  const W = dist(a, b);
  const vx = c[0] - b[0];
  const vz = c[1] - b[1];
  const D = Math.hypot(vx, vz);
  const v = D > 1e-9 ? [vx / D, vz / D] : [-u[1], u[0]];
  const linhas = [];
  const nd = Math.max(1, Math.round(D / passo));
  for (let k = 0; k <= nd; k++) {
    const o = Math.min(D, k * passo);
    linhas.push([a[0] + v[0] * o, a[1] + v[1] * o, b[0] + v[0] * o, b[1] + v[1] * o]);
  }
  const pos = [];
  for (let s = 0; s < W - passo / 3; s += passo) pos.push(s);
  pos.push(W);
  for (const s of pos) {
    const x = a[0] + u[0] * s;
    const z = a[1] + u[1] * s;
    linhas.push([x, z, x + v[0] * D, z + v[1] * D]);
  }
  return linhas;
}

// ------------------------------------------------------------------------------------------------ estado

/**
 * Estado novo da ferramenta.
 * @param {{ tipo?: string, modo?: string, continua?: boolean, encaixe?: boolean }} op
 */
export function criarVia({ tipo = 'rua', modo = 'reta', continua = false, encaixe = true, cota = 0, ponte = true } = {}) {
  return {
    fase: 'ocioso',
    tipo: TIPOS_VIA.includes(tipo) ? tipo : 'rua',
    modo: MODOS_VIA.includes(modo) ? modo : 'reta',
    continua: !!continua,
    encaixe: encaixe !== false,
    cota: COTAS_VIADUTO.includes(cota) ? cota : 0, // altura livre do viaduto (D106): 0, 6, 12 ou 18 m
    ponte: ponte !== false, // ponte automática sobre a água (D53)
    a: null,
    b: null,
    meio: null, // alça do meio (ponto da curva em t = 0,5); null: reta
    fundo: null, // alça do fundo da grade
    tangente: null, // Contínua: direção em que a via anterior chegou em A
    alca: null, // alça em arrasto
    pega: null, // deslocamento entre o ponto da mira e a alça ao pegar (sem salto)
    dedo: false,
    t0: 0,
    tela0: null,
    moveu: false,
    mira: null, // { ponto, tela } do último evento (lupa, cursor)
    selecao: [], // Melhorar: refs das arestas escolhidas
    efeitos: [],
  };
}

/** Ponto do meio que a alça mostra quando o jogador ainda não curvou a via. */
export function meioAtual(e) {
  if (!e.a || !e.b) return null;
  if (e.meio) return e.meio;
  if (e.continua && e.tangente) return alcaDoControle(e.a, controleTangente(e.a, e.tangente, e.b), e.b);
  return medio(e.a, e.b);
}

/**
 * Alças visíveis agora: [{ id, p }]. Na prévia, A, B, meio (reta, curva) ou fundo (grade); em aFixo, só A.
 */
export function alcas(e) {
  const l = [];
  if (e.modo === 'melhorar') return l;
  if (e.a && (e.fase === 'aFixo' || e.fase === 'mirandoB' || e.fase === 'previa' || e.fase === 'arrastando')) l.push({ id: 'a', p: e.a });
  if (e.b && (e.fase === 'previa' || e.fase === 'arrastando')) {
    l.push({ id: 'b', p: e.b });
    if (e.modo === 'grade') l.push({ id: 'fundo', p: medio(e.b, cantoDaGrade(e.a, e.b, e.fundo, e.tipo)) });
    else l.push({ id: 'meio', p: meioAtual(e) });
  }
  return l;
}

/** Alça sob o dedo ou sob a mira (a mais perto até alcaPx), ou null. amb.projetar([x, z]) → [xTela, yTela] | null. */
export function alcaSob(e, ev, amb) {
  if (!amb?.projetar) return null;
  let melhor = null;
  let md = VIA.alcaPx;
  for (const h of alcas(e)) {
    const s = amb.projetar(h.p);
    if (!s) continue;
    for (const q of [ev.dedo, ev.tela]) {
      if (!q) continue;
      const d = Math.hypot(s[0] - q[0], s[1] - q[1]);
      if (d <= md) {
        md = d;
        melhor = h;
      }
    }
  }
  return melhor;
}

const telaMoveu = (e, ev, px) => !!(e.tela0 && ev.tela && Math.hypot(ev.tela[0] - e.tela0[0], ev.tela[1] - e.tela0[1]) > px);

/** Volta ao ocioso mantendo as opções. */
function limpo(e, efeitos = []) {
  return { ...criarVia({ tipo: e.tipo, modo: e.modo, continua: e.continua, encaixe: e.encaixe }), mira: e.mira, efeitos };
}

/**
 * Um passo da máquina. Eventos:
 *   { tipo: 'inicio' | 'move' | 'fim', ponto: [x, z], tela: [x, y], dedo: [x, y], t }   (ponto: o da mira)
 *   { tipo: 'hover', ponto, tela }                     mouse sem botão
 *   { tipo: 'cancelar' }                               Cancelar ou Esc
 *   { tipo: 'construido', fim: [x, z], tangente }      a via foi construída (a cola manda depois do comando)
 *   { tipo: 'ajustar', a?, b? }                        pontos encaixados pela simulação (depois de soltar)
 *   { tipo: 'opcao', tipoVia?, modo?, continua?, encaixe?, cota?, ponte? }
 *   { tipo: 'aresta', ref, somar }                     Melhorar: aresta escolhida pela cola
 * Efeitos (e.efeitos): 'previa' (pedir a prévia), 'limpar', 'sair', 'escolher' (Melhorar: { ponto, somar }).
 * @param {object} e estado
 * @param {object} ev evento
 * @param {{ projetar?: (p: number[]) => number[] | null }} amb
 */
export function passoVia(e, ev, amb = {}) {
  const ef = [];
  const mira = ev.ponto ? { ponto: copia(ev.ponto), tela: copia(ev.tela), dedo: copia(ev.dedo) } : e.mira;
  switch (ev.tipo) {
    case 'opcao':
      return opcao(e, ev);
    case 'cancelar':
      if (e.modo === 'melhorar' && e.selecao.length) return { ...e, selecao: [], efeitos: ['limpar'] };
      if (e.fase === 'ocioso') return { ...e, efeitos: ['sair'] };
      return limpo(e, ['limpar']);
    case 'construido':
      if (e.modo === 'melhorar') return { ...e, selecao: [], efeitos: ['limpar'] };
      if (e.continua && ev.fim && e.modo !== 'grade') {
        return { ...limpo(e, ['previa']), fase: 'aFixo', a: copia(ev.fim), tangente: ev.tangente ? copia(ev.tangente) : null };
      }
      return limpo(e, ['limpar']);
    case 'ajustar': {
      if (e.fase !== 'previa' && e.fase !== 'aFixo') return { ...e, efeitos: [] };
      const n = { ...e, efeitos: [] };
      if (ev.a) n.a = copia(ev.a);
      if (ev.b && e.b) n.b = copia(ev.b);
      return n;
    }
    case 'aresta': {
      if (e.modo !== 'melhorar' || ev.ref === null || ev.ref === undefined) return { ...e, efeitos: [] };
      const tem = e.selecao.includes(ev.ref);
      const selecao = tem ? (ev.somar ? e.selecao : e.selecao.filter((r) => r !== ev.ref)) : [...e.selecao, ev.ref];
      return { ...e, selecao, efeitos: ['previa'] };
    }
    default:
  }
  if (!ev.ponto) return { ...e, efeitos: [] }; // o dedo no céu: nada muda
  if (e.modo === 'melhorar') return melhorar(e, ev, mira);
  const p = copia(ev.ponto);
  const base = { ...e, mira, efeitos: ef };

  if (ev.tipo === 'hover') {
    if (e.dedo) return { ...e, efeitos: [] };
    if (e.fase === 'aFixo' || e.fase === 'mirandoB') {
      ef.push('previa');
      return { ...base, fase: 'aFixo', b: dist(p, e.a) > 0.5 ? p : null };
    }
    return base;
  }

  switch (e.fase) {
    case 'ocioso':
      if (ev.tipo !== 'inicio') return base;
      ef.push('previa');
      return { ...base, fase: 'mirandoA', a: p, b: null, meio: null, fundo: null, tangente: null, dedo: true, t0: ev.t ?? 0, tela0: copia(ev.tela), moveu: false };

    case 'mirandoA':
      if (ev.tipo === 'move') {
        ef.push('previa');
        const cedo = (ev.t ?? 0) - e.t0 <= VIA.atalhoMs;
        if (cedo && telaMoveu(e, ev, VIA.atalhoPx)) return { ...base, fase: 'mirandoB', b: p, moveu: true };
        return { ...base, a: p };
      }
      if (ev.tipo === 'fim') {
        ef.push('previa');
        return { ...base, fase: 'aFixo', dedo: false };
      }
      return base;

    case 'aFixo': {
      if (ev.tipo !== 'inicio') return base;
      const h = alcaSob(e, ev, amb);
      if (h?.id === 'a') return pegar(base, h, p, ev);
      ef.push('previa');
      return { ...base, fase: 'mirandoB', b: p, meio: null, fundo: null, dedo: true, t0: ev.t ?? 0, tela0: copia(ev.tela), moveu: false };
    }

    case 'mirandoB':
      if (ev.tipo === 'move') {
        ef.push('previa');
        return { ...base, b: p, moveu: true };
      }
      if (ev.tipo === 'fim') {
        ef.push('previa');
        if (dist(e.a, p) < VIA.minComp / 2) return { ...base, fase: 'aFixo', b: null, dedo: false };
        return { ...base, fase: 'previa', b: p, dedo: false };
      }
      return base;

    case 'previa': {
      if (ev.tipo !== 'inicio') return base;
      const h = alcaSob(e, ev, amb);
      if (h) return pegar(base, h, p, ev);
      // tocar fora das alças leva B até ali (o mesmo que arrastar a alça de B)
      ef.push('previa');
      return { ...base, fase: 'arrastando', alca: 'b', pega: [0, 0], b: p, meio: null, dedo: true, t0: ev.t ?? 0, tela0: copia(ev.tela), moveu: true };
    }

    case 'arrastando': {
      if (ev.tipo === 'move') {
        ef.push('previa');
        return { ...moverAlca(base, e.alca, [p[0] + e.pega[0], p[1] + e.pega[1]]), moveu: e.moveu || telaMoveu(e, ev, VIA.toquePx) };
      }
      if (ev.tipo === 'fim') {
        ef.push('previa');
        const moveu = e.moveu || telaMoveu(e, ev, VIA.toquePx);
        let n = { ...base, fase: 'previa', alca: null, pega: null, dedo: false, moveu };
        if (!moveu && e.alca === 'meio' && e.modo === 'reta') n.meio = null; // na Reta, tocar no meio endireita
        else if (moveu) n = moverAlca(n, e.alca, [p[0] + e.pega[0], p[1] + e.pega[1]]);
        if (!n.b || dist(n.a, n.b) < VIA.minComp / 2) return { ...n, fase: 'aFixo', b: null, meio: null };
        return n;
      }
      return base;
    }
    default:
      return base;
  }
}

function pegar(base, h, p, ev) {
  return {
    ...base,
    fase: 'arrastando',
    alca: h.id,
    pega: [h.p[0] - p[0], h.p[1] - p[1]],
    dedo: true,
    t0: ev.t ?? 0,
    tela0: copia(ev.tela),
    moveu: false,
    efeitos: [],
  };
}

function moverAlca(e, id, q) {
  if (id === 'a') {
    // A mexe: a Contínua perde a tangente (a via não sai mais do fim da anterior)
    return { ...e, a: q, tangente: e.tangente && dist(q, e.a) > 0.5 ? null : e.tangente };
  }
  if (id === 'b') return { ...e, b: q };
  if (id === 'meio') return { ...e, meio: q };
  if (id === 'fundo') return { ...e, fundo: q };
  return e;
}

function opcao(e, ev) {
  let n = { ...e, efeitos: ['previa'] };
  if (ev.tipoVia && TIPOS_VIA.includes(ev.tipoVia)) n.tipo = ev.tipoVia;
  if (typeof ev.continua === 'boolean') n.continua = ev.continua;
  if (typeof ev.encaixe === 'boolean') n.encaixe = ev.encaixe;
  if (COTAS_VIADUTO.includes(ev.cota)) n.cota = ev.cota;
  if (typeof ev.ponte === 'boolean') n.ponte = ev.ponte;
  if (ev.modo && MODOS_VIA.includes(ev.modo) && ev.modo !== e.modo) {
    const traco = (m) => m === 'reta' || m === 'curva';
    // entre Reta e Curva o traçado fica; Grade e Melhorar começam de novo
    if (traco(ev.modo) && traco(e.modo)) n.modo = ev.modo;
    else n = { ...limpo({ ...n, modo: ev.modo }, ['limpar']) };
  }
  return n;
}

function melhorar(e, ev, mira) {
  if (ev.tipo === 'inicio') return { ...e, mira, dedo: true, efeitos: [{ efeito: 'escolher', ponto: copia(ev.ponto), tela: copia(ev.tela), somar: false }] };
  if (ev.tipo === 'move' && e.dedo) return { ...e, mira, efeitos: [{ efeito: 'escolher', ponto: copia(ev.ponto), tela: copia(ev.tela), somar: true }] };
  if (ev.tipo === 'fim') return { ...e, mira, dedo: false, efeitos: [] };
  return { ...e, mira, efeitos: [] };
}

/** Nome de um efeito (string ou { efeito }). */
export const nomeEfeito = (x) => (typeof x === 'string' ? x : x?.efeito);

// ------------------------------------------------------------------------------------------------ plano

/**
 * Argumentos de q.via.previa para o estado (null sem dois pontos). Formato do contrato (seção 2.6) com os campos que a
 * interface acrescenta: `tangente` (Contínua) e `espacamento` (Grade).
 *   reta: [A, B]; curva: [A, C, B] (C é o controle da quadrática); continua: [A, C, B] com a tangente em A;
 *   grade: [A, B, C] (C é o canto oposto a A)
 */
export function argsPrevia(e, { tolerancia = 12, sessao = 0, semEncaixe = false } = {}) {
  if (!e.a || !e.b || e.modo === 'melhorar') return null;
  // cota e ponte automática (D106): a grade de quadras é sempre no chão
  const base = { tipo: e.tipo, tolerancia, encaixe: e.encaixe && !semEncaixe, sessao, ...(e.modo === 'grade' ? {} : { cota: e.cota ?? 0, ponte: e.ponte !== false }) };
  if (e.modo === 'grade') return { ...base, modo: 'grade', pontos: [copia(e.a), copia(e.b), cantoDaGrade(e.a, e.b, e.fundo, e.tipo)], espacamento: espacamentoGrade(e.tipo) };
  if (e.meio) return { ...base, modo: 'curva', pontos: [copia(e.a), controleDaAlca(e.a, e.b, e.meio), copia(e.b)] };
  if (e.continua && e.tangente) return { ...base, modo: 'continua', pontos: [copia(e.a), controleTangente(e.a, e.tangente, e.b), copia(e.b)], tangente: copia(e.tangente) };
  return { ...base, modo: 'reta', pontos: [copia(e.a), copia(e.b)] };
}

/** Ponta e tangente de chegada do último segmento de um plano (para a Contínua). */
export function fimDoPlano(plano) {
  const s = plano?.segmentos?.[plano.segmentos.length - 1];
  if (!s?.p) return null;
  const d = direcao(s.p, 1, [0, 0]);
  return { fim: [s.p[6], s.p[7]], tangente: d };
}

// ------------------------------------------------------------------------------------------------ espelho (leitura)

/** Nó vivo mais perto de p até raio: { idx, ponto, d } ou null. */
export function noPerto(esp, p, raio) {
  const N = esp?.vias?.nos;
  if (!N?.n) return null;
  let melhor = null;
  let md = raio * raio;
  for (let i = 0; i < N.n; i++) {
    if (!N.viva[i]) continue;
    const dx = N.x[i] - p[0];
    const dz = N.z[i] - p[1];
    const d = dx * dx + dz * dz;
    if (d <= md) {
      md = d;
      melhor = { idx: i, ponto: [N.x[i], N.z[i]], d: Math.sqrt(d) };
    }
  }
  return melhor;
}

/**
 * Aresta viva mais perto de p até raio (mais a meia largura dela): { idx, ref, t, d, ponto, tangente, meia } ou null.
 * `filtro(e)` pode recusar arestas.
 */
export function arestaPerto(esp, p, raio, filtro = null) {
  const A = esp?.vias?.arestas;
  if (!A?.n) return null;
  const mp = { t: 0, d: 0, x: 0, z: 0 };
  let melhor = null;
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e] || (filtro && !filtro(e))) continue;
    const meia = (VIAS[VIAS_ORDEM[A.tipo[e]]]?.largura ?? 16) / 2;
    const c = caixaBz(A.p, 8 * e, raio + meia);
    if (p[0] < c[0] || p[0] > c[2] || p[1] < c[1] || p[1] > c[3]) continue;
    maisPerto(A.p, p[0], p[1], 8 * e, mp);
    const d = Math.max(0, mp.d - meia);
    if (d <= raio && (!melhor || d < melhor.d)) {
      melhor = { idx: e, ref: refDe(e, A.ger?.[e] ?? 0), t: mp.t, d, ponto: [mp.x, mp.z], eixo: mp.d, meia };
    }
  }
  if (melhor) melhor.tangente = direcao(A.p, melhor.t, [0, 0], 8 * melhor.idx);
  return melhor;
}

/** Direção de saída de um nó: a tangente da única aresta ligada, apontando para fora (null com 0 ou 2+ arestas). */
function tangenteDoNo(esp, i) {
  const A = esp.vias.arestas;
  const lig = [];
  for (let e = 0; e < A.n; e++) if (A.viva[e] && (A.a[e] === i || A.b[e] === i)) lig.push(e);
  if (lig.length !== 1) return lig.length ? { varias: lig } : null;
  const e = lig[0];
  const noA = A.a[e] === i;
  const d = direcao(A.p, noA ? 0 : 1, [0, 0], 8 * e);
  return { dir: noA ? [-d[0], -d[1]] : d, aresta: e };
}

// ------------------------------------------------------------------------------------------------ encaixe (substituto)

const RAD = Math.PI / 180;

/**
 * Encaixa um ponto (substituto do encaixe da S1b, D18). Ordem: nó, ponto sobre aresta, ângulo e prolongamento em
 * relação à via de onde parte, quadra (paralela a 112 m da via vizinha), passo de 15 graus, comprimento de 8 m.
 * @param {object} esp espelho
 * @param {number[]} p ponto
 * @param {{ tol: number, de?: number[] | null, ref?: number[] | null, tipo?: string }} op  de: a outra ponta;
 *   ref: direção da via ligada em `de` (para os ângulos)
 * @returns {{ ponto: number[], encaixes: object[], guias: object[], no?: number, aresta?: object }}
 */
export function encaixarLocal(esp, p, { tol = 12, de = null, ref = null, tipo = 'rua' } = {}) {
  const enc = [];
  const guias = [];
  const tolNo = Math.max(tol, VIA.tolMin);
  const no = noPerto(esp, p, tolNo);
  if (no) {
    enc.push({ ponto: no.ponto, tipo: 'no', valor: no.idx });
    return { ponto: no.ponto, encaixes: enc, guias, no: no.idx };
  }
  const ar = arestaPerto(esp, p, tol);
  if (ar && ar.eixo <= ar.meia + tol) {
    enc.push({ ponto: ar.ponto, tipo: 'aresta', valor: ar.ref });
    return { ponto: ar.ponto, encaixes: enc, guias, aresta: ar };
  }
  if (!de) return { ponto: copia(p), encaixes: enc, guias };
  let q = copia(p);
  const L = dist(de, q);
  if (L < 1) return { ponto: q, encaixes: enc, guias };
  let ang = Math.atan2(q[1] - de[1], q[0] - de[0]);
  let angulou = false;
  if (ref) {
    const base = Math.atan2(ref[1], ref[0]);
    const rel = ang - base;
    const passo = VIA.passoAng * RAD;
    const alvo = Math.round(rel / passo) * passo;
    if (Math.abs(rel - alvo) <= VIA.folgaAng * RAD) {
      ang = base + alvo;
      angulou = true;
      // ângulo entre a via nova e a continuação da via ligada, de 0 (prolongamento) a 180
      const valor = Math.round(Math.abs(((((alvo / RAD) % 360) + 540) % 360) - 180));
      const t = valor === 0 ? 'prolongamento' : 'angulo';
      enc.push({ ponto: null, tipo: t, valor });
    }
  }
  if (!angulou) {
    // quadra: paralela à via vizinha na distância que fecha duas quadras de 6 células (a grade de 112 m da rua)
    const meiaNovo = (VIAS[tipo]?.largura ?? 16) / 2;
    const viz = arestaPerto(esp, q, 2 * VIA.fundoZona + 40 + tol);
    if (viz) {
      const alvoD = viz.meia + 2 * VIA.fundoZona + meiaNovo;
      if (Math.abs(viz.eixo - alvoD) <= tol) {
        const nx = (q[0] - viz.ponto[0]) / (viz.eixo || 1);
        const nz = (q[1] - viz.ponto[1]) / (viz.eixo || 1);
        q = [viz.ponto[0] + nx * alvoD, viz.ponto[1] + nz * alvoD];
        enc.push({ ponto: copia(q), tipo: 'quadra', valor: Math.round(alvoD) });
        const t = viz.tangente;
        guias.push({ tipo: 'quadra', a: [q[0] - t[0] * 60, q[1] - t[1] * 60], b: [q[0] + t[0] * 60, q[1] + t[1] * 60] });
        return { ponto: q, encaixes: enc, guias };
      }
    }
    const passo = VIA.passoAng * RAD;
    const alvo = Math.round(ang / passo) * passo;
    if (Math.abs(ang - alvo) <= VIA.folgaAng * RAD) {
      ang = alvo;
      enc.push({ ponto: null, tipo: 'passo', valor: Math.round((((alvo / RAD + 90) % 360) + 360) % 360) }); // rumo a partir do norte
    }
  }
  // comprimento múltiplo de 8 m
  const Lq = Math.max(VIA.passoComp, Math.round(L / VIA.passoComp) * VIA.passoComp);
  q = [de[0] + Math.cos(ang) * Lq, de[1] + Math.sin(ang) * Lq];
  for (const x of enc) if (!x.ponto) x.ponto = copia(q);
  enc.push({ ponto: copia(q), tipo: 'comprimento', valor: Lq });
  if (angulou) {
    const ext = Lq + 40;
    guias.push({ tipo: enc[0].tipo, a: copia(de), b: [de[0] + Math.cos(ang) * ext, de[1] + Math.sin(ang) * ext] });
  }
  return { ponto: q, encaixes: enc, guias };
}

// ------------------------------------------------------------------------------------------------ planejador substituto

/** Cota do chão (sem terreno: 0). */
export const cotaEm = (esp, x, z) => (esp?.terreno?.altura ? alturaEm(esp.terreno, x, z) : 0);

function ladrilhoDaHolding(esp, x, z) {
  const L = esp?.ladrilhos;
  if (!L?.estado) return true;
  const o = esp.mapa?.origem ?? [-4096, -4096];
  const lado = (esp.mapa?.tam ?? 8192) / (L.n || 16);
  const i = Math.floor((x - o[0]) / lado);
  const j = Math.floor((z - o[1]) / lado);
  if (i < 0 || j < 0 || i >= L.n || j >= L.n) return false;
  return L.estado[j * L.n + i] === LADRILHO.HOLDING;
}

function aguaEm(esp, x, z) {
  const T = esp?.terreno;
  if (!T?.agua) return false;
  const i = Math.round((x - T.origem[0]) / T.passo);
  const j = Math.round((z - T.origem[1]) / T.passo);
  if (i < 0 || j < 0 || i >= T.n || j >= T.n) return false;
  return T.agua[j * T.n + i] !== AGUA.TERRA;
}

/**
 * Mede um segmento sobre o terreno: comprimento, declive médio e máximo (janelas de 16 m), água e ladrilho.
 * @returns {{ comp: number, declMedio: number, declMax: number, agua: boolean, foraLadrilho: boolean, cotas: number[] }}
 */
export function medirSegmento(esp, p) {
  const tab = tabelaArco(p);
  const comp = tab[16];
  const n = Math.max(2, Math.ceil(comp / 8));
  const q = [0, 0];
  const hs = [];
  let agua = false;
  let fora = false;
  for (let i = 0; i <= n; i++) {
    pontoBz(p, i / n, q);
    hs.push(cotaEm(esp, q[0], q[1]));
    if (!agua && aguaEm(esp, q[0], q[1])) agua = true;
    if (!fora && !ladrilhoDaHolding(esp, q[0], q[1])) fora = true;
  }
  const ds = comp / n;
  let soma = 0;
  let max = 0;
  const janela = Math.max(1, Math.round(16 / Math.max(ds, 1)));
  for (let i = 0; i + janela <= n; i++) {
    const g = Math.abs(hs[i + janela] - hs[i]) / (janela * ds || 1);
    if (g > max) max = g;
  }
  for (let i = 0; i < n; i++) soma += Math.abs(hs[i + 1] - hs[i]);
  return { comp, declMedio: comp > 0 ? soma / comp : 0, declMax: max, agua, foraLadrilho: fora, cotas: [hs[0], hs[hs.length - 1]] };
}

/**
 * Planejador SUBSTITUTO (sem a S1b): mesmo formato de q.via.previa (seção 2.6). Encaixa as pontas, monta os segmentos
 * (reta, quadrática como cúbica, grade), mede no terreno e aponta os erros que dá para ver daqui (curto, água, declive,
 * ladrilho, raio). Custo: comprimento x custo por metro x (1 + 2 x declive médio); manutenção por km e hora.
 * @param {object} args os de argsPrevia
 * @param {object} esp espelho
 */
export function planejarLocal(args, esp) {
  const tipo = VIAS[args?.tipo] ?? VIAS.rua;
  const vazio = { ok: false, segmentos: [], nosNovos: 0, divisoes: 0, encaixes: [], guias: [], demolir: { predios: [], custo: 0 }, comprimento: 0, custo: 0, manutencaoHora: 0, erros: [], substituto: true };
  if (!args?.pontos?.length) return vazio;
  const tol = Math.max(VIA.tolMin, args.tolerancia ?? 12);
  const encaixes = [];
  const guias = [];
  const pts = args.pontos.map(copia);
  const ult = pts.length - 1;
  // A: nó ou aresta; a direção de referência para os ângulos sai da via ligada em A
  let ref = null;
  if (args.encaixe !== false) {
    const ea = encaixarLocal(esp, pts[0], { tol, tipo: args.tipo });
    pts[0] = ea.ponto;
    encaixes.push(...ea.encaixes);
    if (ea.no !== undefined) {
      const tn = tangenteDoNo(esp, ea.no);
      ref = tn?.dir ?? null;
    } else if (ea.aresta) ref = ea.aresta.tangente;
    if (args.tangente) ref = args.tangente;
  }
  if (ult === 0) return { ...vazio, ok: true, encaixes, guias };
  if (args.encaixe !== false) {
    // reta e grade: B por inteiro a partir de A; curvas: só nó e aresta na ponta B (a forma é da alça)
    const reto = args.modo === 'reta' || args.modo === 'grade';
    const ib = args.modo === 'grade' ? 1 : ult;
    const eb = encaixarLocal(esp, pts[ib], { tol, de: reto ? pts[0] : null, ref: reto ? ref : null, tipo: args.tipo });
    pts[ib] = eb.ponto;
    encaixes.push(...eb.encaixes);
    guias.push(...eb.guias);
    // grade: o canto C volta para a perpendicular do AB encaixado, em múltiplos do espaçamento
    if (args.modo === 'grade' && pts.length >= 3) pts[2] = cantoDaGrade(pts[0], pts[1], args.pontos[2], args.tipo);
  }
  const trechos = [];
  if (args.modo === 'grade' && pts.length >= 3) {
    for (const [x0, z0, x1, z1] of ruasDaGrade(pts[0], pts[1], pts[2], args.tipo)) trechos.push(reta(x0, z0, x1, z1));
  } else if ((args.modo === 'curva' || args.modo === 'continua') && pts.length >= 3) {
    const c = args.modo === 'continua' && args.tangente ? controleTangente(pts[0], args.tangente, pts[2]) : pts[1];
    trechos.push(deQuadratica(pts[0][0], pts[0][1], c[0], c[1], pts[2][0], pts[2][1]));
  } else {
    trechos.push(reta(pts[0][0], pts[0][1], pts[ult][0], pts[ult][1]));
  }
  const erros = [];
  const segmentos = [];
  let comprimento = 0;
  let custo = 0;
  trechos.forEach((p, k) => {
    const m = medirSegmento(esp, p);
    const errosS = [];
    if (m.comp < VIA.minComp) errosS.push('curto');
    if (m.agua) errosS.push('agua');
    if (m.declMax > tipo.declive) errosS.push('declive');
    if (m.foraLadrilho) errosS.push('ladrilho');
    if (trechos.length === 1 && raioMinimo(p) < tipo.raioMin) errosS.push('raio');
    for (const c of errosS) erros.push({ codigo: c, trecho: k });
    segmentos.push({ p: Array.from(p), tipo: args.tipo, cotas: m.cotas, ponte: false, erros: errosS, declive: m.declMax });
    comprimento += m.comp;
    custo += m.comp * (tipo.custoM ?? 0) * (1 + 2 * m.declMedio);
  });
  const nosNovos = args.modo === 'grade' ? 0 : encaixes.filter((x) => x.tipo === 'no').length >= 2 ? 0 : 2 - encaixes.filter((x) => x.tipo === 'no').length;
  return {
    ok: erros.length === 0,
    segmentos,
    nosNovos,
    divisoes: encaixes.filter((x) => x.tipo === 'aresta').length,
    encaixes,
    guias,
    demolir: { predios: [], custo: 0 },
    comprimento: Math.round(comprimento),
    custo: Math.round(custo),
    manutencaoHora: Math.round((comprimento / 1000) * (tipo.manutKmH ?? 0)),
    erros,
    substituto: true,
  };
}

/** Menor raio de curvatura de uma cúbica (amostrado), em metros; reta dá Infinity. */
export function raioMinimo(p) {
  let min = Infinity;
  for (let i = 1; i < 16; i++) {
    const t = i / 16;
    const u = 1 - t;
    const dx = 3 * u * u * (p[2] - p[0]) + 6 * u * t * (p[4] - p[2]) + 3 * t * t * (p[6] - p[4]);
    const dz = 3 * u * u * (p[3] - p[1]) + 6 * u * t * (p[5] - p[3]) + 3 * t * t * (p[7] - p[5]);
    const ddx = 6 * u * (p[4] - 2 * p[2] + p[0]) + 6 * t * (p[6] - 2 * p[4] + p[2]);
    const ddz = 6 * u * (p[5] - 2 * p[3] + p[1]) + 6 * t * (p[7] - 2 * p[5] + p[3]);
    const cr = Math.abs(dx * ddz - dz * ddx);
    if (cr < 1e-9) continue;
    const r = (dx * dx + dz * dz) ** 1.5 / cr;
    if (r < min) min = r;
  }
  return min;
}

// ------------------------------------------------------------------------------------------------ Melhorar

/**
 * Prévia do Melhorar pelas arestas escolhidas: cada uma vale se o tipo novo está em `melhoraPara` do tipo dela. Custo
 * ESTIMADO pela diferença do custo por metro (a simulação cobra de verdade no comando via.melhorar).
 * @returns {{ ok, arestas: [{ ref, idx, de, ok, codigo? }], segmentos, comprimento, custo, erros }}
 */
export function previaMelhorar(esp, refs, tipoNovo) {
  const A = esp?.vias?.arestas;
  const novo = VIAS[tipoNovo];
  const lista = [];
  const segmentos = [];
  let comprimento = 0;
  let custo = 0;
  const erros = [];
  for (const ref of refs) {
    const e = ref % 1048576;
    if (!A || e >= A.n || !A.viva[e]) {
      lista.push({ ref, idx: e, ok: false, codigo: 'inexistente' });
      continue;
    }
    const de = VIAS_ORDEM[A.tipo[e]];
    let codigo = null;
    if (A.flags[e] & ARESTA.ARCOLOGIA) codigo = 'arcologia';
    else if (de === 'rodovia') codigo = 'rodovia';
    else if (de === tipoNovo) codigo = 'nada';
    else if (!VIAS[de]?.melhoraPara?.includes(tipoNovo)) codigo = 'valor';
    const comp = A.comp[e] || 0;
    const p = Array.from(A.p.subarray(8 * e, 8 * e + 8));
    segmentos.push({ p, tipo: tipoNovo, cotas: [A.y?.[2 * e] ?? 0, A.y?.[2 * e + 1] ?? 0], ponte: false, erros: codigo ? [codigo] : [] });
    lista.push({ ref, idx: e, de, ok: !codigo, codigo });
    if (codigo) erros.push({ codigo, trecho: segmentos.length - 1 });
    else {
      comprimento += comp;
      custo += comp * Math.max(0, (novo?.custoM ?? 0) - (VIAS[de]?.custoM ?? 0));
    }
  }
  return { ok: lista.length > 0 && lista.some((x) => x.ok), arestas: lista, segmentos, comprimento: Math.round(comprimento), custo: Math.round(custo), erros, estimado: true };
}
