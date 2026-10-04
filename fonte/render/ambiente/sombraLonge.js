// Sombra de longe e HAO pelo campo de alturas (desenho do render 2.5 e 2.6, D9): a partir da grade do campo de alturas
// da cidade (campoAlturas.js, R16F), um passe na GPU escreve o campo (RGBA16F sobre o mapa, 1024² no Média e no Leve,
// 2048² no Alta e no Ultra): R e G a altura da sombra em dois degraus seguidos do sol, B a visibilidade do céu no chão
// da vizinhança e A a cota desse chão (shaders/sombra.glsl.js, CAMPO_PASSE). Os materiais leem uma textura só.
//
// O sol anda em degraus de 3 graus de ângulo horário (0,2 h de céu). O campo em uso guarda os degraus k e k + 1 e a
// sombra mistura os dois pela fração da hora (gCampoT): ela anda sem salto. Enquanto isso o campo seguinte (k + 1 e
// k + 2) sai em 16 ladrilhos, um por quadro, copiando o que não muda; quando o sol passa ao degrau seguinte os dois
// trocam. Em 1x o sol anda 3 graus em 5 s; em 4x, em 1,25 s (a 30 qps os 16 ladrilhos saem em 0,53 s). Com quadros
// mais lentos que o sol saem até 4 por quadro, no ritmo que deixa o campo seguinte pronto com 85% do degrau, e a troca
// não faz o resto de uma vez. Um salto de hora (cena, hora forçada) refaz tudo de uma vez; a troca entre o sol e a lua
// refaz em ladrilhos (é no crepúsculo, sem luz). Quando o campo de alturas muda em retângulos (um prédio nasce), só
// eles e a faixa da sombra deles contra o sol são refeitos, nos dois campos.
//
// Sombra longa (VIS1d): depois da marcha de perto (~900 m, chão e cidade), a marcha de longe segue até 3,5 km só pelo
// topo da cidade (prédios e Arcologia, sem os morros), em duas grades pequenas feitas aqui do campo de alturas (Altos):
// a Blade Tower, de 500 m, faz 3,2 km de sombra com o sol a 9 graus, os anéis 1 km. O campo é preso ao mundo e anda
// entre os degraus do sol pela mistura do campo (gCampoMistura, shaders/sombra.glsl.js: onde um dos degraus é só o
// chão, o tempo se curva e a ponta anda pelo degrau inteiro, sem saltar no começo): a sombra longa não treme quando a
// câmera anda nem quando o sol muda de degrau. Cada passe recebe o maior topo da região que a marcha de longe alcança contra o sol (por ladrilho, também
// no refazer inteiro): sem prédio alto a montante, ela nem começa.
import * as THREE from 'three';
import { CAMPO_PASSE, MARCHA, distanciaDaMarcha, PASSO_NIVEL1, MARCHA_LONGE, MISTURA_CAMPO } from '../materiais/shaders/sombra.glsl.js';
import { posicaoSol, posicaoLua, mesAbsoluto } from './astro.js';
import { juntarRet, VAZIO, paraMeia, subirRetangulos } from './campoAlturas.js';

/** Degrau do sol em horas de céu (15 graus por hora: 0,2 h = 3 graus). */
export const DEGRAU_HORAS = 0.2;
export const DEGRAUS_DIA = Math.round(24 / DEGRAU_HORAS);
/** Ladrilhos por lado do campo (16 ao todo). */
export const LADO_LADRILHOS = 4;
const TOTAL = LADO_LADRILHOS * LADO_LADRILHOS;
/**
 * Um ladrilho por quadro; quando o sol anda mais rápido que isso (quadros lentos em 4x), até este número por quadro,
 * no ritmo que deixa o campo seguinte pronto com 85% do degrau: a troca não faz o resto de uma vez.
 */
export const LADRILHOS_MAX = 4;

/**
 * Ladrilhos do campo seguinte que devem estar prontos na fração t do degrau, para um campo começado na fração t0 (o
 * ritmo acima). Com o sol parado (jogo em pausa, cena de hora fixa) a meta não anda e sai um por quadro.
 */
export const metaLadrilhos = (t, t0 = 0) =>
  Math.min(TOTAL, Math.ceil((TOTAL * Math.max(0, t - t0)) / Math.max(0.05, 0.85 - t0)));
/** Alcance da marcha da sombra (m). */
export const ALCANCE = distanciaDaMarcha(MARCHA.passos);
/**
 * Alcance da marcha de longe, pelos prédios (m): a sombra das torres altas com o sol baixo (VIS1d). A marcha nunca lê
 * além dele (o último passo inteiro cabe antes; ~3.460 m no 'pc' e no Média): o maior topo da região de cada passe e a
 * faixa suja de um prédio que nasce vão até aqui, e os ladrilhos vizinhos dão a mesma sombra na borda.
 */
