// Registro dos ganchos GLSL comuns (D14, D43, D45): todo GLSL próprio que entra nos materiais do three passa por aqui,
// com nomes estáveis, para o porte ao WebGPU no M4 custar pouco. Publicados aqui, com os uniformes abaixo (nomes
// estáveis): 'sombra' (sombra própria em cascatas com PCF estável, a sombra das nuvens e, fora das cascatas, a de
// longe), 'neblina' (altura e perspectiva aérea com a cor do horizonte do céu), 'sombraLonge' e 'hao' (o campo de
// alturas da cidade: sombra de longe em degraus do sol e oclusão do céu entre prédios) e 'noite' (luz da rua, luz das
// janelas na rua). 'camada', 'selecao' e 'mascara' são das parcelas donas: começam neutros e entram por
// ganchos.definir.
//
// Um gancho: { uniformes: { nome: { value } }, vertice: { pars, main }, fragmento: { pars, sol, indireta, fim } }
//   uniformes   globais (um objeto só, compartilhado por todos os materiais: mudar o valor vale para todos)
//   vertice     pars antes do main; main depois do fog_vertex, com vGPosMundo já escrito
//   fragmento   pars antes do main (depois do common); sol dentro do laço da luz direcional (muda directLight.color;
//               tem geometryNormal e vGPosMundo); indireta depois do aomap_fragment (muda reflectedLight);
//               fim antes do tone mapping (muda gl_FragColor.rgb, em linear)
// Cada trecho de um gancho só entra no material que o pediu (ganchos.aplicar(material, nomes)): #ifdef G_<NOME>.
// Tudo em highp (a precisão do renderer); nenhum shader próprio usa a precisão média (D44, guarda de texto).
import * as THREE from 'three';
import { GANCHOS } from '../../contratos/render.js';
import { SOMBRA_PARS, SOMBRA_SOL, SOMBRA_LONGE_PARS, HAO_PARS, HAO_INDIRETA } from '../materiais/shaders/sombra.glsl.js';
import { NEBLINA_PARS, NEBLINA_FIM } from '../materiais/shaders/neblina.glsl.js';
import { NOITE_PARS, NOITE_INDIRETA } from '../ambiente/luzNoite.js';

/** Ordem dos trechos 'fim' (a neblina cobre o que as outras pintaram; a máscara é a última). */
const ORDEM_FIM = ['camada', 'selecao', 'noite', 'neblina', 'mascara'];

const vazio = () => ({ uniformes: {}, vertice: { pars: '', main: '' }, fragmento: { pars: '', sol: '', indireta: '', fim: '' } });

// ------------------------------------------------------------------------------------------------ ganchos da R1a

// 'sombra': mapa da sombra própria com cascatas e PCF estável, e a sombra das nuvens (materiais/shaders/sombra.glsl.js).
// Os valores vêm de render/sombra/mapa.js e de ambiente/nuvens.js a cada quadro.
const SOMBRA = {
  uniformes: {
    gSombraMapa: { value: null }, // DepthTexture do atlas (compareFunction ligado: sampler2DShadow)
    gSombraMatriz: { value: new THREE.Matrix4() }, // mundo para [0, 1]³ da cascata de perto (ou da única)
    gSombraMatriz1: { value: new THREE.Matrix4() }, // mundo para [0, 1]³ da cascata de longe
    gSombraLigada: { value: 0 },
    gSombraCascatas: { value: 1 },
    gSombraTexel: { value: 1 / 1024 }, // 1 / tamanho de uma cascata
    gSombraVies: { value: 0.0006 }, // em profundidade [0, 1] (negativo com a profundidade invertida)
    gSombraNormal: { value: 0.8 }, // desloca o ponto pela normal, em metros (acne em superfície inclinada)
    gSombraNormal1: { value: 1.6 },
    gSombraRaioPcf: { value: 1.2 }, // raio do disco do PCF em texels
    gSombraAmostras: { value: 5 },
    gSombraForca: { value: 1 }, // cai com a luz direta (crepúsculo, noite sem lua)
    gNuvemMapa: { value: null }, // ruído azulejável (R8) da sombra das nuvens
    gNuvemParams: { value: new THREE.Vector4(1 / 5200, 0, 0.7, 0) }, // escala, força, limiar da cobertura, livre
    gNuvemDesloc: { value: new THREE.Vector4() }, // deriva do vento (xy) e sol.xz / sol.y (zw)
  },
  vertice: { pars: '', main: '' },
  fragmento: { pars: SOMBRA_PARS, sol: SOMBRA_SOL, indireta: '', fim: '' },
};

