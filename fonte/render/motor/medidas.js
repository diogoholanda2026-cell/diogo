// R.stats (seção 2.7, fonte/contratos/render.js): soma de TODOS os passes do quadro (renderer.info.autoReset desligado
// e zerado no começo do quadro), a sombra própria à parte (callsSombra, trisSombra), triângulos por família, tempo de
// quadro (média, p95 e pior da janela de 120) e memória. Primeira versão da F0; a R1a completa (gpuMs por fenceSync,
// setores, instâncias de verdade).
import { statsVazio, FAMILIAS } from '../../contratos/render.js';

const JANELA = 120;

export class Medidas {
  /** @param {import('three').WebGLRenderer} renderer */
  constructor(renderer, { perfil = 'media', capac = null } = {}) {
    this.renderer = renderer;
    this.stats = statsVazio();
    this.stats.perfil = perfil;
    if (capac) this.stats.capac = { clipControl: capac.clipControl, multiDraw: capac.multiDraw, timer: capac.timer, limites: capac.limites };
    this._janela = []; // { calls, tris, ms }
    this._fam = Object.fromEntries(FAMILIAS.map((f) => [f, 0]));
    this._tAnt = 0;
    this._emSombra = false;
    this._sombra = { calls: 0, tris: 0 };
    this._contaMemoria = 0;
    this._passes = 0;
  }

  /** Zera os contadores do quadro (antes do primeiro passe). */
  inicio(tMs) {
    this.renderer.info.reset();
    for (const f of FAMILIAS) this._fam[f] = 0;
    this._sombra.calls = 0;
    this._sombra.tris = 0;
    this._passes = 0;
    this._t0 = tMs;
    this._c0 = typeof performance !== 'undefined' ? performance.now() : 0;
  }

  /** Mede um passe: fn() desenha; `sombra: true` conta em callsSombra e trisSombra (e na família 'sombra'). */
  passe(fn, { sombra = false } = {}) {
    const r = this.renderer.info.render;
    const c0 = r.calls;
    const t0 = r.triangles;
    fn();
    this._passes++;
    if (sombra) {
      this._sombra.calls += r.calls - c0;
      this._sombra.tris += r.triangles - t0;
    }
  }

  /**
   * Marca um objeto de uma família (FAMILIAS): os triângulos que ele desenha, em qualquer passe, entram na família.
   * Custa dois ganchos por objeto desenhado.
   */
  familia(obj, nome) {
    if (!(nome in this._fam)) throw new Error(`família fora do contrato: ${nome}`);
    const fam = this._fam;
    const info = this.renderer.info.render;
    let antes = 0;
    const b0 = obj.onBeforeRender;
    const a0 = obj.onAfterRender;
    obj.onBeforeRender = function (...a) {
      antes = info.triangles;
      b0.apply(this, a);
    };
    obj.onAfterRender = function (...a) {
      fam[nome] += info.triangles - antes;
      a0.apply(this, a);
    };
    obj.userData.familia = nome;
    return obj;
  }

  /** Fecha o quadro: lê os contadores, o tempo e a janela do pior quadro. */
  fim(tMs, { pr = 1, largura = 1, altura = 1, cenas = [] } = {}) {
    const s = this.stats;
    const r = this.renderer.info.render;
    s.calls = r.calls;
    s.tris = r.triangles;
    s.callsSombra = this._sombra.calls;
    s.trisSombra = this._sombra.tris;
    s.passes = this._passes;
    for (const f of FAMILIAS) s.familias[f] = this._fam[f];
    s.pr = pr;
    s.msCpu = (typeof performance !== 'undefined' ? performance.now() : 0) - this._c0;
    const dt = this._tAnt ? Math.min(1000, tMs - this._tAnt) : 16.7;
    this._tAnt = tMs;
    const q = { calls: s.calls, tris: s.tris, ms: dt };
    this._janela.push(q);
    if (this._janela.length > JANELA) this._janela.shift();
    let soma = 0;
    const pior = { calls: 0, tris: 0, ms: 0 };
    for (const x of this._janela) {
      soma += x.ms;
      if (x.calls > pior.calls) pior.calls = x.calls;
      if (x.tris > pior.tris) pior.tris = x.tris;
      if (x.ms > pior.ms) pior.ms = x.ms;
    }
    s.ms = +(soma / this._janela.length).toFixed(2);
    s.qps = +(1000 / Math.max(1, s.ms)).toFixed(1);
    const ord = this._janela.map((x) => x.ms).sort((a, b) => a - b);
    s.p95 = +ord[Math.min(ord.length - 1, Math.floor(ord.length * 0.95))].toFixed(2);
    s.pior = pior;
    s.pxPorTri = s.tris ? +((largura * altura * pr * pr) / s.tris).toFixed(2) : 0;
    const mem = this.renderer.info.memory;
    s.memoria.programas = this.renderer.info.programs?.length ?? 0;
    s.memoria.texturas = mem.textures;
    s.memoria.geometrias = mem.geometries;
    if (this._contaMemoria++ % 60 === 0) s.memoria.geometriaMB = +(bytesDeGeometria(cenas) / 1048576).toFixed(2);
  }
}

/** Bytes das geometrias (atributos e índices, sem repetir o mesmo buffer) das cenas. */
export function bytesDeGeometria(cenas) {
  const vistos = new Set();
  let b = 0;
  const conta = (arr) => {
    if (!arr || vistos.has(arr)) return;
    vistos.add(arr);
    b += arr.byteLength;
  };
  for (const cena of cenas) {
    cena?.traverse((o) => {
      const g = o.geometry;
      if (!g) return;
      for (const a of Object.values(g.attributes)) conta(a.array ?? a.data?.array);
      conta(g.index?.array);
      if (o.isInstancedMesh) {
        conta(o.instanceMatrix?.array);
        conta(o.instanceColor?.array);
      }
    });
  }
  return b;
}