export const ALCANCE_LONGE = MARCHA_LONGE.fim;
/** Folga (m) do maior do campo passado à marcha: a meia precisão da textura erra até 0,25 m entre 512 e 1.024 m. */
export const FOLGA_HMAX = 1;
/** Tangente mínima da elevação da luz (o sol rente não estica a sombra além do alcance da marcha). */
const TAN_MIN = 0.02;
const TAN_MAX = 60;

/** Degrau e fração de uma hora do céu. */
export function degrauDaHora(hora) {
  const h = (((hora % 24) + 24) % 24) / DEGRAU_HORAS;
  const k = Math.floor(h);
  return { k: k % DEGRAUS_DIA, t: h - k };
}

/**
 * Direção da luz chave num degrau: [dx, dz, tan, ok] com (dx, dz) unitário no chão PARA a luz, a tangente da elevação
 * e ok = 1 com a luz acima do horizonte.
 * @param {'sol' | 'lua'} chave
 */
export function direcaoDoDegrau(chave, k, tempo, mapa, alvo = [0, 0, 0, 0]) {
  const hora = (((k % DEGRAUS_DIA) + DEGRAUS_DIA) % DEGRAUS_DIA) * DEGRAU_HORAS;
  const lat = mapa?.latitude ?? -23.5;
  const norte = mapa?.norteAz ?? 0;
  const dia = tempo?.diaDoAno ?? 0;
  const d = chave === 'lua' ? posicaoLua(hora, dia, mesAbsoluto(tempo), lat, norte).dir : posicaoSol(hora, dia, lat, norte).dir;
  const h = Math.hypot(d[0], d[2]);
  alvo[0] = h > 1e-6 ? d[0] / h : 1;
  alvo[1] = h > 1e-6 ? d[2] / h : 0;
  alvo[2] = Math.min(TAN_MAX, Math.max(TAN_MIN, d[1] / Math.max(h, 1e-6)));
  alvo[3] = d[1] > -0.02 ? 1 : 0;
  return alvo;
}

/**
 * A altura da sombra entre os dois degraus pela mesma conta do GLSL (gCampoMistura, shaders/sombra.glsl.js): r e g as
 * alturas do campo nos degraus k e k + 1, a o chão da célula (o A do campo) e t a fração do degrau.
 * @example misturaDoCampo(40, 60, 0, 0.5) // 50: as duas são sombra, a reta
 */
export function misturaDoCampo(r, g, a, t) {
  const { potencia: p, chao: [c0, c1] } = MISTURA_CAMPO;
  const curva = g > r ? t ** p : 1 - (1 - t) ** p;
  const x = Math.min(1, Math.max(0, (Math.min(r, g) - a - c0) / (c1 - c0)));
  const w = 1 - x * x * (3 - 2 * x);
  return r + (g - r) * (t + (curva - t) * w);
}

// ------------------------------------------------------------------------------------------------ sombra longa (VIS1d)

/**
 * As duas grades da marcha de longe (MARCHA_LONGE), feitas do topo da cidade do campo (Campo.cidade: prédios e
 * Arcologia, sem o chão): a fina, com o maior topo em `celulas` x `celulas` células do campo (8 m no Alta e no 'pc',
 * 16 m no Média), e a de saltos, com o maior topo em `refino` x `refino` células finas (64 m e 128 m) e nas 8 vizinhas
 * (`saltos`; `bruto` sem as vizinhas, para o maior da região). Na CPU para os testes e para o maior da região de cada
 * passe; em meia precisão para as texturas (uAltos e uSaltos). Sem three.
 */
export class Altos {
  constructor(campo) {
    const { celulas, refino } = MARCHA_LONGE;
    this.campoN = campo.N;
    this.N = Math.ceil(campo.N / celulas);
    this.passo = campo.passo * celulas;
    this.gx = campo.gx;
    this.gz = campo.gz;
    this.tam = campo.tam;
    this.NS = Math.ceil(this.N / refino);
    this.passoSalto = this.passo * refino;
    const vazio = paraMeia(VAZIO);
    this.fino = new Float32Array(this.N * this.N).fill(VAZIO);
    this.meiaFino = new Uint16Array(this.N * this.N).fill(vazio);
    this.bruto = new Float32Array(this.NS * this.NS).fill(VAZIO);
    this.saltos = new Float32Array(this.NS * this.NS).fill(VAZIO);
    this.meiaSaltos = new Uint16Array(this.NS * this.NS).fill(vazio);
  }

