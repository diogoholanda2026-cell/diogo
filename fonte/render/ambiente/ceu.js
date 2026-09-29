// Céu (D9, desenho do render 2.1 e 2.2): modelo de Preetham (o do Sky do three r186, com as nuvens 2D dele) numa
// unidade só com a luz do jogo, mais o crepúsculo, a noite, a lua, as estrelas e o brilho da cidade. Serve a três
// coisas com a MESMA conta: o fundo (no Ultra e no Alta direto por pixel; no PC, no Média e no Leve lido de um cubo
// assado uma fatia por quadro, em duplo buffer), o cubo de onde sai a luz do ambiente (ibl.js) e as cores que a luz
// do sol, a neblina e a exposição usam (esta conta em JS, igual à do GLSL de shaders/ceu.glsl.js). O fundo vai na
// cena, depois dos opacos e no plano distante (PC2): o céu só custa onde ele aparece.
//
// Unidade: a radiância do Preetham vezes K_CEU, escolhido para que, com o sol a 45 graus, a luz no chão (sol mais céu,
// na horizontal) valha pi: um chão branco lambertiano fica com radiância 1 e um de albedo 0,18 com 0,18. A luz do sol
// sai da mesma extinção do modelo (K_SOL calibrado para o céu dar de 18% a 25% da luz no chão ao meio da manhã, como
// num céu tropical limpo). Assim o céu, o sol, a neblina e a exposição concordam sem tinta.
//
// O domínio 'ceu' (troca o substituto da depuração) é o maestro do ambiente: a cada quadro calcula os astros, o
// estado do céu, a luz do sol ou da lua, a exposição, a neblina, as nuvens e a luz do ambiente, e publica ctx.ambiente
// para o quadro (motor/quadro.js) desenhar o fundo e compor.
import * as THREE from 'three';
import { astros, nascerEPor } from './astro.js';
import { Sol } from './sol.js';
import { Ibl } from './ibl.js';
import { Exposicao } from './exposicao.js';
import { Neblina, umidadeManha } from './neblina.js';
import { Nuvens } from './nuvens.js';
import { CEU_VERTICE, fragmentoCeu } from '../materiais/shaders/ceu.glsl.js';
import { CAMADA_LONGE } from '../motor/faixas.js';

// ------------------------------------------------------------------------------------------------ modelo (sem three)

/** Escala do Preetham para a unidade do jogo (E horizontal = pi com o sol a 45 graus). */
export const K_CEU = 0.132;
/** Luz direta do sol pela intensidade do Preetham (sunE vezes a extinção), na unidade do Preetham. */
export const K_SOL = 0.079;

const RAYLEIGH_TOTAL = [5.804542996261093e-6, 1.3562911419845635e-5, 3.0265902468824876e-5];
const MIE_CONST = [1.8399918514433978e14, 2.7798023919660528e14, 4.0790479543861094e14];
const CORTE = 1.6110731556870734;
const INCLINACAO = 1.5;
const EE = 1000;
const LUMA = [0.2126, 0.7152, 0.0722];

// termos que o Preetham não tem (mesmos números no GLSL): crepúsculo, noite, cidade e lua
export const CREPUSCULO = Object.freeze({
  zenite: [0.0028, 0.0052, 0.0135], // hora azul no alto
  faixa: [0.3, 0.12, 0.04], // faixa quente no horizonte do lado do sol
  venus: [0.02, 0.015, 0.024], // cinturão de Vênus do lado oposto
  queda: 16, // por radiano abaixo do horizonte
});
export const NOITE = Object.freeze({ zenite: [0.0019, 0.0026, 0.0046], horizonte: 1.8 });
export const LUA = Object.freeze({ cor: [0.74, 0.82, 1.0], irradiancia: 0.05, ceu: [0.0013, 0.002, 0.0036] });
/** Brilho da cidade no horizonte (radiância com o brilho 1, de noite): o laranja do sódio refletido no ar. */
export const CIDADE = Object.freeze([0.02, 0.0105, 0.0042]);

/**
 * Saturação da LUZ do céu (a luz do ambiente e o chão refletido; o fundo do céu fica como está): o Preetham integrado
 * no hemisfério dá uma luz de céu com o azul 6 vezes o vermelho, bem mais azul que a de um céu tropical limpo medido
 * (de 1,6 a 2 vezes), e deixava a sombra e as paredes à sombra azuladas. Com 0,4 a razão cai para perto de 2.
 */
export const SAT_LUZ_CEU = 0.4;

/** Dia do ano das cenas fixas (?cena=, sem ?dia=): o equinócio de março, com o pôr do sol perto das 18h10. */
export const DIA_CENAS = 80;

/** Amostras do anel do horizonte (azimute a partir do sol: pi · (i / 11)²). */
export const ANEL = 12;

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const suave = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const luma = (c) => LUMA[0] * c[0] + LUMA[1] * c[1] + LUMA[2] * c[2];

/** A cor com a saturação k em volta da luminância (mesma conta do GLSL do céu no modo da luz do ambiente). */
export function saturar(c, k, alvo = [0, 0, 0]) {
  const l = luma(c);
  for (let i = 0; i < 3; i++) alvo[i] = l + k * (c[i] - l);
  return alvo;
}

