// Registro dos ganchos GLSL comuns (D14, D43, D45): todo GLSL próprio que entra nos materiais do three passa por aqui,
// com nomes estáveis, para o porte ao WebGPU no M4 custar pouco. A R1a publica 'sombra' (sombra própria em cascatas
// com PCF estável e a sombra das nuvens) e 'neblina' (altura e perspectiva aérea com a cor do horizonte do céu), com
// os uniformes abaixo (nomes estáveis). 'sombraLonge', 'hao' e 'noite' são da R1b; 'camada', 'selecao' e 'mascara'
// das parcelas donas: começam neutros e entram por ganchos.definir.
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
import { SOMBRA_PARS, SOMBRA_SOL } from '../materiais/shaders/sombra.glsl.js';
import { NEBLINA_PARS, NEBLINA_FIM } from '../materiais/shaders/neblina.glsl.js';

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

// 'neblina': de altura com perspectiva aérea; a cor é o anel do horizonte do céu (materiais/shaders/neblina.glsl.js).
// Os valores vêm de ambiente/neblina.js a cada quadro; o céu lê o mesmo anel.
const NEBLINA = {
  uniformes: {
    gNeblinaBeta: { value: new THREE.Vector3(1.5e-4, 1.72e-4, 2.2e-4) }, // extinção por metro no nível do mar
    gNeblinaQueda: { value: 1 / 1200 }, // 1 / altura de escala
    gNeblinaLigada: { value: 1 },
    gNeblinaAnel: { value: Array.from({ length: 12 }, () => new THREE.Vector3(0.62, 0.7, 0.8)) }, // linear
    gNeblinaZenite: { value: new THREE.Vector3(0.3, 0.45, 0.7) },
    gNeblinaSolDir: { value: new THREE.Vector3(0, 1, 0) },
  },
  vertice: { pars: '', main: '' },
  fragmento: { pars: NEBLINA_PARS, sol: '', indireta: '', fim: NEBLINA_FIM },
};

// ------------------------------------------------------------------------------------------------ registro

const definicoes = new Map(GANCHOS.map((n) => [n, vazio()]));
definicoes.set('sombra', SOMBRA);
definicoes.set('neblina', NEBLINA);

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