  /**
   * Refaz as células que cobrem o retângulo [i0, j0, i1, j1] de células do campo.
   * @returns {{ antes: number, depois: number, fino: number[], saltos: number[] }} o maior topo da cidade nas células
   *   refeitas antes e depois (VAZIO sem prédio) e os retângulos refeitos de cada grade
   */
  atualizar(campo, [i0, j0, i1, j1]) {
    const { celulas, refino } = MARCHA_LONGE;
    const { N, NS, fino, meiaFino, bruto, saltos, meiaSaltos } = this;
    const cid = campo.cidade;
    const CN = campo.N;
    const a0 = Math.max(0, Math.floor(i0 / celulas));
    const a1 = Math.min(N - 1, Math.floor(i1 / celulas));
    const b0 = Math.max(0, Math.floor(j0 / celulas));
    const b1 = Math.min(N - 1, Math.floor(j1 / celulas));
    let antes = VAZIO;
    let depois = VAZIO;
    for (let b = b0; b <= b1; b++) {
      for (let a = a0; a <= a1; a++) {
        const k = b * N + a;
        if (fino[k] > antes) antes = fino[k];
        let m = VAZIO;
        const jf = Math.min(CN, (b + 1) * celulas);
        const iF = Math.min(CN, (a + 1) * celulas);
        for (let jj = b * celulas; jj < jf; jj++) for (let q = jj * CN + a * celulas, f = jj * CN + iF; q < f; q++) if (cid[q] > m) m = cid[q];
        fino[k] = m;
        meiaFino[k] = paraMeia(m);
        if (m > depois) depois = m;
      }
    }
    // as células de saltos que o retângulo fino toca (o maior delas) e, uma a mais em volta, o maior com as vizinhas
    const c0 = Math.floor(a0 / refino);
    const c1 = Math.floor(a1 / refino);
    const d0 = Math.floor(b0 / refino);
    const d1 = Math.floor(b1 / refino);
    for (let d = d0; d <= d1; d++) {
      for (let c = c0; c <= c1; c++) {
        let m = VAZIO;
        const jf = Math.min(N, (d + 1) * refino);
        const iF = Math.min(N, (c + 1) * refino);
        for (let b = d * refino; b < jf; b++) for (let q = b * N + c * refino, f = b * N + iF; q < f; q++) if (fino[q] > m) m = fino[q];
        bruto[d * NS + c] = m;
      }
    }
    const e0 = Math.max(0, c0 - 1);
    const e1 = Math.min(NS - 1, c1 + 1);
    const f0 = Math.max(0, d0 - 1);
    const f1 = Math.min(NS - 1, d1 + 1);
    for (let d = f0; d <= f1; d++) {
      for (let c = e0; c <= e1; c++) {
        let m = VAZIO;
        for (let y = Math.max(0, d - 1); y <= Math.min(NS - 1, d + 1); y++) {
          for (let x = Math.max(0, c - 1); x <= Math.min(NS - 1, c + 1); x++) if (bruto[y * NS + x] > m) m = bruto[y * NS + x];
        }
        saltos[d * NS + c] = m;
        meiaSaltos[d * NS + c] = paraMeia(m);
      }
    }
    return { antes, depois, fino: [a0, b0, a1, b1], saltos: [e0, f0, e1, f1] };
  }

  /** O maior topo da cidade nas células de saltos que tocam a caixa do mundo [x0, z0, x1, z1] (VAZIO sem prédio). */
  maximoNaCaixa(x0, z0, x1, z1) {
    const { NS, passoSalto: P, gx, gz, bruto } = this;
    const c0 = Math.max(0, Math.floor((x0 - gx) / P));
    const c1 = Math.min(NS - 1, Math.floor((x1 - gx) / P));
    const d0 = Math.max(0, Math.floor((z0 - gz) / P));
    const d1 = Math.min(NS - 1, Math.floor((z1 - gz) / P));
    let m = VAZIO;
    for (let d = d0; d <= d1; d++) for (let c = c0; c <= c1; c++) if (bruto[d * NS + c] > m) m = bruto[d * NS + c];
    return m;
  }

  /** O topo na célula fina do ponto (x, z), com a borda presa (a leitura do texelFetch). */
  finoEm(x, z) {
    const { N } = this;
    const a = Math.min(N - 1, Math.max(0, Math.floor((x - this.gx) / this.passo)));
    const b = Math.min(N - 1, Math.max(0, Math.floor((z - this.gz) / this.passo)));
    return this.fino[b * N + a];
  }

  /** O maior topo na célula de saltos do ponto e nas vizinhas, com a borda presa. */
  saltoEm(x, z) {
    const { NS } = this;
    const c = Math.min(NS - 1, Math.max(0, Math.floor((x - this.gx) / this.passoSalto)));
    const d = Math.min(NS - 1, Math.max(0, Math.floor((z - this.gz) / this.passoSalto)));
    return this.saltos[d * NS + c];
  }
}

/**
 * Caixa do mundo [x0, z0, x1, z1] onde a marcha de longe dos receptores do retângulo de células [i0, j0, i1, j1] do
 * campo pode ler: os receptores e eles andados até o alcance de longe contra cada luz acima do horizonte.
 */