/** Intensidade do sol do Preetham pelo cosseno do ângulo zenital (a "sombra da Terra" abaixo do horizonte). */
export function intensidadeSol(cosZ) {
  const c = clamp(cosZ, -1, 1);
  return EE * Math.max(0, 1 - Math.exp(-((CORTE - Math.acos(c)) / INCLINACAO)));
}

/**
 * Parâmetros do ar por clima e sol baixo: céu tropical limpo com turbidez de 2,6 a 3,4 (mais no fim de tarde e com
 * nuvens), Rayleigh um pouco acima do padrão (azul mais fundo no alto).
 */
export function parametrosAr(elevSol, clima = {}) {
  const nuv = clamp(clima.nuvens ?? 0.3, 0, 1);
  const baixo = 1 - suave(0.1, 0.6, elevSol);
  return { turbidez: 2.7 + 0.4 * baixo + 0.4 * nuv, rayleigh: 1.05, mie: 0.005, mieG: 0.8 };
}

/**
 * Prepara o modelo para uma direção do sol (para o sol, unitária) e os parâmetros do ar.
 * @returns {object} P, usado por radiancia(), extincao() e irradianciaSol()
 */
export function prepararCeu(solDir, ar, extras = {}) {
  const betaR = RAYLEIGH_TOTAL.map((v) => v * ar.rayleigh);
  const c = 0.2 * ar.turbidez * 10e-18;
  const betaM = MIE_CONST.map((k) => 0.434 * c * k * ar.mie);
  return {
    sol: [solDir[0], solDir[1], solDir[2]],
    elev: Math.asin(clamp(solDir[1], -1, 1)),
    solE: intensidadeSol(solDir[1]),
    betaR,
    betaM,
    g: ar.mieG,
    lua: extras.lua ?? null, // { dir, iluminada }
    cidade: extras.cidade ?? [0, 0, 0],
  };
}

/** Extinção do Preetham (Fex) na direção d. */
export function extincao(d, P, alvo = [0, 0, 0]) {
  const za = Math.acos(Math.max(0, d[1]));
  const inv = 1 / (Math.cos(za) + 0.15 * Math.pow(93.885 - (za * 180) / Math.PI, -1.253));
  for (let i = 0; i < 3; i++) alvo[i] = Math.exp(-(P.betaR[i] * 8400 * inv + P.betaM[i] * 1250 * inv));
  return alvo;
}

const _fex = [0, 0, 0];

/**
 * Radiância do céu na direção d (unitária), sem discos, estrelas nem nuvens: Preetham mais crepúsculo, noite, luz
 * da lua no ar e brilho da cidade. Para d abaixo do horizonte vale a do horizonte (o fundo e a neblina se encontram).
 */
export function radiancia(d0, P, alvo = [0, 0, 0]) {
  const d = d0[1] < 0.001 ? [d0[0], 0.001, d0[2]] : d0;
  const n = Math.hypot(d[0], d[1], d[2]);
  const dx = d[0] / n;
  const dy = d[1] / n;
  const dz = d[2] / n;
  const dd = [dx, dy, dz];
  const F = extincao(dd, P, _fex);
  const ct = dx * P.sol[0] + dy * P.sol[1] + dz * P.sol[2];
  const rp = (3 / (16 * Math.PI)) * (1 + (ct * 0.5 + 0.5) ** 2);
  const g = P.g;
  const mp = (1 / (4 * Math.PI)) * ((1 - g * g) / Math.pow(1 - 2 * g * ct + g * g, 1.5));
  const k = clamp((1 - P.sol[1]) ** 5, 0, 1);
  const amb = [0, 0.0003, 0.00075];
  for (let i = 0; i < 3; i++) {
    const r = (P.betaR[i] * rp + P.betaM[i] * mp) / (P.betaR[i] + P.betaM[i]);
    let lin = Math.pow(P.solE * r * (1 - F[i]), 1.5);
    lin *= 1 + (Math.pow(P.solE * r * F[i], 0.5) - 1) * k;
    alvo[i] = K_CEU * ((lin + 0.1 * F[i]) * 0.04 + amb[i]);
  }
  somarCrepusculoNoite(dd, P, alvo);
  return alvo;
}

