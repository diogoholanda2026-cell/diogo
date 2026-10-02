// Mundo de fora (desenho do render 3.3): o horizonte além da moldura do terreno. O CDLOD já desenha 12 km em volta do
// mapa (a borda continuando em serra baixa ou afundando no mar, uTerFora) e a água leva o mar até 40 km; aqui entra o
// anel de 15,5 a 44 km com a Serra do Mar: cristas de 400 a 1.200 m nas direções em que a borda do mapa é terra,
// subindo com a distância, e o mar aberto com poucas ilhas onde a borda é mar. Uma malha só (uma chamada, ~10 mil
// triângulos), cor por vértice (mata escura, pedra nas cristas íngremes) e a neblina de altura com a perspectiva aérea
// por cima: de longe ela vira a silhueta azulada atrás da cidade, sem costura com o céu.
import * as THREE from 'three';
import { AGUA } from '../../contratos/flags.js';
import { fbm, hashF } from '../geracao/ruido.js';
import { porPerfil } from '../motor/perfis.js';
import { fnv1aTexto } from '../../comum/hash.js';

/** Raios do anel (m, do centro do mapa). */
export const ANEL_FORA = Object.freeze({ r0: 15500, r1: 44000 });
/** Divisões do anel por perfil: em volta e na distância. */
export const PERFIL_FORA = Object.freeze({
  ultra: { az: 384, rad: 26 },
  alta: { az: 256, rad: 20 },
  media: { az: 160, rad: 14 },
  leve: { az: 96, rad: 10 },
});
/**
 * Semente do horizonte pela semente do mapa (texto ou número): o hash do texto inteiro, para dois mapas de sementes do
 * mesmo tamanho não terem a mesma serra.
 */
export const sementeFora = (semente) => (fnv1aTexto(String(semente ?? '')) % 65521) + 11;

/** Cores (sRGB): mata da serra, a mata mais clara das encostas ao sol e o granito. */
const CORES = Object.freeze({ mata: '#26331d', clara: '#3a4a2b', pedra: '#6b675f', costa: '#56523f' });