// 'neblina': de altura com perspectiva aérea (materiais/shaders/neblina.glsl.js): a luz do ar baixo (sol em
// Henyey-Greenstein e luz ambiente) perto, o anel do horizonte do céu quando o caminho satura. Os valores vêm de
// ambiente/neblina.js a cada quadro; o céu lê o mesmo anel.
const NEBLINA = {
  uniformes: {
    gNeblinaBeta: { value: new THREE.Vector3(1.5e-4, 1.72e-4, 2.2e-4) }, // extinção por metro no nível do mar
    gNeblinaQueda: { value: 1 / 1200 }, // 1 / altura de escala
    gNeblinaLigada: { value: 1 },
    gNeblinaAnel: { value: Array.from({ length: 12 }, () => new THREE.Vector3(0.62, 0.7, 0.8)) }, // linear
    gNeblinaZenite: { value: new THREE.Vector3(0.3, 0.45, 0.7) },
    gNeblinaSolDir: { value: new THREE.Vector3(0, 1, 0) },
    gNeblinaSolCor: { value: new THREE.Vector3(0, 0, 0) }, // sol que o ar baixo espalha (irradiância vezes o albedo do ar)
    gNeblinaAmb: { value: new THREE.Vector3(0.1, 0.12, 0.15) }, // luz ambiente que o ar baixo espalha (céu, chão, cidade)
    gNeblinaG: { value: 0.6 }, // anisotropia do lóbulo do sol (Henyey-Greenstein)
    // uma cor só do horizonte ao lado do sol (linear), para shaders próprios que não leem o anel (nome da F0)
    gNeblinaCor: { value: new THREE.Color(0.62, 0.7, 0.8) },
  },
  vertice: { pars: '', main: '' },
  fragmento: { pars: NEBLINA_PARS, sol: '', indireta: '', fim: NEBLINA_FIM },
};

// ------------------------------------------------------------------------------------------------ ganchos da R1b