/** Soma à radiância os termos do crepúsculo, da noite, da lua no ar e da cidade (mesma conta do GLSL). */
export function somarCrepusculoNoite(d, P, alvo) {
  const e = P.elev;
  const C = CREPUSCULO;
  // crepúsculo: cai com o sol abaixo do horizonte e some com o sol alto (o Preetham assume)
  const kc = Math.exp(Math.min(e, 0) * C.queda) * (1 - suave(-0.04, 0.14, e));
  const hs = Math.hypot(P.sol[0], P.sol[2]) || 1;
  const hd = Math.hypot(d[0], d[2]) || 1;
  const az = (d[0] * P.sol[0] + d[2] * P.sol[2]) / (hs * hd); // cosseno do azimute até o sol
  const y = Math.max(d[1], 0);
  const faixa = Math.exp(-y * 9) * Math.max(0, az) ** 2;
  const venus = Math.exp(-y * 5) * Math.max(0, -az) ** 1.5;
  const alto = 0.55 + 0.45 * y;
  // noite: fundo azul escuro, mais claro no horizonte; lua no ar; cidade no horizonte
  const noite = 1 - suave(-0.2, -0.02, e);
  const hz = 1 + NOITE.horizonte * Math.exp(-y * 5);
  const luaAr = P.lua ? P.lua.iluminada * suave(-0.05, 0.3, P.lua.dir[1]) : 0;
  const cid = Math.exp(-y * 8);
  for (let i = 0; i < 3; i++) {
    alvo[i] += kc * (C.zenite[i] * alto + C.faixa[i] * faixa + C.venus[i] * venus);
    alvo[i] += noite * (NOITE.zenite[i] * hz + LUA.ceu[i] * luaAr * hz);
    alvo[i] += P.cidade[i] * cid;
  }
  return alvo;
}

/** Irradiância do sol (normal ao raio), por canal, na unidade do jogo. */
export function irradianciaSol(P, alvo = [0, 0, 0]) {
  const F = extincao(P.sol, P, _fex);
  const fora = suave(-0.035, 0.02, P.elev); // o disco sai do horizonte
  for (let i = 0; i < 3; i++) alvo[i] = K_CEU * K_SOL * P.solE * F[i] * fora;
  return alvo;
}

// direções da quadratura do hemisfério (cosseno-ponderada): 6 anéis x 12 azimutes
const QUAD = (() => {
  const l = [];
  const aneis = 6;
  const az = 12;
  for (let a = 0; a < aneis; a++) {
    const t0 = (a / aneis) * (Math.PI / 2);
    const t1 = ((a + 1) / aneis) * (Math.PI / 2);
    const th = (t0 + t1) / 2;
    // peso: integral de cos(theta) sen(theta) no anel, dividida pelos azimutes
    const w = ((Math.sin(t1) ** 2 - Math.sin(t0) ** 2) / 2) * ((2 * Math.PI) / az);
    for (let b = 0; b < az; b++) {
      const ph = ((b + 0.5) / az) * 2 * Math.PI;
      l.push({ d: [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)], w });
    }
  }
  return l;
})();

/** Irradiância do céu no chão (plano horizontal), por canal: integral da radiância vezes o cosseno. */
export function irradianciaCeu(P, alvo = [0, 0, 0]) {
  alvo[0] = alvo[1] = alvo[2] = 0;
  const L = [0, 0, 0];
  for (const { d, w } of QUAD) {
    radiancia(d, P, L);
    for (let i = 0; i < 3; i++) alvo[i] += L[i] * w;
  }
  return alvo;
}

/**
 * Estado completo do céu para um instante: o que a luz, a neblina, a exposição e os uniformes do céu usam.
 * @param {{ sol: { dir, elevacao }, lua: { dir, elevacao, iluminada, fase } }} ast  saída de astros()
 * @param {object} clima  { nuvens, vento }
 * @param {number} brilhoCidade  0 a 1 (o R1b mede pelo mapa de luz da rua; 0,6 é uma cidade grande acesa)
 */
export function estadoCeu(ast, clima = {}, brilhoCidade = 0.6, alvo = {}) {
  const ar = parametrosAr(ast.sol.elevacao, clima);
  const noite = 1 - suave(-0.2, -0.02, ast.sol.elevacao);
  const kCid = brilhoCidade * noite;
  const cidade = CIDADE.map((c) => c * kCid);
  const P = prepararCeu(ast.sol.dir, ar, { lua: ast.lua, cidade });
  alvo.P = P;
  alvo.ar = ar;
  alvo.cidade = cidade;
  alvo.noite = noite;
  alvo.solIrr = irradianciaSol(P, alvo.solIrr);
  const luaAlta = suave(-0.03, 0.15, ast.lua.dir[1]);
  const kLua = LUA.irradiancia * ast.lua.iluminada * luaAlta * noite;
  alvo.luaIrr = LUA.cor.map((c) => c * kLua);
  alvo.ceuIrr = irradianciaCeu(P, alvo.ceuIrr);
  alvo.ceuIrrLuz = saturar(alvo.ceuIrr, SAT_LUZ_CEU, alvo.ceuIrrLuz);
  // anel do horizonte (12 azimutes contados a partir do sol, mais densos perto dele) e o alto: a neblina e o fundo
  // leem a mesma tabela, então o chão ao longe e o céu se encontram na mesma cor
  const hs = Math.hypot(ast.sol.dir[0], ast.sol.dir[2]);
  const sx = hs > 1e-6 ? ast.sol.dir[0] / hs : 1;
  const sz = hs > 1e-6 ? ast.sol.dir[2] / hs : 0;
  alvo.anel ??= new Float32Array(3 * ANEL);
  const L = [0, 0, 0];
  for (let i = 0; i < ANEL; i++) {
    const phi = Math.PI * (i / (ANEL - 1)) ** 2;
    const c = Math.cos(phi);
    const sn = Math.sin(phi);
    radiancia([sx * c - sz * sn, 0.02, sz * c + sx * sn], P, L);
    alvo.anel[3 * i] = L[0];
    alvo.anel[3 * i + 1] = L[1];
    alvo.anel[3 * i + 2] = L[2];
  }
  alvo.horizLado = [alvo.anel[24], alvo.anel[25], alvo.anel[26]];
  alvo.zenite = radiancia([0, 1, 0], P, alvo.zenite);
  // luz no chão horizontal (a exposição segue esta medida)
  const solH = Math.max(0, ast.sol.dir[1]);
  const luaH = Math.max(0, ast.lua.dir[1]);
  alvo.eChao = LUMA.reduce((s, k, i) => s + k * (alvo.solIrr[i] * solH + alvo.luaIrr[i] * luaH + alvo.ceuIrr[i]), 0);
  alvo.solH = solH;
  return alvo;
}

