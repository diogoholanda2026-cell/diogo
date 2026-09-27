// Mar, rio e lagoa (desenho do render 3.4): uma malha só (1 chamada), com o tipo por vértice.
//   mar    blocos de 64 m que têm alguma amostra de mar na grade (juntos em faixas por linha) e a moldura até 40 km
//          quando a borda do mapa é mar; nível do mar do espelho
//   lagoa  o contorno do espelho, aberto 24 m para fora (a margem de verdade é o chão cortando o plano), no nível dela
//   rio    faixa ao longo da poligonal dos pontos do espelho, com o nível por ponto e a direção da correnteza por vértice
//          (a R2b herda e acrescenta a correnteza e a espuma do rio)
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

/** Geometria de toda a água do espelho: posição, tipo (aAgua) e direção da correnteza (aFluxo). */
export function geometriaAgua(T, nivelMar = 0) {
  const pos = [];
  const tipo = [];
  const fluxo = [];
  const idx = [];
  const vert = (x, y, z, t, fx = 0, fz = 0) => {
    pos.push(x, y, z);
    tipo.push(t);
    fluxo.push(fx, fz);
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
    const base = pos.length / 3;
    for (const [x, z, nivel, larg, tx, tz] of c) {
      const m = larg / 2 + FOLGA_MARGEM;
      vert(x - tz * m, nivel, z + tx * m, AGUAS.rio.tipo, tx, tz);
      vert(x + tz * m, nivel, z - tx * m, AGUAS.rio.tipo, tx, tz);
    }
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
  g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
  return g;
}

// ------------------------------------------------------------------------------------------------ material

function trocar(src, alvo, novo) {
  if (!src.includes(alvo)) throw new Error(`água: shader do three sem '${alvo}'`);
  return src.replace(alvo, novo);
}

export function criarMaterialAgua(ganchos, U) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.06, metalness: 0 });
  mat.name = 'agua';
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
  mat.customProgramCacheKey = () => 'agua';
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
  const mat = criarMaterialAgua(ctx.ganchos, U);
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
      mat.dispose();
    },
  };
}

export function registrar(api) {
  api.registrarDominio('agua', criarAgua);
}