export function caixaDaMarchaLonge([i0, j0, i1, j1], dirs, passo, gx, gz, alcance = ALCANCE_LONGE) {
  const x0 = gx + i0 * passo;
  const z0 = gz + j0 * passo;
  const x1 = gx + (i1 + 1) * passo;
  const z1 = gz + (j1 + 1) * passo;
  const b = [x0, z0, x1, z1];
  for (const d of dirs) {
    if (!d?.[3]) continue;
    b[0] = Math.min(b[0], x0 + d[0] * alcance);
    b[1] = Math.min(b[1], z0 + d[1] * alcance);
    b[2] = Math.max(b[2], x1 + d[0] * alcance);
    b[3] = Math.max(b[3], z1 + d[1] * alcance);
  }
  return b;
}

/**
 * A marcha de longe pela mesma conta do GLSL (marcharLonge): continua a sombra s da marcha de perto no ponto (x, z),
 * de ALCANCE até ALCANCE_LONGE (sem passar dele) em passos do tamanho da célula de saltos; lê a célula de saltos no
 * meio do passo e, só quando ela poderia subir a sombra, as células finas do passo. hMax: o maior topo da região (para quando nada
 * mais à frente subiria a sombra; o resultado é o mesmo).
 */
export function alturaDaSombraLonge(altos, x, z, dir, s, hMax = Infinity) {
  if (!dir[3] || hMax - ALCANCE * dir[2] <= s) return s;
  const P = altos.passoSalto;
  const pf = P / MARCHA_LONGE.refino;
  const { gx, gz, tam } = altos;
  for (let k = 0; k < MARCHA_LONGE.passosMax; k++) {
    const t0 = ALCANCE + k * P;
    if (t0 + P > ALCANCE_LONGE || hMax - t0 * dir[2] <= s) break;
    const mx = x + dir[0] * (t0 + 0.5 * P);
    const mz = z + dir[1] * (t0 + 0.5 * P);
    if (mx < gx || mz < gz || mx > gx + tam || mz > gz + tam) break;
    if (altos.saltoEm(mx, mz) - t0 * dir[2] <= s) continue;
    for (let r = 0; r < MARCHA_LONGE.refino; r++) {
      const t = t0 + (r + 0.5) * pf;
      s = Math.max(s, altos.finoEm(x + dir[0] * t, z + dir[1] * t) - t * dir[2]);
    }
  }
  return s;
}

/**
 * Até onde a sombra de um topo da cidade `h` metros acima do chão mais baixo do mapa chega com as luzes dadas (m): de
 * ALCANCE (a marcha de perto) a ALCANCE_LONGE. Um prédio que nasce ou some suja a faixa da sombra dele até aí.
 */
export function alcanceDoTopo(h, dirs) {
  let a = ALCANCE;
  for (const d of dirs) if (d?.[3] && h > 0) a = Math.max(a, h / d[2]);
  return Math.min(ALCANCE_LONGE, a);
}

// ------------------------------------------------------------------------------------------------ marcha de perto

/**
 * Altura da sombra na célula (i, j) pela mesma marcha do GLSL, sobre o campo da CPU (campoAlturas.js, Campo): o campo
 * bilinear no fim de cada passo e no meio dele e, nos passos longos, também a célula do nível 1 de cada amostra; com
 * hMax (o maior do campo na região), para quando nada à frente subiria a sombra (testes e conferência). Com `longe`
 * ({ altos, hMax }), segue pela marcha de longe dos prédios (VIS1d), como o passe da GPU.
 */
export function alturaDaSombra(campo, i, j, dir, hMax = Infinity, longe = null) {
  if (!dir[3]) return -1e4;
  const { passo, gx, gz, tam } = campo;
  const x = gx + (i + 0.5) * passo;
  const z = gz + (j + 0.5) * passo;
  const c1 = 2 * passo;
  const nivel1 = (a, b) => campo.maximo(1, Math.floor((a - gx) / c1), Math.floor((b - gz) / c1));
  let s = -1e4;
  let t = 0;
  for (let k = 0; k < MARCHA.passos; k++) {
    const f = k / (MARCHA.passos - 1);
    const p = MARCHA.primeiro + (MARCHA.ultimo - MARCHA.primeiro) * f * f;
    t += p;
    const qx = x + dir[0] * t;
    const qz = z + dir[1] * t;
    if (qx < gx || qz < gz || qx > gx + tam || qz > gz + tam) break;
    const tm = t - 0.5 * p;
    const mx = x + dir[0] * tm;
    const mz = z + dir[1] * tm;
    let hq = campo.altura(qx, qz);
    let hm = campo.altura(mx, mz);
    if (p > PASSO_NIVEL1 * passo) {
      hq = Math.max(hq, nivel1(qx, qz));
      hm = Math.max(hm, nivel1(mx, mz));
    }
    s = Math.max(s, hq - t * dir[2], hm - tm * dir[2]);
    if (hMax - t * dir[2] <= s) break;
  }
  return longe?.altos ? alturaDaSombraLonge(longe.altos, x, z, dir, s, longe.hMax ?? Infinity) : s;
}