/** A cor da neblina na direção d (a mesma conta de gNeblinaCorVista, shaders/neblina.glsl.js). */
export function corVista(d, est, alvo = [0, 0, 0]) {
  const s = est.P.sol;
  const hs = Math.hypot(s[0], s[2]);
  const sx = hs > 1e-6 ? s[0] / hs : 1;
  const sz = hs > 1e-6 ? s[2] / hs : 0;
  const hd = Math.hypot(d[0], d[2]) || 1;
  const phi = Math.acos(clamp((d[0] * sx + d[2] * sz) / hd, -1, 1));
  const t = Math.sqrt(phi / Math.PI) * (ANEL - 1);
  const i = Math.min(Math.floor(t), ANEL - 2);
  const f = t - i;
  const z = 0.55 * suave(0.12, 1, d[1]);
  for (let k = 0; k < 3; k++) {
    const h = est.anel[3 * i + k] + (est.anel[3 * (i + 1) + k] - est.anel[3 * i + k]) * f;
    alvo[k] = h + (est.zenite[k] - h) * z;
  }
  return alvo;
}

// ------------------------------------------------------------------------------------------------ material do céu

const CEU_FRAGMENTO = fragmentoCeu({ K_CEU, CREPUSCULO, NOITE, LUA, SAT_LUZ_CEU });

/**
 * Material do céu (ShaderMaterial de tela cheia): o mesmo programa desenha o fundo, as faces do cubo e o cubo da luz
 * do ambiente, pelo modo. Direção por pixel = frente + x · direita + y · cima (a câmera da vista ou a da face).
 * @param {'fundo' | 'cubo' | 'ibl'} modo  fundo: com discos do sol e da lua e estrelas; cubo: sem eles (o fundo do
 *   Média lê o cubo e põe os discos por cima); ibl: sem discos e com o chão refletido abaixo do horizonte
 */
export function criarMaterialCeu(modo = 'fundo', { nuvens = true, lerCubo = false } = {}) {
  const defines = {};
  if (modo === 'fundo') defines.CEU_DISCOS = '';
  if (modo === 'ibl') defines.CEU_IBL = '';
  if (nuvens) defines.CEU_NUVENS = '';
  if (lerCubo) defines.CEU_LER_CUBO = '';
  return new THREE.ShaderMaterial({
    name: `ceu-${modo}${lerCubo ? '-cubo' : ''}`,
    defines,
    uniforms: {
      uFrente: { value: new THREE.Vector3(0, 0, -1) },
      uDireita: { value: new THREE.Vector3(1, 0, 0) },
      uCima: { value: new THREE.Vector3(0, 1, 0) },
      uSolDir: { value: new THREE.Vector3(0, 1, 0) },
      uSolIrr: { value: new THREE.Vector3() },
      uBetaR: { value: new THREE.Vector3() },
      uBetaM: { value: new THREE.Vector3() },
      uSolE: { value: 0 },
      uMieG: { value: 0.8 },
      uElev: { value: 0 },
      uLuaDir: { value: new THREE.Vector3(0, -1, 0) },
      uLuaIlum: { value: 0 },
      uLuaIrr: { value: new THREE.Vector3() },
      uCidade: { value: new THREE.Vector3() },
      uNoite: { value: 0 },
      uEstrelas: { value: 0 },
      uGiro: { value: new THREE.Matrix3() },
      uNuvem: { value: new THREE.Vector4(0.3, 0.4, 0.00018, 0.5) }, // cobertura, densidade, escala, elevação
      uNuvemPasso: { value: new THREE.Vector2() },
      uChao: { value: new THREE.Vector3() },
      uCubo: { value: null },
      uDisco: { value: 60 },
      uFundoZ: { value: 0 },
      ...gNeblinaUniformesCeu(),
    },
    vertexShader: CEU_VERTICE,
    fragmentShader: CEU_FRAGMENTO,
    // o fundo vai na cena no plano distante e só passa onde nada foi desenhado; as faces e a luz do ambiente não testam
    depthTest: modo === 'fundo',
    depthWrite: false,
  });
}

/** Os uniformes da neblina que o céu também lê (a cor do horizonte é uma só, D9 "horizonte sem costura"). */
function gNeblinaUniformesCeu() {
  return {
    gNeblinaAnel: { value: Array.from({ length: ANEL }, () => new THREE.Vector3()) },
    gNeblinaZenite: { value: new THREE.Vector3() },
    gNeblinaSolDir: { value: new THREE.Vector3(0, 1, 0) },
  };
}

