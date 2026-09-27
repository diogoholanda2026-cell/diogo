// Reservatório da Arcologia (lago.e1): o espelho d'água na cota do plano e a borda de cada plano: 'degraus' (degraus
// de pedra até a água, Cheonggyecheon e a Ópera de Oslo), 'cais' (muro de cais com pedra de coroamento, as margens do
// canal de Songdo) ou 'pedra' (blocos de arenito desencontrados, o promontório de Barangaroo), sempre com o passeio
// em volta, que cobre a transição do chão cavado. A água tem material próprio: escura, com o reflexo do céu e
// ondulação fina no shader.
//
// A cava entra no chão pelo aplainar (sim.formas, D5): a X1b registra cavaDoPlano() quando lago.e1 começa. As cenas da
// X1a cavam o relevo da própria simulação de prova com cavarTerreno(), do mesmo jeito que o aplainar faria.
import * as THREE from 'three';
import { acab, PADRAO, orientar, tampa, hashF, geometriaDe, Malha } from './torre.js';
import { deslocar, faixaEntre } from './partes.js';
import { pontoNoPoligono, distPoligono } from '../../comum/vetor.js';

const K = {
  granito: acab('#77716a', { rugo: 0.6, padrao: PADRAO.pedra }),
  pedra: acab('#a39884', { rugo: 0.72, padrao: PADRAO.pedra }),
  arenito: acab('#b49a76', { rugo: 0.85, padrao: PADRAO.pedra }),
  arenitoEscuro: acab('#8e7a5f', { rugo: 0.85, padrao: PADRAO.pedra }),
  piso: acab('#948b7e', { rugo: 0.8, padrao: PADRAO.piso }),
  concreto: acab('#9b968d', { rugo: 0.8 }),
  fundo: acab('#3b4540', { rugo: 0.9 }),
};

/** Passeio em volta do reservatório (m, do fio d'água para fora), largo o bastante para cobrir a borda da cava. */
export const PASSEIO = 26;

/** Paredes verticais ao longo de um contorno (normal para dentro da água quando agua = true). */
function muro(m, poly, y0, y1, k, paraAgua = true) {
  const n = poly.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    let ax = poly[2 * i], az = poly[2 * i + 1], bx = poly[2 * j], bz = poly[2 * j + 1];
    const l = Math.hypot(bx - ax, bz - az);
    if (l < 1e-6) continue;
    // contorno positivo: a normal (dz, -dx) aponta para fora; o muro do cais olha para a água (para dentro)
    let nn = [(bz - az) / l, 0, -(bx - ax) / l];
    if (paraAgua) nn = nn.map((v) => -v);
    m.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], nn, [0, y0], [l, y0], [l, y1], [0, y1], k);
  }
}

/**
 * Monta o reservatório de uma peça { contorno, nivel, fundo, borda } com a gleba na cota dada.
 * @param {{ opaco: Malha, agua: Malha, cota: number }} d
 * @returns {{ caixa: number[], nivel: number }}
 */
