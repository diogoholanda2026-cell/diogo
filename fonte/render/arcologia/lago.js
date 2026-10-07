// Mirror Lake (lago.e1, D89 e D97): a cava do lago grande no relevo e o material da água (escura, com o reflexo do céu e a
// ondulação fina no shader). A água, as pontes, as bacias e as Dream Falls são peças do lagos.js.
//
// A cava entra no chão pelo aplainar (sim.formas, D5): a X1b registra cavaDoPlano() quando lago.e1 começa. As cenas
// cavam o relevo da própria simulação de prova com cavarTerreno(), do mesmo jeito que o aplainar faria. O contorno do lago
// leva as ilhas como furos ligados por frestas (uma forma tem um contorno só): fora do contorno o chão sobe em rampa de
// 16 m depois de 8 m planos, e é daí que saem as ilhas e as margens.
import * as THREE from 'three';
import { orientar, UNIFORMES } from './torre.js';
import { pontoNoPoligono, distPoligono } from '../../comum/vetor.js';

/**
 * Cava o relevo da simulação de prova como o aplainar faria (D5): dentro do contorno e numa faixa plana de 8 m além
 * dele o chão vai ao leito; depois, smoothstep de 16 m até o chão original. Muda T.altura no lugar e devolve o
 * retângulo sujo [x0, z0, x1, z1] (quem chama marca no diário). guarda recebe as alturas originais para desfazer.
 */
export function cavarTerreno(T, peca, cota, guarda = null) {
  const C = orientar(peca.contorno);
  const leito = cota + peca.fundo;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < C.length; i += 2) {
    x0 = Math.min(x0, C[i]);
    x1 = Math.max(x1, C[i]);
    z0 = Math.min(z0, C[i + 1]);
    z1 = Math.max(z1, C[i + 1]);
  }
  const m = 8 + 16 + T.passo;
  const i0 = Math.max(0, Math.floor((x0 - m - T.origem[0]) / T.passo));
  const i1 = Math.min(T.n - 1, Math.ceil((x1 + m - T.origem[0]) / T.passo));
  const j0 = Math.max(0, Math.floor((z0 - m - T.origem[1]) / T.passo));
  const j1 = Math.min(T.n - 1, Math.ceil((z1 + m - T.origem[1]) / T.passo));
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const x = T.origem[0] + i * T.passo;
      const z = T.origem[1] + j * T.passo;
      const dentro = pontoNoPoligono(x, z, C);
      const d = dentro ? 0 : distPoligono(x, z, C);
      if (d > 24) continue;
      const k = j * T.n + i;
      if (guarda && !guarda.has(k)) guarda.set(k, T.altura[k]);
      const t = d <= 8 ? 0 : (d - 8) / 16;
      const s = t * t * (3 - 2 * t);
      const h = leito + (T.altura[k] - leito) * s;
      if (h < T.altura[k]) T.altura[k] = h;
    }
  }
  return [x0 - m, z0 - m, x1 + m, z1 + m];
}

/**
 * Cava o reservatório de um plano na simulação de uma cena e marca o chão no diário (desfaz a cava anterior que a
 * mesma guarda tiver). estado = { guarda: Map, ret: [x0, z0, x1, z1] | null }.
 */
export function cavarPlanoNaCena(ctx, plano, cota, estado) {
  const T = ctx.sim?.espelho?.terreno;
  if (!T) return;
  if (estado.guarda.size) {
    descavar(T, estado.guarda);
    if (estado.ret) ctx.sim.mudancas.marcarRet('terreno', ...estado.ret);
  }
  const res = plano.partes.find((p) => p.id === 'lago').pecas.find((p) => p.tipo === 'lago');
  estado.ret = cavarTerreno(T, res, cota, estado.guarda);
  ctx.sim.mudancas.marcarRet('terreno', ...estado.ret);
}

/** Desfaz uma cava (as alturas guardadas por cavarTerreno). */
export function descavar(T, guarda) {
  for (const [k, h] of guarda) T.altura[k] = h;
  guarda.clear();
}

// ------------------------------------------------------------------------------------------------ água

const U_AGUA = { uTempoAgua: { value: 0 } };

/** Material da água do lago: escura, reflexo do céu (Fresnel) e ondulação fina pelo mundo. */
export function materialAgua(ganchos) {
  // corpo verde-azulado de água limpa e funda (turquesa fechado, da cor do mar da baía mas mais escura), e o céu pelo Fresnel
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.018, 0.075, 0.085), roughness: 0.05, metalness: 0, envMapIntensity: 1.0 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U_AGUA, { uNoite: UNIFORMES.uNoite });
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTempoAgua;\nuniform float uNoite;')
      // à noite o céu refletido quase some (a água escura, com o brilho das luzes em volta), como um lago de verdade
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectSpecular *= mix( 1.0, 0.35, uNoite );')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
{
  vec2 p = vGPosMundo.xz;
  float t = uTempoAgua;
  vec2 g = vec2( cos( p.x * 0.21 + t * 0.9 ) * 0.5 + cos( ( p.x + p.y ) * 0.47 - t * 1.3 ) * 0.35 + cos( p.x * 1.3 + p.y * 0.7 + t * 2.1 ) * 0.15,
                 cos( p.y * 0.19 - t * 0.8 ) * 0.5 + cos( ( p.y - p.x ) * 0.43 + t * 1.1 ) * 0.35 + cos( p.y * 1.1 - p.x * 0.9 + t * 1.9 ) * 0.15 );
  vec3 nMundo = normalize( vec3( -g.x * 0.04, 1.0, -g.y * 0.04 ) );
  normal = normalize( ( viewMatrix * vec4( nMundo, 0.0 ) ).xyz );
}`,
      );
  };
  mat.customProgramCacheKey = () => 'arcologia-agua-3';
  mat.name = 'arcologia:agua';
  return ganchos.aplicar(mat, ['sombra', 'neblina']);
}

/** Atualiza o tempo da ondulação (a volta de 2 h mantém a precisão do float sem o salto da onda a cada 16 min). */
export function quadroAgua(tMs) {
  U_AGUA.uTempoAgua.value = (tMs / 1000) % 7200;
}

export function registrar() {}