/** Escreve o estado do céu (estadoCeu) nos uniformes de um material do céu. */
export function aplicarEstado(mat, est, ast, extra = {}) {
  const u = mat.uniforms;
  const P = est.P;
  u.uSolDir.value.fromArray(P.sol);
  u.uSolIrr.value.fromArray(est.solIrr);
  u.uBetaR.value.fromArray(P.betaR);
  u.uBetaM.value.fromArray(P.betaM);
  u.uSolE.value = P.solE;
  u.uMieG.value = P.g;
  u.uElev.value = P.elev;
  u.uLuaDir.value.fromArray(ast.lua.dir);
  u.uLuaIlum.value = ast.lua.iluminada;
  u.uLuaIrr.value.fromArray(est.luaIrr);
  u.uCidade.value.fromArray(est.cidade);
  u.uNoite.value = est.noite;
  for (let i = 0; i < ANEL; i++) u.gNeblinaAnel.value[i].fromArray(est.anel, 3 * i);
  u.gNeblinaZenite.value.fromArray(est.zenite);
  u.gNeblinaSolDir.value.fromArray(P.sol);
  // chão refletido (luz do ambiente de baixo): albedo médio de cidade e mata, 0,18, sob o sol e a luz do céu
  const a = 0.18 / Math.PI;
  const sh = est.solH;
  const ceu = est.ceuIrrLuz ?? est.ceuIrr;
  u.uChao.value.set(
    a * (est.solIrr[0] * sh + est.luaIrr[0] * 0.3 + ceu[0]) * 1.05,
    a * (est.solIrr[1] * sh + est.luaIrr[1] * 0.3 + ceu[1]),
    a * (est.solIrr[2] * sh + est.luaIrr[2] * 0.3 + ceu[2]) * 0.85,
  );
  if (extra.nuvem) u.uNuvem.value.copy(extra.nuvem);
  if (extra.nuvemPasso) u.uNuvemPasso.value.copy(extra.nuvemPasso);
  if (extra.giro) u.uGiro.value.copy(extra.giro);
  if (Number.isFinite(extra.estrelas)) u.uEstrelas.value = extra.estrelas;
}

// ------------------------------------------------------------------------------------------------ passes do céu

const _m = new THREE.Matrix4();
const FACES = [
  { alvo: [1, 0, 0], cima: [0, 1, 0] },
  { alvo: [-1, 0, 0], cima: [0, 1, 0] },
  { alvo: [0, 1, 0], cima: [0, 0, -1] },
  { alvo: [0, -1, 0], cima: [0, 0, 1] },
  { alvo: [0, 0, 1], cima: [0, 1, 0] },
  { alvo: [0, 0, -1], cima: [0, 1, 0] },
];

/**
 * Frente, direita e cima (com a tangente do meio campo) das 6 faces na convenção do CubeCamera do three: ele usa
 * campo de -90 graus (imagem espelhada nos dois eixos), então direita e cima entram com o sinal trocado. Assim o
 * cubo lido com a direção do mundo (e o PMREM feito dele) fica igual ao do three.
 */
const EIXOS_FACES = FACES.map(({ alvo, cima }) => {
  const c = new THREE.PerspectiveCamera(90, 1, 0.1, 10);
  c.up.fromArray(cima);
  c.lookAt(...alvo);
  c.updateMatrixWorld(true);
  const e = c.matrixWorld.elements;
  return {
    direita: new THREE.Vector3(-e[0], -e[1], -e[2]),
    cima: new THREE.Vector3(-e[4], -e[5], -e[6]),
    frente: new THREE.Vector3(-e[8], -e[9], -e[10]),
  };
});

/** Triângulo de tela cheia (um só para todos os passes do céu). */
export function triangulo() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  return g;
}

/**
 * Faixa de linhas [y0, y0 + h) da fatia k de n de uma face de lado `lado` (as fatias cobrem a face sem sobra nem
 * sobreposição).
 * @example faixaDaFatia(512, 1, 2) // { y0: 256, h: 256 }
 */
export function faixaDaFatia(lado, k, n) {
  const y0 = Math.floor((lado * k) / n);
  return { y0, h: Math.floor((lado * (k + 1)) / n) - y0 };
}

/**
 * Desenha as faces [f0, f1) do cubo com o material (modo cubo ou ibl); com fatia = [k, n], só a fatia k de n de cada
 * face (uma faixa de linhas, pelo recorte do alvo).
 * @param {THREE.WebGLCubeRenderTarget} rt
 */
export function desenharFaces(renderer, rt, mat, cena, cam, f0 = 0, f1 = 6, fatia = null) {
  const u = mat.uniforms;
  const antes = renderer.getRenderTarget();
  const faceAntes = renderer.getActiveCubeFace();
  const mipAntes = renderer.getActiveMipmapLevel();
  cena.children[0].material = mat;
  if (fatia) {
    const { y0, h } = faixaDaFatia(rt.width, fatia[0], fatia[1]);
    rt.scissor.set(0, y0, rt.width, h);
    rt.scissorTest = true;
  }
  try {
    for (let f = f0; f < f1; f++) {
      const e = EIXOS_FACES[f];
      u.uFrente.value.copy(e.frente);
      u.uDireita.value.copy(e.direita);
      u.uCima.value.copy(e.cima);
      renderer.setRenderTarget(rt, f);
      renderer.render(cena, cam);
    }
  } finally {
    if (fatia) {
      rt.scissorTest = false;
      rt.scissor.set(0, 0, rt.width, rt.height);
    }
    renderer.setRenderTarget(antes, faceAntes, mipAntes);
  }
}