/**
 * Visibilidade do céu no chão de uma célula pela mesma conta do GLSL: o chão é o menor dos 9 vizinhos, e em cada uma
 * das 8 direções vale o maior ângulo acima do horizonte nos raios de 1, 2, 4 e 8 células.
 * @param {(x: number, z: number) => number} altura
 * @returns {{ v: number, chao: number }}
 */
export function haoNoCampo(altura, x, z, passo) {
  const hs = [];
  let chao = altura(x, z);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const h = altura(x + Math.cos(a) * passo, z + Math.sin(a) * passo);
    hs.push(h);
    chao = Math.min(chao, h);
  }
  let soma = 0;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    let m = Math.max(0, (hs[i] - chao) / passo);
    for (const r of [2, 4, 8]) m = Math.max(m, (altura(x + Math.cos(a) * passo * r, z + Math.sin(a) * passo * r) - chao) / (r * passo));
    soma += m / Math.sqrt(1 + m * m);
  }
  return { v: 1 - soma / 8, chao };
}

/**
 * Retângulo de células que uma mudança no retângulo r afeta: a oclusão num raio de 9 células e a sombra dela, que
 * cai para longe da luz até o alcance da marcha (nas direções dadas; o de longe para um prédio alto, alcanceDoTopo).
 */
export function retanguloAfetado(r, dirs, passo, N, alcance = ALCANCE) {
  const m = 9;
  let [i0, j0, i1, j1] = [r[0] - m, r[1] - m, r[2] + m, r[3] + m];
  const alc = alcance / passo + 1;
  for (const d of dirs) {
    if (!d?.[3]) continue;
    i0 = Math.min(i0, Math.floor(r[0] - d[0] * alc) - 1);
    i1 = Math.max(i1, Math.ceil(r[2] - d[0] * alc) + 1);
    j0 = Math.min(j0, Math.floor(r[1] - d[1] * alc) - 1);
    j1 = Math.max(j1, Math.ceil(r[3] - d[1] * alc) + 1);
  }
  return [Math.max(0, i0), Math.max(0, j0), Math.min(N - 1, i1), Math.min(N - 1, j1)];
}

// ------------------------------------------------------------------------------------------------ domínio

const VERTICE = /* glsl */ `
void main() {
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}
`;