export function montarReservatorio(peca, { opaco, agua, cota }) {
  const C = orientar(peca.contorno);
  const nivel = cota + peca.nivel;
  const fundo = cota + peca.fundo;
  const topo = cota + 0.2;
  // espelho d'água um pouco além do fio (a borda cobre)
  tampa(agua, deslocar(C, 0.6), nivel, [0, 0, 0, 0], true);
  // leito (visto pela água nos ângulos baixos)
  tampa(opaco, C, fundo, K.fundo, true);
  if (peca.borda === 'degraus') {
    // 5 degraus de 1,6 m do fio d'água até o passeio
    const n = 5;
    let ant = C;
    let yAnt = nivel + 0.45;
    muro(opaco, C, fundo, yAnt, K.pedra);
    for (let i = 1; i <= n; i++) {
      const R = deslocar(C, 1.6 * i);
      const y = nivel + 0.45 + ((topo - nivel - 0.45) * i) / n;
      faixaEntre(opaco, ant, R, yAnt, K.pedra, true);
      muro(opaco, R, yAnt, y, K.pedra);
      ant = R;
      yAnt = y;
    }
    faixaEntre(opaco, ant, deslocar(C, PASSEIO), topo, K.piso, true);
  } else if (peca.borda === 'cais') {
    muro(opaco, C, fundo, topo + 0.35, K.granito);
    const cor = deslocar(C, 0.9);
    faixaEntre(opaco, C, cor, topo + 0.35, K.granito, true);
    muro(opaco, cor, topo, topo + 0.35, K.granito, false);
    faixaEntre(opaco, cor, deslocar(C, PASSEIO), topo, K.piso, true);
  } else {
    // pedra: blocos de arenito de alturas desencontradas em 3 fiadas (o promontório de Barangaroo)
    let ant = C;
    let yAnt = nivel + 0.3;
    muro(opaco, C, fundo, yAnt, K.arenitoEscuro);
    const n = C.length / 2;
    for (let f = 1; f <= 3; f++) {
      const R = deslocar(C, 2.6 * f);
      const yBase = nivel + 0.3 + ((topo - nivel - 0.3) * f) / 3;
      // cada segmento do contorno vira um bloco com altura própria
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const h = yBase + (hashF(i, f, 71) - 0.5) * 0.9;
        const k = hashF(i, f, 5) < 0.5 ? K.arenito : K.arenitoEscuro;
        const q = [ant[2 * i], ant[2 * i + 1], ant[2 * j], ant[2 * j + 1], R[2 * j], R[2 * j + 1], R[2 * i], R[2 * i + 1]];
        opaco.quad([q[0], h, q[1]], [q[2], h, q[3]], [q[4], h, q[5]], [q[6], h, q[7]], [0, 1, 0], [q[0], q[1]], [q[2], q[3]], [q[4], q[5]], [q[6], q[7]], k);
        const l = Math.hypot(q[2] - q[0], q[3] - q[1]) || 1;
        const nn = [-(q[3] - q[1]) / l, 0, (q[2] - q[0]) / l];
        opaco.quad([q[0], yAnt - 0.6, q[1]], [q[2], yAnt - 0.6, q[3]], [q[2], h, q[3]], [q[0], h, q[1]], nn, [0, 0], [l, 0], [l, 1], [0, 1], k);
      }
      ant = R;
      yAnt = yBase;
    }
    faixaEntre(opaco, ant, deslocar(C, PASSEIO), topo, K.piso, true);
  }
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < C.length; i += 2) {
    x0 = Math.min(x0, C[i]);
    x1 = Math.max(x1, C[i]);
    z0 = Math.min(z0, C[i + 1]);
    z1 = Math.max(z1, C[i + 1]);
  }
  return { caixa: [x0, fundo, z0, x1, topo, z1], nivel };
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

/** Material da água do reservatório: escura, reflexo do céu (Fresnel) e ondulação fina pelo mundo. */
export function materialAgua(ganchos) {
  // corpo verde-azulado de água limpa com 6 a 8 m de fundo (o reservatório de Marina Bay), e o céu pelo Fresnel
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.02, 0.052, 0.05), roughness: 0.06, metalness: 0, envMapIntensity: 1.0 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U_AGUA);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTempoAgua;')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
{
  vec2 p = vGPosMundo.xz;
  float t = uTempoAgua;
  vec2 g = vec2( cos( p.x * 0.21 + t * 0.9 ) * 0.5 + cos( ( p.x + p.y ) * 0.47 - t * 1.3 ) * 0.35 + cos( p.x * 1.3 + p.y * 0.7 + t * 2.1 ) * 0.15,
                 cos( p.y * 0.19 - t * 0.8 ) * 0.5 + cos( ( p.y - p.x ) * 0.43 + t * 1.1 ) * 0.35 + cos( p.y * 1.1 - p.x * 0.9 + t * 1.9 ) * 0.15 );
  vec3 nMundo = normalize( vec3( -g.x * 0.045, 1.0, -g.y * 0.045 ) );
  normal = normalize( ( viewMatrix * vec4( nMundo, 0.0 ) ).xyz );
}`,
      );
  };
  mat.customProgramCacheKey = () => 'arcologia-agua-1';
  mat.name = 'arcologia:agua';
  return ganchos.aplicar(mat, ['sombra', 'neblina']);
}

/** Atualiza o tempo da ondulação. */
export function quadroAgua(tMs) {
  U_AGUA.uTempoAgua.value = (tMs / 1000) % 1000;
}

export { geometriaDe, Malha };

export function registrar() {}