/** Frente, direita e cima (vezes as tangentes do campo) da câmera da vista. */
export function eixosDaCamera(cam, u) {
  cam.updateMatrixWorld();
  const e = cam.matrixWorld.elements;
  const ty = Math.tan((cam.fov * Math.PI) / 360) / (cam.zoom || 1);
  const tx = ty * cam.aspect;
  u.uDireita.value.set(e[0], e[1], e[2]).multiplyScalar(tx);
  u.uCima.value.set(e[4], e[5], e[6]).multiplyScalar(ty);
  u.uFrente.value.set(-e[8], -e[9], -e[10]);
}

// ------------------------------------------------------------------------------------------------ o céu desenhado

/**
 * O céu da vista: direto (Ultra e Alta) ou lido de um cubo assado uma fatia por quadro, em duplo buffer (PC, Média e
 * Leve, D9). O cubo leva o céu inteiro com as nuvens; o fundo lê o cubo e desenha por cima, por pixel e nítidos, só os
 * discos do sol e da lua (com a nuvem na frente) e as estrelas.
 */
export class Ceu {
  constructor(ctx) {
    this.ctx = ctx;
    this.cena = new THREE.Scene();
    this.malha = new THREE.Mesh(triangulo(), null);
    this.malha.frustumCulled = false;
    this.cena.add(this.malha);
    this.camTela = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.giro = new THREE.Matrix3();
    this.nuvem = new THREE.Vector4(0.3, 0.4, 0.00018, 0.5);
    this.nuvemPasso = new THREE.Vector2();
    this.estrelas = 0;
    this.naCena = criarFundoNaCena(this, !!ctx.semClip);
    this.configurar(ctx.perfil);
  }

