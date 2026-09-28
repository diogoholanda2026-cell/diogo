// Sombra de longe e HAO pelo campo de alturas (desenho do render 2.5 e 2.6, D9): a partir da grade do campo de alturas
// da cidade (campoAlturas.js, R16F), um passe na GPU escreve o campo (RGBA16F sobre o mapa, 1024² no Média e no Leve,
// 2048² no Alta e no Ultra): R e G a altura da sombra em dois degraus seguidos do sol, B a visibilidade do céu no chão
// da vizinhança e A a cota desse chão (shaders/sombra.glsl.js, CAMPO_PASSE). Os materiais leem uma textura só.
//
// O sol anda em degraus de 3 graus de ângulo horário (0,2 h de céu). O campo em uso guarda os degraus k e k + 1 e a
// sombra mistura os dois pela fração da hora (gCampoT): ela anda sem salto. Enquanto isso o campo seguinte (k + 1 e
// k + 2) sai em 16 ladrilhos, um por quadro, copiando o que não muda; quando o sol passa ao degrau seguinte os dois
// trocam. Em 1x o sol anda 3 graus em 5 s (16 ladrilhos em ~5 s); em 4x, em 1,25 s. Um salto de hora (cena, hora
// forçada) refaz tudo de uma vez; a troca entre o sol e a lua refaz em ladrilhos (é no crepúsculo, sem luz). Quando
// o campo de alturas muda num retângulo (um prédio nasce), só o retângulo e a faixa da sombra dele contra o sol são
// refeitos, nos dois campos.
import * as THREE from 'three';
import { CAMPO_PASSE, MARCHA, distanciaDaMarcha, PASSO_NIVEL1 } from '../materiais/shaders/sombra.glsl.js';
import { posicaoSol, posicaoLua, mesAbsoluto } from './astro.js';

/** Degrau do sol em horas de céu (15 graus por hora: 0,2 h = 3 graus). */
export const DEGRAU_HORAS = 0.2;
export const DEGRAUS_DIA = Math.round(24 / DEGRAU_HORAS);
/** Ladrilhos por lado do campo (16 ao todo). */
export const LADO_LADRILHOS = 4;
/** Alcance da marcha da sombra (m). */
export const ALCANCE = distanciaDaMarcha(MARCHA.passos);
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
 * Altura da sombra na célula (i, j) pela mesma marcha do GLSL, sobre o campo da CPU (campoAlturas.js, Campo): o campo
 * bilinear no fim de cada passo e no meio dele e, nos passos longos, também a célula do nível 1 de cada amostra
 * (testes e conferência).
 */
export function alturaDaSombra(campo, i, j, dir) {
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
  }
  return s;
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
 * cai para longe da luz até o alcance da marcha (nas direções dadas).
 */
export function retanguloAfetado(r, dirs, passo, N) {
  const m = 9;
  let [i0, j0, i1, j1] = [r[0] - m, r[1] - m, r[2] + m, r[3] + m];
  const alc = ALCANCE / passo + 1;
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
      uDirA: { value: new THREE.Vector4() }, uDirB: { value: new THREE.Vector4() }, uModo: { value: 0 },
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
  const st = {
    atual: 0, // índice do campo em uso
    valido: false, // o campo em uso tem os dois degraus
    k: -1,
    chave: 'sol',
    t: 0,
    feitos: 0, // ladrilhos prontos do campo seguinte
    refazer: -1, // ladrilho do campo em uso sendo refeito em fatias (troca sol/lua), -1 nada
    dirs: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], // k, k + 1, k + 2
  };
  // atrasos: trocas em que o campo seguinte ainda não estava pronto (o resto dos ladrilhos saiu de uma vez)
  const medida = { passes: 0, ladrilhos: 0, completos: 0, trocas: 0, atrasos: 0, retangulos: 0, texeis: 0 };
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

  /** Refaz o campo em uso inteiro (e zera o seguinte). */
  function refazerTudo(medidas) {
    direcoes(st.k);
    passe(alvos[st.atual], [0, 0, N - 1, N - 1], 0, st.dirs[0], st.dirs[1], null, medidas);
    st.valido = true;
    st.feitos = 0;
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
    // retângulos do campo de alturas que mudaram
    const rets = CA.retangulos.splice(0);
    const chave = amb.sol?.chave === 'lua' ? 'lua' : 'sol';
    const { k, t } = degrauDaHora(amb.hora);
    if (!st.valido || versaoCampo < 0) {
      st.k = k;
      st.chave = chave;
      refazerTudo(medidas);
      rets.length = 0;
    } else {
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
        // no meio de um refazer em fatias: recomeça no degrau novo
        st.k = k;
        direcoes(k);
        st.refazer = 0;
      } else if (dk === 1) {
        // o sol passou ao degrau seguinte: termina o campo seguinte (se atrasou) e troca
        if (st.feitos < LADO_LADRILHOS * LADO_LADRILHOS) medida.atrasos++;
        while (st.feitos < LADO_LADRILHOS * LADO_LADRILHOS) ladrilhoSeguinte(medidas);
        trocar();
      } else if (dk !== 0) {
        // salto (hora forçada, cena, carga): tudo de novo, agora
        st.k = k;
        refazerTudo(medidas);
      }
      for (const ret of rets) {
        const a = retanguloAfetado(ret, st.dirs, CA.passo, N);
        passe(alvos[st.atual], a, 0, st.dirs[0], st.dirs[1], null, medidas);
        if (st.feitos) passe(alvos[1 - st.atual], a, 0, st.dirs[1], st.dirs[2], null, medidas);
        medida.retangulos++;
      }
      if (st.refazer >= 0) {
        passe(alvos[st.atual], ladrilho(st.refazer), 0, st.dirs[0], st.dirs[1], null, medidas);
        if (++st.refazer >= LADO_LADRILHOS * LADO_LADRILHOS) st.refazer = -1;
      } else if (st.feitos < LADO_LADRILHOS * LADO_LADRILHOS) ladrilhoSeguinte(medidas);
    }
    versaoCampo = CA.versao;
    st.t = t;
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
    descartar() {
      ctx.quadro?.antes?.delete(passes);
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