const linear = (hex) => {
  const v = (k) => {
    const c = parseInt(hex.slice(1 + 2 * k, 3 + 2 * k), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [v(0), v(1), v(2)];
};
const ss = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------------------------------------------ puros (testados)

/**
 * Terra (1) ou mar (0) em cada direção a partir do centro do mapa, pela água da borda (uma amostra 16 m para dentro
 * do quadrado), suavizada em volta (as serras descem até o mar sem degrau).
 * @returns {Float32Array} n direções, ângulo 2 pi k / n a partir de +x, crescendo para +z
 */
export function terraPorDirecao(T, n = 360) {
  const out = new Float32Array(n);
  if (!T?.agua) return out.fill(1);
  const L = T.passo * (T.n - 1);
  const cx = T.origem[0] + L / 2;
  const cz = T.origem[1] + L / 2;
  const meia = L / 2 - 16;
  const bruto = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const a = (2 * Math.PI * k) / n;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const t = meia / Math.max(Math.abs(dx), Math.abs(dz));
    let terra = 0;
    // três amostras na borda (a direção e as vizinhas): uma ilha de borda não vira serra
    for (const d of [-24, 0, 24]) {
      const x = cx + dx * t - dz * d;
      const z = cz + dz * t + dx * d;
      const i = Math.min(T.n - 1, Math.max(0, Math.round((x - T.origem[0]) / T.passo)));
      const j = Math.min(T.n - 1, Math.max(0, Math.round((z - T.origem[1]) / T.passo)));
      terra += T.agua[j * T.n + i] === AGUA.MAR ? 0 : 1;
    }
    bruto[k] = terra / 3;
  }
  // média móvel de ±12 graus
  const w = Math.max(1, Math.round(n / 30));
  for (let k = 0; k < n; k++) {
    let s = 0;
    for (let q = -w; q <= w; q++) s += bruto[(k + q + n) % n];
    out[k] = s / (2 * w + 1);
  }
  return out;
}

/** Terra numa direção (ângulo em rad), interpolando a tabela. */
export function terraEm(tab, ang) {
  const n = tab.length;
  const x = ((((ang / (2 * Math.PI)) * n) % n) + n) % n;
  const i = Math.floor(x);
  const f = x - i;
  return tab[i] * (1 - f) + tab[(i + 1) % n] * f;
}

/**
 * Cota do mundo de fora (m) num ponto do anel: a serra (cristas pelo ruído de gradiente dobrado, subindo com a
 * distância) onde a direção é terra; abaixo do mar, com uma ilha rara, onde é mar.
 */
export function alturaFora(x, z, terra, semente = 1) {
  const r = Math.hypot(x, z);
  const t = Math.min(1, Math.max(0, (r - ANEL_FORA.r0) / (ANEL_FORA.r1 - ANEL_FORA.r0)));
  const n1 = fbm(x / 9000, z / 9000, { s: semente, oitavas: 4, tipo: 'gradiente' });
  const n2 = fbm(x / 2600, z / 2600, { s: semente + 7, oitavas: 3, tipo: 'gradiente' });
  const crista = (1 - Math.abs(n1)) ** 2.2 * 0.75 + (1 - Math.abs(n2)) ** 2 * 0.25;
  const subida = ss(0, 0.4, t) * (1 - 0.35 * ss(0.8, 1, t));
  const serra = 240 + (420 + 780 * crista) * subida;
  const ilha = ss(0.72, 0.88, fbm(x / 3800, z / 3800, { s: semente + 13, oitavas: 3 })) * 320 * ss(0.08, 0.2, t) * (1 - ss(0.65, 0.8, t));
  const mar = -60 + ilha;
  return mar + (serra - mar) * ss(0.25, 0.75, terra);
}

/**
 * Geometria do anel: posição, normal e cor por vértice (mata, mata ao sol, pedra nas cristas, costa).
 * @returns {{ posicao: Float32Array, normal: Float32Array, cor: Float32Array, indices: Uint16Array | Uint32Array }}
 */
export function geometriaFora(T, { az = 256, rad = 20, semente = 1 } = {}) {
  const tab = terraPorDirecao(T, 360);
  const L = T ? T.passo * (T.n - 1) : 8192;
  const cx = T ? T.origem[0] + L / 2 : 0;
  const cz = T ? T.origem[1] + L / 2 : 0;
  const nv = (az + 1) * (rad + 1);
  const pos = new Float32Array(nv * 3);
  const cor = new Float32Array(nv * 3);
  const mata = linear(CORES.mata);
  const clara = linear(CORES.clara);
  const pedra = linear(CORES.pedra);
  const costa = linear(CORES.costa);
  for (let j = 0; j <= rad; j++) {
    // anéis mais juntos perto (onde a vista resolve mais)
    const t = (j / rad) ** 1.6;
    const r = ANEL_FORA.r0 + (ANEL_FORA.r1 - ANEL_FORA.r0) * t;
    for (let i = 0; i <= az; i++) {
      const a = (2 * Math.PI * i) / az + (j % 2 ? Math.PI / az : 0);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const h = alturaFora(x, z, terraEm(tab, a), semente);
      const k = j * (az + 1) + i;
      pos[3 * k] = cx + x;
      pos[3 * k + 1] = h;
      pos[3 * k + 2] = cz + z;
      const m = hashF(i, j, semente + 3);
      const crista = ss(650, 1050, h);
      const baixo = 1 - ss(5, 60, h);
      for (let q = 0; q < 3; q++) cor[3 * k + q] = (mata[q] + (clara[q] - mata[q]) * m * 0.6) * (1 - crista * 0.5) + pedra[q] * crista * 0.5;
      for (let q = 0; q < 3; q++) cor[3 * k + q] = cor[3 * k + q] * (1 - baixo) + costa[q] * baixo;
    }
  }
  const idx = new (nv > 65535 ? Uint32Array : Uint16Array)(az * rad * 6);
  let o = 0;
  for (let j = 0; j < rad; j++) {
    for (let i = 0; i < az; i++) {
      const a = j * (az + 1) + i;
      const b = a + 1;
      const c = a + az + 1;
      const d = c + 1;
      // virada para cima: o anel cresce de dentro para fora e o ângulo de +x para +z
      idx.set([a, b, c, b, d, c], o);
      o += 6;
    }
  }
  // normais pela média das faces
  const nor = new Float32Array(nv * 3);
  for (let q = 0; q < idx.length; q += 3) {
    const [ia, ib, ic] = [idx[q], idx[q + 1], idx[q + 2]];
    const ux = pos[3 * ib] - pos[3 * ia];
    const uy = pos[3 * ib + 1] - pos[3 * ia + 1];
    const uz = pos[3 * ib + 2] - pos[3 * ia + 2];
    const vx = pos[3 * ic] - pos[3 * ia];
    const vy = pos[3 * ic + 1] - pos[3 * ia + 1];
    const vz = pos[3 * ic + 2] - pos[3 * ia + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const v of [ia, ib, ic]) {
      nor[3 * v] += nx;
      nor[3 * v + 1] += ny;
      nor[3 * v + 2] += nz;
    }
  }
  for (let v = 0; v < nv; v++) {
    const l = Math.hypot(nor[3 * v], nor[3 * v + 1], nor[3 * v + 2]) || 1;
    const s = nor[3 * v + 1] < 0 ? -1 : 1;
    nor[3 * v] *= s / l;
    nor[3 * v + 1] *= s / l;
    nor[3 * v + 2] *= s / l;
  }
  return { posicao: pos, normal: nor, cor, indices: idx };
}

// ------------------------------------------------------------------------------------------------ domínio

function criarFora(ctx) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.95, metalness: 0 });
  mat.name = 'fora';
  ctx.ganchos.aplicar(mat, ['sombraLonge', 'neblina']);
  let malha = null;
  let feito = null;
  let chave = '';
  function montar(T) {
    const pf = porPerfil(PERFIL_FORA, ctx.perfil);
    const sem = sementeFora(ctx.sim.espelho.mapa?.semente);
    const k = `${pf.az}|${pf.rad}|${sem}`;
    if (T === feito && k === chave) return;
    const G = geometriaFora(T, { ...pf, semente: sem });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(G.posicao, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(G.normal, 3));
    g.setAttribute('color', new THREE.BufferAttribute(G.cor, 3));
    g.setIndex(new THREE.BufferAttribute(G.indices, 1));
    g.computeBoundingSphere();
    if (malha) {
      malha.geometry.dispose();
      malha.geometry = g;
    } else {
      malha = new THREE.Mesh(g, mat);
      malha.name = 'fora';
      malha.frustumCulled = false;
      malha.userData.faixa = 'longe';
      malha.renderOrder = 1; // com o chão: depois dos opacos de perto (o teste de profundidade descarta o coberto)
      ctx.medidas.familia(malha, 'terreno');
      ctx.cena.add(malha);
    }
    feito = T;
    chave = k;
  }
  const soltar = ctx.ouvir('qualidade', () => {
    chave = '';
    if (feito) montar(feito);
  });
  return {
    nome: 'fora',
    aplicar(d, esp) {
      if (esp.terreno && esp.terreno !== feito) montar(esp.terreno);
    },
    descartar() {
      soltar();
      if (malha) {
        ctx.cena.remove(malha);
        malha.geometry.dispose();
      }
      mat.dispose();
    },
  };
}

export function registrar(api) {
  api.registrarDominio('fora', criarFora);
}