/** Texturas de partida (1 x 1) até o campo e o mapa de luz da rua existirem: sem sombra, céu aberto, rua escura. */
function textura1(dados, tipo) {
  const t = new THREE.DataTexture(dados, 1, 1, THREE.RGBAFormat, tipo);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
export const CAMPO_VAZIO = textura1(new Float32Array([-1e4, -1e4, 1, -1e4]), THREE.FloatType);
const RUA_VAZIA = textura1(new Uint8Array([0, 0, 0, 0]), THREE.UnsignedByteType);

// uniformes do campo (render/ambiente/sombraLonge.js), comuns à sombra de longe, ao HAO e à noite
const CAMPO = {
  gCampoMapa: { value: CAMPO_VAZIO },
  gCampoParams: { value: new THREE.Vector4(-4096, -4096, 1 / 8192, 8) },
  gCampoLigado: { value: 0 },
};

// 'sombraLonge': a altura da sombra no degrau do sol e no seguinte (R e G do campo), misturadas por gCampoT; o trecho
// que usa fica no 'sol' da 'sombra' (fora das cascatas de perto)
const SOMBRA_LONGE = {
  uniformes: { ...CAMPO, gCampoT: { value: 0 }, gCampoVies: { value: new THREE.Vector2(0.8, 1.2) } },
  vertice: { pars: '', main: '' },
  fragmento: { pars: SOMBRA_LONGE_PARS, sol: '', indireta: '', fim: '' },
};

// 'hao': a visibilidade do céu no chão da vizinhança (B do campo) na luz do ambiente
const HAO = {
  uniformes: { ...CAMPO, gHaoParams: { value: new THREE.Vector4(0.85, 0.3, 0.2, 1) } },
  vertice: { pars: '', main: '' },
  fragmento: { pars: HAO_PARS, sol: '', indireta: HAO_INDIRETA, fim: '' },
};

// 'noite': a luz da rua (mapa da R3a ou o substituto de ambiente/luzNoite.js) e a das janelas na rua
const NOITE = {
  uniformes: {
    ...CAMPO,
    gLuzRuaMapa: { value: RUA_VAZIA },
    gLuzRuaParams: { value: new THREE.Vector4(-4096, -4096, 1 / 8192, 2) },
    gNoiteParams: { value: new THREE.Vector4(0, 9, 9, 0) },
    gNoiteJanelas: { value: new THREE.Vector3() },
  },
  vertice: { pars: '', main: '' },
  fragmento: { pars: NOITE_PARS, sol: '', indireta: NOITE_INDIRETA, fim: '' },
};

// ------------------------------------------------------------------------------------------------ registro

const definicoes = new Map(GANCHOS.map((n) => [n, vazio()]));
definicoes.set('sombra', SOMBRA);
definicoes.set('neblina', NEBLINA);
definicoes.set('sombraLonge', SOMBRA_LONGE);
definicoes.set('hao', HAO);
definicoes.set('noite', NOITE);

/** Uniformes globais de todos os ganchos (o mesmo objeto entra em todo material). */
export const uniformes = {};
for (const d of definicoes.values()) Object.assign(uniformes, d.uniformes);

const materiais = new Set();
let versao = 1;

function normalizar(def = {}) {
  const v = vazio();
  return {
    uniformes: { ...(def.uniformes || {}) },
    vertice: { ...v.vertice, ...(def.vertice || {}) },
    fragmento: { ...v.fragmento, ...(def.fragmento || {}) },
  };
}

/** Trechos juntos dos ganchos pedidos (para ShaderMaterial próprio, que não passa por onBeforeCompile). */
export function trechos(nomes) {
  const lista = GANCHOS.filter((n) => nomes.includes(n));
  const def = (n) => definicoes.get(n);
  const cada = (fn) => lista.map((n) => `#ifdef G_${n.toUpperCase()}\n${fn(def(n))}\n#endif`).join('\n');
  const fim = ORDEM_FIM.filter((n) => lista.includes(n)).map((n) => `#ifdef G_${n.toUpperCase()}\n${def(n).fragmento.fim}\n#endif`).join('\n');
  return {
    defines: Object.fromEntries(lista.map((n) => [`G_${n.toUpperCase()}`, ''])),
    verticePars: 'varying vec3 vGPosMundo;\n' + cada((d) => d.vertice.pars),
    verticeMain: /* glsl */ `
vec4 gPosM = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  gPosM = batchingMatrix * gPosM;
#endif
#ifdef USE_INSTANCING
  gPosM = instanceMatrix * gPosM;
#endif
vGPosMundo = ( modelMatrix * gPosM ).xyz;
` + cada((d) => d.vertice.main),
    fragmentoPars: 'varying vec3 vGPosMundo;\n' + cada((d) => d.fragmento.pars),
    sol: cada((d) => d.fragmento.sol),
    indireta: cada((d) => d.fragmento.indireta),
    fim,
  };
}

function trocarUm(src, alvo, novo, onde) {
  if (!src.includes(alvo)) throw new Error(`ganchos: ${onde} sem '${alvo}' (o three mudou?)`);
  return src.replace(alvo, novo);
}

/**
 * Liga ganchos a um material do three (Standard, Physical, Lambert ou Basic). Guarda o material para refazer o programa
 * quando um gancho for redefinido. Devolve o material.
 * @example ganchos.aplicar(new THREE.MeshStandardMaterial({ color }), ['sombra', 'neblina'])
 */
export function aplicar(material, nomes = ['sombra', 'neblina']) {
  const pedidos = GANCHOS.filter((n) => nomes.includes(n));
  const anterior = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    anterior?.call(material, shader, renderer);
    const t = trechos(pedidos);
    for (const n of pedidos) Object.assign(shader.uniforms, definicoes.get(n).uniformes);
    shader.defines = { ...(shader.defines || {}), ...t.defines };
    let vs = shader.vertexShader;
    vs = trocarUm(vs, '#include <common>', `#include <common>\n${t.verticePars}`, 'vértice');
    vs = trocarUm(vs, '#include <fog_vertex>', `#include <fog_vertex>\n${t.verticeMain}`, 'vértice');
    let fs = shader.fragmentShader;
    fs = trocarUm(fs, '#include <common>', `#include <common>\n${t.fragmentoPars}`, 'fragmento');
    if (fs.includes('#include <lights_fragment_begin>')) {
      const luz = THREE.ShaderChunk.lights_fragment_begin;
      const passo = 'getDirectionalLightInfo( directionalLight, directLight );';
      fs = fs.replace('#include <lights_fragment_begin>', trocarUm(luz, passo, `${passo}\n${t.sol}`, 'luz'));
    }
    if (fs.includes('#include <aomap_fragment>')) fs = fs.replace('#include <aomap_fragment>', `#include <aomap_fragment>\n${t.indireta}`);
    fs = trocarUm(fs, '#include <tonemapping_fragment>', `${t.fim}\n#include <tonemapping_fragment>`, 'fragmento');
    shader.vertexShader = vs;
    shader.fragmentShader = fs;
  };
  const chaveAnterior = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${chaveAnterior ? chaveAnterior() : ''}|g${versao}:${pedidos.join(',')}`;
  material.userData.ganchos = pedidos;
  materiais.add(material);
  material.addEventListener('dispose', () => materiais.delete(material));
  material.needsUpdate = true;
  return material;
}

/**
 * Troca a implementação de um gancho (a R1a publica os de verdade). Os uniformes novos entram na tabela global e os
 * materiais que usam ganchos refazem o programa.
 */
export function definir(nome, def) {
  if (!definicoes.has(nome)) throw new Error(`gancho fora do contrato: ${nome} (${GANCHOS.join(', ')})`);
  const d = normalizar(def);
  definicoes.set(nome, d);
  Object.assign(uniformes, d.uniformes);
  versao++;
  for (const m of materiais) m.needsUpdate = true;
}

/** Definição atual de um gancho (somente leitura). */
export const obter = (nome) => definicoes.get(nome) ?? null;

/** Nomes do contrato (fonte/contratos/render.js). */
export const nomes = () => [...GANCHOS];

/** O objeto publicado aos domínios e às cenas. */
export const ganchos = { definir, obter, aplicar, trechos, uniformes, nomes, get versao() { return versao; } };
