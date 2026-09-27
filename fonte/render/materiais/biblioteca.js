// Biblioteca de materiais (desenho do render 9.1 e 9.2): poucos programas, todos em cima do MeshStandardMaterial do
// three (luz, luz do ambiente, instâncias e profundidade invertida funcionam sem reescrever o shader de luz), com os
// ganchos comuns ligados (neblina, sombra própria e das nuvens, sombra de longe, HAO, camada, noite, seleção e
// máscara; cada um entra na chave do programa). Os albedos são de material real, em linear: nada acima de 0,80, grama
// oliva e não verde-limão, asfalto nunca preto. As parcelas pedem o material pela família e ajustam o resto.
import * as THREE from 'three';
import { ganchos } from '../motor/ganchos.js';

/** Ganchos que todo material do mundo liga (motor/ganchos.js; os de outras parcelas começam neutros). */
export const GANCHOS_COMUNS = Object.freeze(['sombra', 'sombraLonge', 'hao', 'camada', 'noite', 'selecao', 'mascara', 'neblina']);

/** Albedo (linear, meio da faixa), rugosidade e metal por superfície (desenho do render 9.2). */
export const ALBEDOS = Object.freeze({
  asfaltoNovo: { cor: [0.05, 0.05, 0.052], rug: 0.85 },
  asfaltoGasto: { cor: [0.12, 0.118, 0.112], rug: 0.72 },
  concreto: { cor: [0.35, 0.34, 0.32], rug: 0.8 },
  pinturaClara: { cor: [0.64, 0.62, 0.57], rug: 0.7 },
  grama: { cor: [0.1, 0.12, 0.06], rug: 0.9 },
  capimSeco: { cor: [0.3, 0.27, 0.18], rug: 0.9 },
  terraRoxa: { cor: [0.2, 0.11, 0.08], rug: 0.95 },
  terraClara: { cor: [0.26, 0.22, 0.17], rug: 0.95 },
  areia: { cor: [0.44, 0.4, 0.32], rug: 0.9 },
  granito: { cor: [0.28, 0.27, 0.26], rug: 0.7 },
  telha: { cor: [0.36, 0.2, 0.13], rug: 0.75 },
  folhagem: { cor: [0.06, 0.09, 0.04], rug: 0.6 },
  vidro: { cor: [0.03, 0.035, 0.04], rug: 0.08, metal: 0 },
  bronze: { cor: [0.4, 0.28, 0.18], rug: 0.35, metal: 1 },
  aluminio: { cor: [0.9, 0.9, 0.91], rug: 0.3, metal: 1 },
});

/** Teto do albedo (aceite A9: nenhuma textura de albedo acima de 0,80). */
export const ALBEDO_MAXIMO = 0.8;

/**
 * Material do mundo: MeshStandardMaterial com os ganchos comuns. `superficie` pega albedo e rugosidade da tabela; o
 * resto dos parâmetros do three passa direto (map, vertexColors, envMapIntensity...).
 * @example criarMaterial({ superficie: 'concreto' })
 * @example criarMaterial({ color: '#8a8672', roughness: 0.9 }, { ganchos: ['sombra', 'neblina'] })
 */
export function criarMaterial({ superficie = null, ...parametros } = {}, { ganchos: nomes = GANCHOS_COMUNS } = {}) {
  const base = superficie ? ALBEDOS[superficie] : null;
  if (superficie && !base) throw new Error(`superfície desconhecida: ${superficie}`);
  const m = new THREE.MeshStandardMaterial({
    ...(base ? { color: new THREE.Color().setRGB(...base.cor, THREE.LinearSRGBColorSpace), roughness: base.rug, metalness: base.metal ?? 0 } : {}),
    ...parametros,
  });
  return ganchos.aplicar(m, nomes);
}

/** Liga os ganchos comuns num material já criado (ShaderMaterial próprio: use ganchos.trechos). */
export function prepararMaterial(material, nomes = GANCHOS_COMUNS) {
  return ganchos.aplicar(material, nomes);
}

/** Luminância de um albedo linear [r, g, b]. */
export const luminanciaAlbedo = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

export function registrar() {}
