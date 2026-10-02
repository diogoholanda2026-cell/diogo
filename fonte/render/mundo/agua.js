// Mar, rio e lagoa (desenho do render 3.4): uma malha só (1 chamada), com o tipo por vértice.
//   mar    blocos de 64 m que têm alguma amostra de mar na grade (juntos em faixas por linha) e a moldura até 40 km
//          quando a borda do mapa é mar; nível do mar do espelho
//   lagoa  o contorno do espelho, aberto 24 m para fora (a margem de verdade é o chão cortando o plano), no nível dela
//   rio    faixa ao longo da poligonal dos pontos do espelho, com o nível por ponto, a direção da correnteza (rio
//          abaixo: para o nível mais baixo) e as coordenadas do rio por vértice (aRio: metros ao longo, posição através
//          com a margem nominal em ±1 e a meia largura), que o sombreador usa para a correnteza, a espuma das margens
//          e as pedras (R2b)
// O material lê as mesmas texturas e uniformes do terreno (ctx.chao.uniformes).
import * as THREE from 'three';
import { GLSL_AGUA_VERTICE, GLSL_AGUA_FRAGMENTO, AGUAS } from '../materiais/shaders/agua.glsl.js';
import { AGUA } from '../../contratos/flags.js';
import { pedeTudo } from '../ponte.js';

export const BLOCO_MAR = 8; // amostras (64 m)
export const MOLDURA_MAR = 40000;
export const FOLGA_MARGEM = 14; // rio: além da meia largura
export const FOLGA_LAGOA = 24; // lagoa: além do contorno (a margem rasa sobe devagar; o chão corta o plano)

// ------------------------------------------------------------------------------------------------ geometria (pura)

/**
 * Faixas de mar: blocos de BLOCO_MAR amostras com alguma amostra de mar, juntos por linha. Devolve retângulos
 * [x0, z0, x1, z1] em metros.
 */
export function faixasDeMar(T) {
  const n = T.n;
  const b = Math.ceil((n - 1) / BLOCO_MAR);
  const temMar = new Uint8Array(b * b);
  for (let j = 0; j < n; j++) {
    const bj = Math.min(b - 1, Math.floor(j / BLOCO_MAR));
    for (let i = 0; i < n; i++) if (T.agua[j * n + i] === AGUA.MAR) temMar[bj * b + Math.min(b - 1, Math.floor(i / BLOCO_MAR))] = 1;
  }
  const s = BLOCO_MAR * T.passo;
  const [ox, oz] = T.origem;
  const out = [];
  for (let bj = 0; bj < b; bj++) {
    let i = 0;
    while (i < b) {
      if (!temMar[bj * b + i]) {
        i++;
        continue;
      }
      let f = i;
      while (f + 1 < b && temMar[bj * b + f + 1]) f++;
      out.push([ox + i * s, oz + bj * s, ox + Math.min((f + 1) * s, (n - 1) * T.passo), oz + Math.min((bj + 1) * s, (n - 1) * T.passo)]);
      i = f + 1;
    }
  }
  return out;
}

/** A borda do mapa tem mar? (então a moldura de mar vai até o horizonte). */
export function bordaComMar(T) {
  const n = T.n;
  for (let k = 0; k < n; k++) {
    for (const idx of [k, (n - 1) * n + k, k * n, k * n + n - 1]) if (T.agua[idx] === AGUA.MAR) return true;
  }
  return false;
}

/** Contorno aberto para fora (normal média das arestas), no sentido em que veio. */
export function abrirContorno(xz, folga) {
  const m = xz.length / 2;
  let area = 0;
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    area += xz[2 * i] * xz[2 * j + 1] - xz[2 * j] * xz[2 * i + 1];
  }
  const s = area > 0 ? 1 : -1; // anti-horário em x-z: normal para fora = (dz, -dx)
  const out = new Float64Array(xz.length);
  for (let i = 0; i < m; i++) {
    const a = (i - 1 + m) % m;
    const c = (i + 1) % m;
    const tx = xz[2 * c] - xz[2 * a];
    const tz = xz[2 * c + 1] - xz[2 * a + 1];
    const l = Math.hypot(tx, tz) || 1;
    out[2 * i] = xz[2 * i] + ((s * tz) / l) * folga;
    out[2 * i + 1] = xz[2 * i + 1] + ((-s * tx) / l) * folga;
  }
  return out;
}