  /** Troca o modo pelo perfil: direto (Ultra, Alta); cubo de 512 em meias faces (PC), de 256 (Média), de 128 (Leve). */
  configurar(perfil) {
    const c = perfil.ceu ?? { modo: 'direto', cubo: 0, nuvens: true };
    const f = this._cfg;
    if (f && f.modo === c.modo && f.cubo === c.cubo && f.nuvens === c.nuvens && f.fatias === (c.fatias ?? 1)) return;
    this.descartarAlvos();
    this._cfg = { ...c, fatias: c.fatias ?? 1 };
    this.direto = c.modo === 'direto';
    this.fundo = criarMaterialCeu('fundo', { nuvens: c.nuvens, lerCubo: !this.direto });
    this.naCena.material = this.fundo;
    this.faces = this.direto ? null : criarMaterialCeu('cubo', { nuvens: c.nuvens });
    if (!this.direto) {
      const op = { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
      this.cubos = [new THREE.WebGLCubeRenderTarget(c.cubo, op), new THREE.WebGLCubeRenderTarget(c.cubo, op)];
      this.frente = 0; // o cubo que o fundo lê
      this.faceSeguinte = 0; // a próxima face do cubo de trás
      this.fatiaSeguinte = 0; // a próxima fatia dessa face
      this.cheio = false; // o da frente já tem as 6 faces
    }
  }

  /**
   * Um salto no estado do céu (a hora pulou, o brilho da cidade medido chegou): o cubo da frente sai inteiro no próximo
   * assar e o de trás recomeça, sem esperar os quadros das fatias (nem trocar para um cubo com faces de antes do salto).
   */
  refazer() {
    if (this.direto) return;
    this.cheio = false;
    this.faceSeguinte = 0;
    this.fatiaSeguinte = 0;
  }

  /** Fatias de face assadas por quadro no cubo de trás (6 x fatias quadros por cubo). */
  get fatias() {
    return this._cfg?.fatias ?? 1;
  }

  /** Estado do quadro nos materiais (e as nuvens, o giro das estrelas). */
  atualizar(est, ast) {
    const extra = { nuvem: this.nuvem, nuvemPasso: this.nuvemPasso, giro: this.giro, estrelas: this.estrelas };
    aplicarEstado(this.fundo, est, ast, extra);
    if (this.faces) aplicarEstado(this.faces, est, ast, extra);
  }

  /**
   * Passes antes da cena: uma fatia de face do cubo de trás por quadro; com as 6 faces prontas, troca. O primeiro
   * cubo sai inteiro.
   * @returns {number} faces desenhadas (a fração de uma face com as fatias)
   */
  assar(renderer, medidas) {
    if (this.direto) return 0;
    const faz = (f0, f1, alvo, fatia = null) => {
      const fn = () => desenharFaces(renderer, alvo, this.faces, this.cena, this.camTela, f0, f1, fatia);
      if (medidas) medidas.passe(fn);
      else fn();
    };
    if (!this.cheio) {
      faz(0, 6, this.cubos[this.frente]);
      this.cheio = true;
      return 6;
    }
    const n = this.fatias;
    const tras = this.cubos[1 - this.frente];
    faz(this.faceSeguinte, this.faceSeguinte + 1, tras, n > 1 ? [this.fatiaSeguinte, n] : null);
    if (++this.fatiaSeguinte >= n) {
      this.fatiaSeguinte = 0;
      if (++this.faceSeguinte === 6) {
        this.faceSeguinte = 0;
        this.frente = 1 - this.frente;
      }
    }
    return 1 / n;
  }

  /** Uniformes do fundo para uma câmera: os eixos, o cubo da frente e o plano distante da profundidade em uso. */
  prepararFundo(renderer, cam) {
    const u = this.fundo.uniforms;
    if (!cam.isPerspectiveCamera) {
      u.uFundoZ.value = 2; // fora do volume de recorte: uma vista ortográfica (sombra, campo de alturas) não tem céu
      return;
    }
    eixosDaCamera(cam, u);
    if (!this.direto) u.uCubo.value = this.cubos[this.frente].texture;
    u.uFundoZ.value = renderer.state?.buffers?.depth?.getReversed?.() ? 0 : 1;
  }

  /** Desenha o fundo no alvo atual (antes da cena; sem uso quando o fundo vai na cena). */
  desenharFundo(renderer, cam) {
    this.prepararFundo(renderer, cam);
    this.malha.material = this.fundo;
    renderer.render(this.cena, this.camTela);
  }

  descartarAlvos() {
    for (const c of this.cubos ?? []) c.dispose();
    this.cubos = null;
    this.fundo?.dispose();
    this.faces?.dispose();
  }

  descartar() {
    this.descartarAlvos();
    this.malha.geometry.dispose();
    this.naCena.removeFromParent();
    this.naCena.geometry.dispose();
  }
}

/** Ordem do fundo na cena: depois de todos os opacos (o terreno vai em 1), antes dos transparentes (outra lista). */
export const ORDEM_FUNDO = 1000;

/**
 * O fundo do céu como uma malha da cena (PC2): um triângulo de tela cheia no plano distante, desenhado depois dos
 * opacos com o teste de profundidade, então o céu só custa nos pixels em que ele aparece (na vista aberta, quase
 * nenhum). Com as duas faixas de profundidade (sem EXT_clip_control) vai só na de longe. O quadro passa a câmera
 * certa (onBeforeRender); o passe do cronômetro é o 'ceu'.
 */
function criarFundoNaCena(ceu, duasFaixas) {
  const m = new THREE.Mesh(triangulo(), null);
  m.name = 'ceu:fundo';
  m.frustumCulled = false;
  m.renderOrder = ORDEM_FUNDO;
  m.userData.familia = 'ceu';
  if (duasFaixas) {
    m.layers.set(CAMADA_LONGE);
    m.userData.faixa = 'longe';
  }
  m.onBeforeRender = (renderer, cena, cam) => ceu.prepararFundo(renderer, cam);
  return m;
}

// ------------------------------------------------------------------------------------------------ o ambiente (domínio)

const RAD = Math.PI / 180;

/** Giro do céu noturno: eixo do polo sul celeste (latitude) e a hora sideral aproximada pela hora do céu. */
function giroEstrelas(hora, diaDoAno, latitude, alvo) {
  const ang = ((hora / 24 + diaDoAno / 365) * 360 * RAD) % (2 * Math.PI);
  const lat = latitude * RAD;
  // polo celeste visível: ao sul (+z) a |lat| de altura
  const eixo = new THREE.Vector3(0, Math.sin(-lat), Math.cos(lat)).normalize();
  _m.makeRotationAxis(eixo, ang);
  return alvo.setFromMatrix4(_m);
}

/**
 * O ambiente inteiro de um quadro. ctx.ambiente = esta instância; o quadro chama antes(renderer, medidas) para os
 * passes do cubo e da luz do ambiente e desenharFundo(renderer, cam) antes da cena.
 */
export class Ambiente {
  constructor(ctx) {
    this.ctx = ctx;
    this.ast = { sol: undefined, lua: undefined, dia: 1 };
    this.est = {};
    this.brilhoCidade = 0.6;
    this._cidCubo = this.brilhoCidade; // o brilho da cidade do último cubo inteiro
    this._horaAnt = null;
    this.ceu = new Ceu(ctx);
    this.sol = new Sol(ctx);
    this.ibl = new Ibl(ctx, this);
    this.exposicao = new Exposicao();
    this.neblina = new Neblina(ctx);
    this.nuvens = new Nuvens(ctx);
    this.hora = 12;
    this.tAnt = 0;
    // dia do ano forçado: ?dia=, ou o das cenas fixas (?cena=), onde a hora das capturas (17h30 dourada) precisa do sol
    // de um dia conhecido; no jogo vale o da simulação (D9)
    const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
    const dia = qs?.has('dia') ? Number(qs.get('dia')) : qs?.has('cena') ? DIA_CENAS : null;
    this.diaForcado = Number.isFinite(dia) ? dia : null;
    this._tempo = {};
  }