function criarDominio(ctx) {
  const u = ctx.ganchos.uniformes;
  const r = ctx.renderer;
  const suporta = !!(r.extensions.has('EXT_color_buffer_float') || r.extensions.has('EXT_color_buffer_half_float'));
  const mat = new THREE.ShaderMaterial({
    name: 'campo-passe',
    uniforms: {
      uAlturas: { value: null }, uAnterior: { value: null }, uN: { value: 1024 }, uPassoM: { value: 8 }, uTam: { value: 8192 },
      uDirA: { value: new THREE.Vector4() }, uDirB: { value: new THREE.Vector4() }, uModo: { value: 0 }, uHMax: { value: 1e5 },
      uAltos: { value: null }, uSaltos: { value: null }, uLonge: { value: new THREE.Vector4(ALCANCE, ALCANCE_LONGE, 64, VAZIO) },
    },
    vertexShader: VERTICE,
    fragmentShader: CAMPO_PASSE,
    depthTest: false,
    depthWrite: false,
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const malha = new THREE.Mesh(g, mat);
  malha.frustumCulled = false;
  const cena = new THREE.Scene();
  cena.add(malha);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let alvos = null;
  let N = 0;
  let versaoCampo = -1;
  // a sombra longa (VIS1d): as grades dos prédios para a marcha de longe, refeitas pelos retângulos do campo
  let altos = null;
  let campoDosAltos = null;
  let texAltos = null;
  let texSaltos = null;
  const st = {
    atual: 0, // índice do campo em uso
    valido: false, // o campo em uso tem os dois degraus
    k: -1,
    chave: 'sol',
    t: 0,
    t0: 0, // fração do degrau em que o campo seguinte começou (o ritmo dos ladrilhos)
    feitos: 0, // ladrilhos prontos do campo seguinte
    refazer: -1, // ladrilho do campo em uso sendo refeito em fatias (troca sol/lua), -1 nada
    semLonge: false, // só na bancada (ensaiar): a marcha de longe desligada, para medir o custo dela
    dirs: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], // k, k + 1, k + 2
  };
  // atrasos: trocas em que o campo seguinte ainda não estava pronto (o resto dos ladrilhos saiu de uma vez)
  // longe: passes com a marcha de longe ligada (algum prédio alto a montante); topo: o maior topo da cidade
  const medida = { passes: 0, ladrilhos: 0, completos: 0, trocas: 0, atrasos: 0, retangulos: 0, texeis: 0, maxQuadro: 0, longe: 0, topo: VAZIO };
  ctx.medidas.stats.longe = medida;

  function criarAlvos(n) {
    for (const a of alvos ?? []) a.dispose();
    N = n;
    const op = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    alvos = [new THREE.WebGLRenderTarget(n, n, op), new THREE.WebGLRenderTarget(n, n, op)];
    alvos[0].texture.name = 'campo:a';
    alvos[1].texture.name = 'campo:b';
    st.valido = false;
    st.feitos = 0;
  }

  /** Uma grade dos prédios em meia precisão (R16F, sem filtro: a marcha lê por texelFetch). */
  function texturaDaGrade(dados, n, nome) {
    const t = new THREE.DataTexture(dados, n, n, THREE.RedFormat, THREE.HalfFloatType);
    t.mipmaps = [{ data: dados, width: n, height: n }]; // subirRetangulos sobe pelos níveis
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = false;
    t.name = nome;
    t.needsUpdate = true;
    return t;
  }

  /**
   * As grades dos prédios (Altos) em dia com o campo: inteiras quando o campo é outro (carga, troca de qualidade), nos
   * retângulos que mudaram no resto. Devolve, por retângulo, o maior topo da cidade nele antes e depois.
   */
  function atualizarAltos(CA, rets) {
    const cp = CA.campo;
    if (!cp?.cidade) return rets.map(() => VAZIO);
    if (cp !== campoDosAltos) {
      campoDosAltos = cp;
      altos = new Altos(cp);
      texAltos?.dispose();
      texSaltos?.dispose();
      altos.atualizar(cp, [0, 0, cp.N - 1, cp.N - 1]);
      texAltos = texturaDaGrade(altos.meiaFino, altos.N, 'campo:altos');
      texSaltos = texturaDaGrade(altos.meiaSaltos, altos.NS, 'campo:saltos');
      medida.topo = altos.maximoNaCaixa(-Infinity, -Infinity, Infinity, Infinity);
      return rets.map(() => medida.topo);
    }
    const topos = [];
    const sujosA = [];
    const sujosS = [];
    for (const ret of rets) {
      const { antes, depois, fino, saltos } = altos.atualizar(cp, ret);
      topos.push(Math.max(antes, depois));
      sujosA.push([0, fino]);
      sujosS.push([0, saltos]);
    }
    if (rets.length) {
      if (!subirRetangulos(r, texAltos, sujosA)) texAltos.needsUpdate = true;
      if (!subirRetangulos(r, texSaltos, sujosS)) texSaltos.needsUpdate = true;
      medida.topo = altos.maximoNaCaixa(-Infinity, -Infinity, Infinity, Infinity);
    }
    return topos;
  }

  /** Desenha o retângulo de células [i0..i1] x [j0..j1] do alvo no modo (0 completo, 1 passo). */
  function passe(alvo, [i0, j0, i1, j1], modo, dA, dB, anterior, medidas) {
    const U = mat.uniforms;
    U.uModo.value = modo;
    U.uDirA.value.fromArray(dA);
    U.uDirB.value.fromArray(dB);
    U.uAnterior.value = anterior?.texture ?? null;
    const w = i1 - i0 + 1;
    const h = j1 - j0 + 1;
    if (w <= 0 || h <= 0) return;
    // o maior do campo onde a marcha destes texels chega (o retângulo mais o alcance e a folga do filtro)
    const cp = ctx.campoAlturas?.campo;
    const m = Math.ceil(ALCANCE / (ctx.campoAlturas?.passo || 8)) + 2;
    U.uHMax.value = cp?.maximoNaRegiao ? cp.maximoNaRegiao(i0 - m, j0 - m, i1 + m, j1 + m) + FOLGA_HMAX : 1e5;
    // a marcha de longe: o maior topo da cidade na região que ela alcança contra o sol; VAZIO (nem começa) quando nem
    // ele faria sombra além da marcha de perto no chão mais baixo do mapa (o sol alto, ou só prédios baixos)
    let topo = VAZIO;
    if (altos && texAltos && cp && !st.semLonge) {
      const luzes = modo ? [dB] : [dA, dB];
      topo = altos.maximoNaCaixa(...caixaDaMarchaLonge([i0, j0, i1, j1], luzes, cp.passo, cp.gx, cp.gz)) + FOLGA_HMAX;
      if (alcanceDoTopo(topo - (ctx.sim?.espelho?.mapa?.nivelMar ?? 0), luzes) <= ALCANCE) topo = VAZIO;
    }
    U.uAltos.value = texAltos;
    U.uSaltos.value = texSaltos;
    U.uLonge.value.set(ALCANCE, ALCANCE_LONGE, altos?.passoSalto ?? 64, topo);
    if (topo > VAZIO / 2) medida.longe++;
    alvo.viewport.set(i0, j0, w, h);
    alvo.scissor.set(i0, j0, w, h);
    alvo.scissorTest = true;
    const antes = r.getRenderTarget();
    const limpa = r.autoClear;
    r.autoClear = false;
    r.setRenderTarget(alvo);
    const fazer = () => r.render(cena, cam);
    if (medidas) medidas.passe(fazer);
    else fazer();
    r.setRenderTarget(antes);
    r.autoClear = limpa;
    alvo.scissorTest = false;
    alvo.viewport.set(0, 0, N, N);
    alvo.scissor.set(0, 0, N, N);
    medida.passes++;
    medida.texeis += w * h;
  }

  const ladrilho = (i) => {
    const L = N / LADO_LADRILHOS;
    const a = i % LADO_LADRILHOS;
    const b = Math.floor(i / LADO_LADRILHOS);
    return [a * L, b * L, (a + 1) * L - 1, (b + 1) * L - 1];
  };

  function direcoes(k) {
    const esp = ctx.sim?.espelho;
    for (let m = 0; m < 3; m++) direcaoDoDegrau(st.chave, k + m, ctx.ambiente?.tempoCeu?.() ?? esp?.tempo, esp?.mapa, st.dirs[m]);
  }

  /**
   * Refaz o campo em uso inteiro (e zera o seguinte), ladrilho a ladrilho: cada um com o maior da região dele, e a
   * marcha de longe só onde há prédio alto a montante.
   */
  function refazerTudo(medidas) {
    direcoes(st.k);
    for (let i = 0; i < TOTAL; i++) passe(alvos[st.atual], ladrilho(i), 0, st.dirs[0], st.dirs[1], null, medidas);
    st.valido = true;
    st.feitos = 0;
    st.t0 = st.t;
    st.refazer = -1;
    medida.completos++;
  }

  /** Um ladrilho do campo seguinte (degraus k + 1 e k + 2), copiando o que não muda do campo em uso. */
  function ladrilhoSeguinte(medidas) {
    passe(alvos[1 - st.atual], ladrilho(st.feitos), 1, st.dirs[1], st.dirs[2], alvos[st.atual], medidas);
    st.feitos++;
    medida.ladrilhos++;
  }

  function trocar() {
    st.atual = 1 - st.atual;
    st.k = (st.k + 1) % DEGRAUS_DIA;
    st.feitos = 0;
    st.t0 = st.t;
    direcoes(st.k);
    medida.trocas++;
  }

  /** Os passes do quadro (depois de medidas.inicio: entram em R.stats). */
  function passes(renderer, medidas) {
    const CA = ctx.campoAlturas;
    const amb = ctx.ambiente;
    if (!suporta || !CA?.textura || !amb) {
      u.gCampoLigado.value = 0;
      return;
    }
    if (CA.N !== N) criarAlvos(CA.N);
    const U = mat.uniforms;
    U.uAlturas.value = CA.textura;
    U.uN.value = N;
    U.uPassoM.value = CA.passo;
    U.uTam.value = CA.tam;
    // retângulos do campo de alturas que mudaram (e as grades dos prédios da sombra longa com eles)
    const rets = CA.retangulos.splice(0);
    const topos = atualizarAltos(CA, rets);
    const chave = amb.sol?.chave === 'lua' ? 'lua' : 'sol';
    const { k, t } = degrauDaHora(amb.hora);
    st.t = t;
    if (!st.valido || versaoCampo < 0) {
      st.k = k;
      st.chave = chave;
      refazerTudo(medidas);
      rets.length = 0;
    } else {
      let cheio = false; // já houve um passe do mapa inteiro neste quadro
      if (chave !== st.chave) {
        // a luz chave trocou (crepúsculo): refaz em ladrilhos, sem pico
        st.chave = chave;
        st.k = k;
        direcoes(k);
        st.refazer = 0;
        st.feitos = 0;
      }
      const dk = (k - st.k + DEGRAUS_DIA) % DEGRAUS_DIA;
      if (dk === 1 && st.refazer >= 0) {
        // no meio de um refazer em fatias: segue no degrau novo (os ladrilhos já feitos ficam um degrau atrás e se
        // acertam nas trocas seguintes; recomeçar do zero nunca terminava com quadros lentos em 4x)
        st.k = k;
        direcoes(k);
      } else if (dk === 1) {
        // o sol passou ao degrau seguinte: termina o campo seguinte (se atrasou) e troca
        if (st.feitos < TOTAL) medida.atrasos++;
        while (st.feitos < TOTAL) ladrilhoSeguinte(medidas);
        trocar();
      } else if (dk !== 0) {
        // salto (hora forçada, cena, carga): tudo de novo, agora
        st.k = k;
        refazerTudo(medidas);
        cheio = true;
      }
      // os retângulos que mudaram, com a faixa da sombra deles (os vizinhos juntos, os distantes separados): até o
      // alcance de longe quando há um topo alto neles, antes ou depois da mudança (a sombra velha também sai)
      const afetados = [];
      const base = ctx.sim?.espelho?.mapa?.nivelMar ?? 0;
      rets.forEach((ret, n) => {
        const alc = alcanceDoTopo(topos[n] - base, st.dirs);
        juntarRet(afetados, retanguloAfetado(ret, st.dirs, CA.passo, N, alc));
      });
      for (const a of afetados) {
        passe(alvos[st.atual], a, 0, st.dirs[0], st.dirs[1], null, medidas);
        if (st.feitos) passe(alvos[1 - st.atual], a, 0, st.dirs[1], st.dirs[2], null, medidas);
        medida.retangulos++;
      }
      if (st.refazer >= 0) {
        passe(alvos[st.atual], ladrilho(st.refazer), 0, st.dirs[0], st.dirs[1], null, medidas);
        if (++st.refazer >= TOTAL) {
          st.refazer = -1;
          st.t0 = st.t;
        }
      } else if (st.feitos < TOTAL) {
        const meta = metaLadrilhos(t, st.t0);
        const lim = cheio ? 1 : LADRILHOS_MAX;
        let n = 0;
        do {
          ladrilhoSeguinte(medidas);
          n++;
        } while (st.feitos < meta && n < lim);
        medida.maxQuadro = Math.max(medida.maxQuadro, n);
      }
    }
    versaoCampo = CA.versao;
    u.gCampoMapa.value = alvos[st.atual].texture;
    u.gCampoParams.value.set(CA.ox, CA.oz, 1 / CA.tam, CA.passo);
    u.gCampoT.value = st.refazer >= 0 ? 0 : t;
    u.gCampoVies.value.set(0.4 + 0.05 * CA.passo, 0.8 + 0.06 * CA.passo);
    u.gCampoLigado.value = 1;
  }

  ctx.quadro?.antes?.add(passes);
  // ?sombra=longe: sem a sombra de perto, para ver só a de longe (conferência)
  const soLonge = typeof location !== 'undefined' && new URLSearchParams(location.search).get('sombra') === 'longe';
  return {
    quadro() {
      if (soLonge && ctx.sombra) ctx.sombra.ligada = false;
    },
    nome: 'sombraLonge',
    /** Estado para as cenas e os testes. */
    get estado() {
      return { ...st, N, suporta, medida: { ...medida } };
    },
    /** Lê o campo em uso na célula (i, j) (conferência): [R, G, B, A]. */
    ler(i, j) {
      if (!alvos) return null;
      const b = new Uint16Array(4);
      r.readRenderTargetPixels(alvos[st.atual], i, j, 1, 1, b);
      return Array.from(b, (h) => THREE.DataUtils.fromHalfFloat(h));
    },
    /** Refaz o campo inteiro no próximo quadro (cenas). */
    refazer() {
      st.valido = false;
    },
    /** As grades dos prédios da sombra longa (conferência e testes no navegador). */
    get altos() {
      return altos;
    },
    /**
     * A sombra da célula (i, j) pela conta da CPU, nos dois degraus do campo em uso: [R, G] (conferência contra
     * ler(i, j), que lê a GPU).
     */
    conferir(i, j) {
      const cp = ctx.campoAlturas?.campo;
      if (!cp || !st.valido) return null;
      const longe = altos ? { altos } : null;
      return [alturaDaSombra(cp, i, j, st.dirs[0], Infinity, longe), alturaDaSombra(cp, i, j, st.dirs[1], Infinity, longe)];
    },
    /**
     * Mede (bancada e conferência): desenha o ladrilho i do campo seguinte, no modo dado, com os mesmos degraus e
     * a mesma entrada do ladrilho de verdade (o resultado é o mesmo; nada se perde). semLonge: sem a marcha de longe
     * (o custo dela é a diferença; o ladrilho volta a sair com ela no passo seguinte do sol).
     */
    ensaiar(i = 0, modo = 1, { semLonge = false } = {}) {
      if (!alvos || !st.valido) return false;
      st.semLonge = semLonge;
      try {
        passe(alvos[1 - st.atual], ladrilho(i % TOTAL), modo, st.dirs[1], st.dirs[2], alvos[st.atual], null);
      } finally {
        st.semLonge = false;
      }
      if (semLonge) st.feitos = Math.min(st.feitos, i % TOTAL); // refaz este e os seguintes com a marcha de longe
      return true;
    },
    descartar() {
      ctx.quadro?.antes?.delete(passes);
      texAltos?.dispose();
      texSaltos?.dispose();
      for (const a of alvos ?? []) a.dispose();
      mat.dispose();
      g.dispose();
      u.gCampoLigado.value = 0;
    },
  };
}

export function registrar(api) {
  api.registrarDominio('sombraLonge', criarDominio);
}