/**
 * Pontos do rio reamostrados a cada `passo` m ao longo da poligonal do espelho (a mesma que a simulação usa para
 * cavar o leito): [x, z, nivel, largura, tx, tz]; a tangente dos cantos é a média dos dois trechos.
 */
export function curvaDoRio(pontos, passo = 10) {
  const m = pontos.length / 4;
  if (m < 2) return [];
  const P = (i, k) => pontos[4 * i + k];
  const out = [];
  for (let i = 0; i < m - 1; i++) {
    const comp = Math.hypot(P(i + 1, 0) - P(i, 0), P(i + 1, 1) - P(i, 1));
    const k = Math.max(1, Math.ceil(comp / passo));
    const ult = i === m - 2 ? k : k - 1;
    for (let s = 0; s <= ult; s++) {
      const t = s / k;
      const l = (q) => P(i, q) + (P(i + 1, q) - P(i, q)) * t;
      out.push([l(0), l(1), l(2), l(3)]);
    }
  }
  for (let i = 0; i < out.length; i++) {
    const a = out[Math.max(0, i - 1)];
    const b = out[Math.min(out.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    out[i].push((b[0] - a[0]) / l, (b[1] - a[1]) / l);
  }
  return out;
}

/**
 * Sentido rio abaixo dos pontos (1 na ordem do espelho, -1 ao contrário): para o nível mais baixo; com o nível igual
 * nas pontas, a ordem em que vieram (a simulação desenha da nascente para a foz).
 */
export function sentidoDoRio(pontos) {
  const m = pontos.length / 4;
  if (m < 2) return 1;
  return pontos[4 * (m - 1) + 2] > pontos[2] + 1e-6 ? -1 : 1;
}

/** Geometria de toda a água do espelho: posição, tipo (aAgua), direção da correnteza (aFluxo) e coordenadas do rio (aRio). */
export function geometriaAgua(T, nivelMar = 0) {
  const pos = [];
  const tipo = [];
  const fluxo = [];
  const rio = [];
  const idx = [];
  const vert = (x, y, z, t, fx = 0, fz = 0, rs = 0, rl = 0, rm = 0) => {
    pos.push(x, y, z);
    tipo.push(t);
    fluxo.push(fx, fz);
    rio.push(rs, rl, rm);
    return pos.length / 3 - 1;
  };
  const quad = (x0, z0, x1, z1, y, t) => {
    const a = vert(x0, y, z0, t);
    const b = vert(x1, y, z0, t);
    const c = vert(x1, y, z1, t);
    const d = vert(x0, y, z1, t);
    idx.push(a, d, b, b, d, c);
  };
  if (T.agua) {
    for (const [x0, z0, x1, z1] of faixasDeMar(T)) quad(x0, z0, x1, z1, nivelMar, AGUAS.mar.tipo);
    if (bordaComMar(T)) {
      const [ox, oz] = T.origem;
      const L = T.passo * (T.n - 1);
      const R = MOLDURA_MAR;
      quad(-R, -R, R, oz, nivelMar, AGUAS.mar.tipo);
      quad(-R, oz + L, R, R, nivelMar, AGUAS.mar.tipo);
      quad(-R, oz, ox, oz + L, nivelMar, AGUAS.mar.tipo);
      quad(ox + L, oz, R, oz + L, nivelMar, AGUAS.mar.tipo);
    }
  }
  // o mar primeiro (grupo 0) e a água de dentro depois (grupo 1: lagoas e rios, com o programa do rio)
  const nMar = idx.length;
  for (const lg of T.lagoas ?? []) {
    const c = abrirContorno(lg.contorno, FOLGA_LAGOA);
    const pts = [];
    for (let i = 0; i < c.length / 2; i++) pts.push(new THREE.Vector2(c[2 * i], c[2 * i + 1]));
    const tri = THREE.ShapeUtils.triangulateShape(pts, []);
    const base = pos.length / 3;
    for (const p of pts) vert(p.x, lg.nivel, p.y, AGUAS.lagoa.tipo);
    for (const [a, b, d] of tri) {
      // virada para cima (+y): anti-horário visto de cima em x-z é horário no plano x-(-z)
      const ax = pts[a].x;
      const az = pts[a].y;
      const cr = (pts[b].x - ax) * (pts[d].y - az) - (pts[b].y - az) * (pts[d].x - ax);
      if (cr > 0) idx.push(base + a, base + d, base + b);
      else idx.push(base + a, base + b, base + d);
    }
  }
  for (const r of T.rios ?? []) {
    const c = curvaDoRio(r.pontos, 10);
    const sent = sentidoDoRio(r.pontos);
    // comprimento acumulado (m), contado rio abaixo
    const acum = [0];
    for (let i = 1; i < c.length; i++) acum.push(acum[i - 1] + Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]));
    const total = acum[acum.length - 1];
    const base = pos.length / 3;
    c.forEach(([x, z, nivel, larg, tx, tz], i) => {
      const meia = larg / 2;
      const m = meia + FOLGA_MARGEM;
      const sAo = sent > 0 ? acum[i] : total - acum[i];
      // aRio.y positivo do lado (fz, -fx) da correnteza f (o mesmo nos dois sentidos)
      vert(x - tz * m, nivel, z + tx * m, AGUAS.rio.tipo, tx * sent, tz * sent, sAo, (-m / meia) * sent, meia);
      vert(x + tz * m, nivel, z - tx * m, AGUAS.rio.tipo, tx * sent, tz * sent, sAo, (m / meia) * sent, meia);
    });
    for (let i = 0; i + 1 < c.length; i++) {
      const a = base + 2 * i;
      const b = a + 1;
      const d = a + 2;
      const e = a + 3;
      // normal para cima nos dois triângulos, qualquer que seja o sentido do rio
      const ux = pos[3 * b] - pos[3 * a];
      const uz = pos[3 * b + 2] - pos[3 * a + 2];
      const vx = pos[3 * d] - pos[3 * a];
      const vz = pos[3 * d + 2] - pos[3 * a + 2];
      if (uz * vx - ux * vz > 0) idx.push(a, b, d, b, e, d);
      else idx.push(a, d, b, b, d, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute('aAgua', new THREE.Float32BufferAttribute(tipo, 1));
  g.setAttribute('aFluxo', new THREE.Float32BufferAttribute(fluxo, 2));
  g.setAttribute('aRio', new THREE.Float32BufferAttribute(rio, 3));
  g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
  if (nMar) g.addGroup(0, nMar, 0);
  if (idx.length > nMar) g.addGroup(nMar, idx.length - nMar, 1);
  return g;
}

// ------------------------------------------------------------------------------------------------ material

function trocar(src, alvo, novo) {
  if (!src.includes(alvo)) throw new Error(`água: shader do three sem '${alvo}'`);
  return src.replace(alvo, novo);
}

/**
 * Material da água. Com `dentro`, o programa da água de dentro (lagoas e rios) leva o bloco do rio (AGUA_RIO); o do
 * mar não: o desvio por tipo na GPU é por triângulo, mas o bloco do rio pesava nos registradores de todo o mar.
 */
export function criarMaterialAgua(ganchos, U, dentro = false) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.06, metalness: 0 });
  mat.name = dentro ? 'agua-dentro' : 'agua';
  if (dentro) mat.defines = { AGUA_RIO: '' };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    let vs = shader.vertexShader;
    vs = trocar(vs, '#include <common>', `#include <common>\n${GLSL_AGUA_VERTICE.pars}`);
    vs = trocar(vs, '#include <begin_vertex>', `#include <begin_vertex>\n${GLSL_AGUA_VERTICE.main}`);
    let fs = shader.fragmentShader;
    fs = trocar(fs, '#include <common>', `#include <common>\n${GLSL_AGUA_FRAGMENTO.pars}`);
    fs = trocar(fs, '#include <map_fragment>', GLSL_AGUA_FRAGMENTO.cor);
    fs = trocar(fs, '#include <roughnessmap_fragment>', GLSL_AGUA_FRAGMENTO.rugosidade);
    fs = trocar(fs, '#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${GLSL_AGUA_FRAGMENTO.normal}`);
    fs = trocar(fs, '#include <aomap_fragment>', `#include <aomap_fragment>\n${GLSL_AGUA_FRAGMENTO.indireta}`);
    fs = trocar(fs, '#include <dithering_fragment>', `#include <dithering_fragment>\n${GLSL_AGUA_FRAGMENTO.mascara}`);
    shader.vertexShader = vs;
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => (dentro ? 'agua-dentro' : 'agua');
  return ganchos.aplicar(mat, ['sombra', 'sombraLonge', 'hao', 'noite', 'neblina']);
}

// ------------------------------------------------------------------------------------------------ domínio

function criarAgua(ctx) {
  const chao = ctx.chao ?? ctx.dominio('terreno')?.chao ?? null;
  if (!chao) return { nome: 'agua' }; // sem o terreno (cena que desenha sozinha), sem água
  const U = {
    ...chao.uniformes,
    uAguaOndas: { value: ctx.textura('chao.ondas') },
    uAguaTempo: { value: 0 },
    uAguaCeuH: { value: new THREE.Color(0.62, 0.7, 0.8) },
    uAguaCeuZ: { value: new THREE.Color(0.3, 0.45, 0.7) },
  };
  const mat = [criarMaterialAgua(ctx.ganchos, U), criarMaterialAgua(ctx.ganchos, U, true)];
  const soltar = ctx.ouvir('qualidade', () => (U.uAguaOndas.value = ctx.textura('chao.ondas')));
  let malha = null;
  let feito = null;
  const cor = new THREE.Color();
  function montar(esp) {
    const g = geometriaAgua(esp.terreno, esp.mapa?.nivelMar ?? 0);
    if (malha) {
      malha.geometry.dispose();
      malha.geometry = g;
    } else {
      malha = ctx.medidas.familia(new THREE.Mesh(g, mat), 'resto');
      malha.name = 'agua';
      malha.frustumCulled = false;
      ctx.cena.add(malha);
    }
    feito = esp.terreno;
  }
  return {
    nome: 'agua',
    aplicar(d, esp) {
      if (!esp.terreno) return;
      if (esp.terreno !== feito || pedeTudo(d, 'terreno')) montar(esp);
    },
    quadro(tMs, c) {
      U.uAguaTempo.value = (tMs / 1000) % 100000;
      // sem IBL, o reflexo usa a cor do céu da cena (o fundo) e a da neblina no horizonte
      const bg = c.cena.background;
      if (bg?.isColor) {
        U.uAguaCeuZ.value.copy(bg);
        const nb = c.ganchos.uniformes.gNeblinaCor?.value;
        U.uAguaCeuH.value.copy(nb?.isColor ? nb : cor.copy(bg).multiplyScalar(1.15));
      }
    },
    descartar() {
      soltar();
      if (malha) {
        ctx.cena.remove(malha);
        malha.geometry.dispose();
      }
      for (const m of mat) m.dispose();
    },
  };
}

export function registrar(api) {
  api.registrarDominio('agua', criarAgua);
}