  /** O tempo do céu: o do espelho, com o dia do ano forçado quando houver. */
  tempoCeu() {
    const t = this.ctx.sim?.espelho?.tempo;
    if (this.diaForcado === null) return t;
    return Object.assign(this._tempo, t, { diaDoAno: this.diaForcado });
  }

  /** Estado do céu numa hora (a luz do ambiente assa quadros-chave em outras horas). */
  estadoNaHora(hora, alvo = {}) {
    const esp = this.ctx.sim?.espelho;
    const tempo = this.tempoCeu();
    const ast = astros(hora, tempo, esp?.mapa);
    const est = estadoCeu(ast, tempo?.clima, this.brilhoCidade, alvo);
    return { ast, est };
  }

  /** Nascer e pôr do sol do dia do ano atual. */
  nascerEPor() {
    const esp = this.ctx.sim?.espelho;
    return nascerEPor(this.tempoCeu()?.diaDoAno ?? 0, esp?.mapa?.latitude ?? -23.5);
  }

  quadro(tMs) {
    const ctx = this.ctx;
    const esp = ctx.sim?.espelho;
    const hora = ctx.horaDoCeu();
    const dt = this.tAnt ? Math.min(0.25, Math.max(0, (tMs - this.tAnt) / 1000)) : 0;
    this.tAnt = tMs;
    this.hora = hora;
    const tempo = this.tempoCeu();
    astros(hora, tempo, esp?.mapa, this.ast);
    const clima = esp?.tempo?.clima ?? { nuvens: 0.3, vento: [3, 1] };
    estadoCeu(this.ast, clima, this.brilhoCidade, this.est);
    if (ctx.perfil !== this._perfil) {
      this._perfil = ctx.perfil;
      this.ceu.configurar(ctx.perfil);
      this.ibl.configurar(ctx.perfil);
      this.sol.configurar(ctx.perfil);
      this.nuvens.configurar(ctx.perfil);
    }
    // um salto (a hora pulou mais de 15 min num quadro, ou o brilho da cidade mudou 10% de noite, como quando o mapa de
    // luz da rua chega depois do primeiro cubo): o cubo do céu sai inteiro de novo
    const pulo = this._horaAnt !== null && Math.abs(((((hora - this._horaAnt + 36) % 24) + 24) % 24) - 12) > 0.25;
    this._horaAnt = hora;
    const cid = this.brilhoCidade;
    if (pulo || ((this.est.noite ?? 0) > 0.05 && Math.abs(cid - this._cidCubo) > 0.1 * Math.max(cid, this._cidCubo, 0.05))) {
      this.ceu.refazer();
      this._cidCubo = cid;
    }
    this.nuvens.atualizar(dt, clima, this.est, this.ceu);
    this.ceu.estrelas = this.est.noite * (1 - 0.6 * this.ast.lua.iluminada * Math.max(0, this.ast.lua.dir[1]));
    giroEstrelas(hora, tempo?.diaDoAno ?? 0, esp?.mapa?.latitude ?? -23.5, this.ceu.giro);
    this.ceu.atualizar(this.est, this.ast);
    this.sol.atualizar(this.ast, this.est);
    this.exposicao.atualizar(this.est, dt);
    this.neblina.atualizar(this.est, { umidade: umidadeManha(hora, this.nascerEPor().nascer), nuvens: clima.nuvens ?? 0.3 });
    this.ibl.atualizar(hora, this.est);
    ctx.sol.dia = this.ast.dia;
    // com uma cor de fundo na cena (a depuração), o céu sai
    this.ceu.naCena.visible = !ctx.cena.background;
  }

  /** Passes antes da cena (cubo do céu e luz do ambiente), medidos. */
  antes(renderer, medidas) {
    // uma fatia de quadro-chave da luz do ambiente toma o lugar da face do cubo do céu neste quadro
    const fatia = this.ibl.passes(renderer, medidas);
    if (!fatia || !this.ceu.cheio) this.ceu.assar(renderer, medidas);
  }

  desenharFundo(renderer, cam) {
    this.ceu.desenharFundo(renderer, cam);
  }

  /** O fundo vai na cena (depois dos opacos): o quadro não desenha o de tela cheia antes dela. */
  get fundoNaCena() {
    return !!this.ceu.naCena.parent;
  }

  /** Números do quadro para a composição (pos.js). */
  get composicao() {
    return { exposicao: this.exposicao.valor, limiarBloom: this.exposicao.limiarBloom };
  }

  descartar() {
    this.ceu.descartar();
    this.sol.descartar();
    this.ibl.descartar();
    this.nuvens.descartar();
    this.neblina.descartar();
  }
}

export function registrar(api) {
  api.registrarDominio('ceu', (ctx) => {
    const amb = new Ambiente(ctx);
    ctx.ambiente = amb;
    ctx.cena.background = null;
    ctx.cena.add(amb.ceu.naCena);
    return {
      nome: 'ceu',
      quadro: (tMs) => amb.quadro(tMs),
      descartar() {
        amb.descartar();
        if (ctx.ambiente === amb) ctx.ambiente = null;
      },
    };
  });
}
