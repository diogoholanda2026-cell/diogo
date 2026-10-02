// Mirror Lake (lago.e1, D89): o anel de água de 15 m em volta do pódio das torres, entre a parede do pódio e o anel de
// floresta, com a borda de granito e o leito escuro. As Dream Falls e as fontes são peças do partes.js; aqui ficam o
// espelho, a borda, a cava no relevo e o material da água (escura, com o reflexo do céu e a ondulação fina no shader).
//
// A cava entra no chão pelo aplainar (sim.formas, D5): a X1b registra cavaDoPlano() quando lago.e1 começa. As cenas
// cavam o relevo da própria simulação de prova com cavarTerreno(), do mesmo jeito que o aplainar faria.
import * as THREE from 'three';
import { acab, PADRAO, orientar, UNIFORMES } from './torre.js';
import { faixaEntre } from './partes.js';
import { pontoNoPoligono, distPoligono } from '../../comum/vetor.js';

const K = {
  granito: acab('#77716a', { rugo: 0.6, padrao: PADRAO.pedra }),
  pedraClara: acab('#bdb3a1', { rugo: 0.72, padrao: PADRAO.pedra }),
  fundo: acab('#2f3a36', { rugo: 0.9 }),
};

/** Círculo (pares, sentido positivo) de raio r em n pontos, centrado em (cx, cz). */
function circulo(cx, cz, r, n) {
  const P = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    P.push(cx + r * Math.cos(t), cz + r * Math.sin(t));
  }
  return P;
}

/**
 * O Mirror Lake: o espelho d'água em anel (da parede do pódio até a borda de fora), o leito, o muro de granito da
 * borda de fora e a pedra de coroamento até o chão da floresta.
 * @param {{ r0: number, r1: number, cx: number, cz: number, nivel: number, fundo: number }} peca
 * @param {{ opaco: import('./torre.js').Malha, agua: import('./torre.js').Malha, cota: number, lod?: 0 | 1 }} d
 * @returns {{ caixa: number[], nivel: number }}
 */
export function montarLagoAnel(peca, { opaco, agua, cota, lod = 1 }) {
  const { cx, cz, r0, r1 } = peca;
  const nivel = cota + peca.nivel;
  const fundo = cota + peca.fundo;
  const topo = cota + 0.25;
  const n = lod === 0 ? 144 : 120;
  const dentro = circulo(cx, cz, r0 - 0.2, n);
  const fora = circulo(cx, cz, r1 + 0.3, n);
  // espelho d'água e o leito
  faixaEntre(agua, dentro, fora, nivel, [0, 0, 0, 0], true);
  faixaEntre(opaco, circulo(cx, cz, r0 - 0.2, n), circulo(cx, cz, r1, n), fundo, K.fundo, true);
  // o muro da borda de fora, virado para a água, e o coroamento de pedra clara até o chão da floresta
  const borda = circulo(cx, cz, r1, n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = borda[2 * i], az = borda[2 * i + 1], bx = borda[2 * j], bz = borda[2 * j + 1];
    const l = Math.hypot(bx - ax, bz - az);
    const nm = [(cx - (ax + bx) / 2), 0, (cz - (az + bz) / 2)];
    const nl = Math.hypot(nm[0], nm[2]) || 1;
    opaco.quad([ax, fundo, az], [bx, fundo, bz], [bx, topo, bz], [ax, topo, az], [nm[0] / nl, 0, nm[2] / nl], [0, fundo], [l, fundo], [l, topo], [0, topo], K.granito);
  }
  faixaEntre(opaco, borda, circulo(cx, cz, r1 + 1.6, n), topo, K.pedraClara, true);
  return { caixa: [cx - r1, fundo, cz - r1, cx + r1, topo, cz + r1], nivel };
}

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
  const res = plano.partes.find((p) => p.id === 'lago').pecas.find((p) => p.tipo === 'reservatorio');
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
  // corpo verde-azulado de água limpa e funda (o espelho d'água de pedra escura), e o céu pelo Fresnel
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.016, 0.04, 0.042), roughness: 0.05, metalness: 0, envMapIntensity: 1.0 });
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
  mat.customProgramCacheKey = () => 'arcologia-agua-2';
  mat.name = 'arcologia:agua';
  return ganchos.aplicar(mat, ['sombra', 'neblina']);
}

/** Atualiza o tempo da ondulação (a volta de 2 h mantém a precisão do float sem o salto da onda a cada 16 min). */
export function quadroAgua(tMs) {
  U_AGUA.uTempoAgua.value = (tMs / 1000) % 7200;
}

export function registrar() {}
