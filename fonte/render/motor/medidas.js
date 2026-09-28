// R.stats (seção 2.7, fonte/contratos/render.js): soma de TODOS os passes do quadro (renderer.info.autoReset desligado
// e zerado no começo do quadro: sombra própria, faces do céu, PMREM, cena, bloom e composição), a sombra própria à
// parte (callsSombra, trisSombra), triângulos por família, tempo de quadro (média, p95 e pior da janela de 120) e
// memória. O ms de GPU sai de uma cerca (fenceSync) no fim do quadro: pelo WebGL2 o estado dela só muda entre
// tarefas, então a espera é por mensagens (MessageChannel) e o valor é o tempo até a GPU terminar o quadro. Com
// EXT_disjoint_timer_query_webgl2 sai também o tempo de placa medido pela própria placa (o Cronometro): o quadro
// inteiro (gpuMsTimer, que alimenta a resolução dinâmica dos perfis de PC) e, na página de teste, por passe
// (gpuPasses: sombra, preparo, céu, terreno, água, prédios, vias, Arcologia, pós...), com cada desenho da cena
// classificado pelo material e pela família do objeto. A cerca só corre quando pedida (R.estado('teste'), a bancada,
// a página de teste); o cronômetro também nos perfis com resolução dinâmica pela placa (uma consulta por quadro).
// Desde a PC1 (D66) também: a memória de vídeo estimada (capacidades.js, vigiarMemoria), as compilações depois de
// pronto (vigiarProgramas) e o aquecimento (quadro.js).
import { statsVazio, FAMILIAS } from '../../contratos/render.js';

const JANELA = 120;
/** Quadros da média por passe do cronômetro. */
const JANELA_PASSES = 60;
/** Trechos por quadro no máximo (um quadro patológico não esgota as consultas). */
const TRECHOS_MAX = 256;
const agora = () => (typeof performance !== 'undefined' ? performance.now() : 0);

/** Passes do quadro no cronômetro da placa, na ordem da página de teste. */
export const PASSES_GPU = Object.freeze(['sombra', 'preparo', 'ceu', 'terreno', 'agua', 'predios', 'colocaveis', 'arvores', 'vias', 'vida', 'arcologia', 'resto', 'pos', 'outros']);

const AGUA = /(?:^|[:_\s-])agua(?:$|[:_\s-])/i;

/**
 * Passe de um desenho da cena: a água pelo nome do material ou do objeto (o mar, a lagoa e o lago da Arcologia pesam
 * por pixel), senão a família marcada por medidas.familia no objeto ou num ancestral, senão 'resto'.
 */
export function classeDoDesenho(obj, mat) {
  if (AGUA.test(mat?.name || '') || AGUA.test(obj?.name || '')) return 'agua';
  for (let o = obj; o; o = o.parent) {
    const f = o.userData?.familia;
    if (f) return f === 'sombra' ? 'resto' : f;
  }
  return 'resto';
}

/**
 * Cronômetro da placa (EXT_disjoint_timer_query_webgl2): cada quadro vira trechos com rótulo (uma consulta
 * TIME_ELAPSED por trecho, sem aninhar), colhidos uns quadros depois, quando a placa termina. Um GPU_DISJOINT (troca
 * de frequência, outra aba) joga fora o que estava no ar.
 */
export class Cronometro {
  /** @param {WebGL2RenderingContext} gl  @param {object} ext  a extensão */
  constructor(gl, ext) {
    this.gl = gl;
    this.ext = ext;
    this.livres = [];
    this.pendentes = [];
    this.quadro = null;
    this.aberto = null;
    this.rotulo = null;
  }

  /** Começo de um quadro (info vai junto no resultado: a razão de pixels e o tempo). */
  comecar(info) {
    if (this.quadro) this.terminar();
    this.quadro = { info, trechos: [] };
    this._abrir('outros');
  }

  /** Troca o trecho aberto (sem efeito se o rótulo é o mesmo). */
  marcar(rotulo) {
    if (!this.quadro || rotulo === this.rotulo || this.quadro.trechos.length >= TRECHOS_MAX) return;
    this._fechar();
    this._abrir(rotulo);
  }

  terminar() {
    if (!this.quadro) return;
    this._fechar();
    this.pendentes.push(this.quadro);
    this.quadro = null;
    // resultados que não chegam (aba escondida): recicla os mais velhos
    while (this.pendentes.length > 10) this._reciclar(this.pendentes.shift());
  }

  /**
   * Quadros prontos, em ordem: [{ info, total, porRotulo: { rotulo: ms } }]. Chame fora de um quadro aberto.
   */
  colher() {
    const { gl, ext } = this;
    const prontos = [];
    if (!this.pendentes.length) return prontos;
    if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
      for (const q of this.pendentes) this._reciclar(q);
      this.pendentes.length = 0;
      return prontos;
    }
    while (this.pendentes.length) {
      const q = this.pendentes[0];
      const ultimo = q.trechos[q.trechos.length - 1]?.[1];
      if (ultimo && !gl.getQueryParameter(ultimo, gl.QUERY_RESULT_AVAILABLE)) break;
      this.pendentes.shift();
      const porRotulo = {};
      let total = 0;
      for (const [r, c] of q.trechos) {
        const ms = gl.getQueryParameter(c, gl.QUERY_RESULT) / 1e6;
        porRotulo[r] = (porRotulo[r] ?? 0) + ms;
        total += ms;
      }
      this._reciclar(q);
      prontos.push({ info: q.info, total, porRotulo });
    }
    return prontos;
  }

  descartar() {
    if (this.quadro) this.terminar();
    for (const q of this.pendentes) this._reciclar(q);
    this.pendentes.length = 0;
    for (const c of this.livres) this.gl.deleteQuery(c);
    this.livres.length = 0;
  }

  _abrir(rotulo) {
    const c = this.livres.pop() ?? this.gl.createQuery();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, c);
    this.aberto = c;
    this.rotulo = rotulo;
  }

  _fechar() {
    if (!this.aberto) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.quadro.trechos.push([this.rotulo, this.aberto]);
    this.aberto = null;
    this.rotulo = null;
  }

  _reciclar(q) {
    for (const [, c] of q.trechos) this.livres.push(c);
    q.trechos.length = 0;
  }
}

export class Medidas {
  /** @param {import('three').WebGLRenderer} renderer */
  constructor(renderer, { perfil = 'media', capac = null } = {}) {
    this.renderer = renderer;
    this.capac = capac;
    this.stats = statsVazio();
    this.stats.perfil = perfil;
    this.stats.gpuMsTimer = 0;
    this.stats.gpuPasses = {};
    this.stats.gpuQuadros = 0;
    this.stats.compilacoes = { programas: 0, depois: 0, nomes: [] };
    this.stats.aquecimento = null;
    this.stats.resolucao = null;
    Object.assign(this.stats.memoria, { videoMB: 0, texturasGpuMB: 0, alvosMB: 0, buffersMB: 0, telaMB: 0 });
    if (capac) this.stats.capac = { clipControl: capac.clipControl, multiDraw: capac.multiDraw, timer: capac.timer, limites: capac.limites };
    this._janela = []; // { calls, tris, ms }
    this._fam = Object.fromEntries(FAMILIAS.map((f) => [f, 0]));
    this._tAnt = 0;
    this._sombra = { calls: 0, tris: 0 };
    this._contaMemoria = 0;
    this._passes = 0;
    this.gpu = false; // cerca e cronômetro (teste, bancada, página de teste)
    this.cronometrar = false; // só o cronômetro (resolução dinâmica dos perfis de PC)
    this.porPasse = false; // trechos por passe no cronômetro (página de teste)
    /** fn(ms, info) a cada quadro que o cronômetro devolve (info: { pr, tMs } do quadro medido). */
    this.aoCronometro = null;
    this._cron = undefined; // Cronometro | null (sem a extensão)
    this._cronAtivo = false;
    this._classificar = false;
    this._embrulhado = false;
    this._cercas = [];
    this._gpuMs = [];
    this._gpuTimer = [];
    this._passesJanela = [];
    this._passesSoma = {};
    this._laco = null;
  }

  /** Esquece a janela do pior quadro (depois da carga: compilação, primeiro cubo e primeira luz do ambiente). */
  zerarJanela() {
    this._janela.length = 0;
  }

  /** Zera os contadores do quadro (antes do primeiro passe). */
  inicio(tMs) {
    this.renderer.info.reset();
    for (const f of FAMILIAS) this._fam[f] = 0;
    this._sombra.calls = 0;
    this._sombra.tris = 0;
    this._passes = 0;
    this._t0 = tMs;
    this._c0 = agora();
    const cron = this.gpu || this.cronometrar ? this._cronometro() : null;
    this._cronAtivo = !!cron;
    if (cron) cron.comecar({ pr: this.renderer.getPixelRatio?.() ?? 1, tMs });
  }

  /** Rótulo do trecho seguinte no cronômetro por passe (PASSES_GPU); sem efeito fora da página de teste. */
  marcar(rotulo) {
    if (this.porPasse && this._cronAtivo) this._cron.marcar(rotulo);
  }

  /** Liga (true) ou desliga a classificação de cada desenho da cena pelo passe (só com o cronômetro por passe). */
  classificar(ligado) {
    this._classificar = !!ligado && this.porPasse && this._cronAtivo;
    if (this._classificar && !this._embrulhado) this._embrulhar();
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
    if (this._cronAtivo) this._cron.terminar();
    this._cronAtivo = false;
    this._classificar = false;
    if (this._cron) this._colher();
    if (this.gpu) this._cerca();
    s.calls = r.calls;
    s.tris = r.triangles;
    s.callsSombra = this._sombra.calls;
    s.trisSombra = this._sombra.tris;
    s.passes = this._passes;
    for (const f of FAMILIAS) s.familias[f] = this._fam[f];
    s.pr = pr;
    s.msCpu = +(agora() - this._c0).toFixed(2);
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
    if (this._contaMemoria++ % 60 === 0) {
      s.memoria.geometriaMB = +(bytesDeGeometria(cenas) / 1048576).toFixed(2);
      const v = this.capac?.memoria?.mb?.();
      if (v) Object.assign(s.memoria, { videoMB: v.videoMB, texturasGpuMB: v.texturasMB, alvosMB: v.alvosMB, buffersMB: v.buffersMB, telaMB: v.telaMB });
    }
    this._contarCompilacoes();
  }

  /** Descarta as consultas do cronômetro. */
  descartar() {
    this._cron?.descartar();
    this._cron = null;
  }

  // ---------------------------------------------------------------------------------------- compilações

  _contarCompilacoes() {
    const v = this.capac?.programas;
    const c = this.stats.compilacoes;
    const depois = v?.depois?.length ?? 0;
    if (!v || (v.lista.length === c.programas && depois === c.depois)) return;
    c.programas = v.lista.length;
    c.depois = depois;
    c.nomes = (v.depois ?? []).map((p) => p.nome);
  }

  // ---------------------------------------------------------------------------------------- ms de GPU

  _gl() {
    return this.renderer.getContext();
  }

  _cronometro() {
    if (this._cron === undefined) {
      const ext = this.renderer.extensions?.get?.('EXT_disjoint_timer_query_webgl2') || null;
      this._cron = ext ? new Cronometro(this._gl(), ext) : null;
    }
    return this._cron;
  }

  // cada desenho da cena troca o trecho pelo passe dele (a água, a família); só enquanto classificar estiver ligado
  _embrulhar() {
    const r = this.renderer;
    const orig = r.renderBufferDirect;
    if (typeof orig !== 'function') return;
    this._embrulhado = true;
    const med = this;
    r.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
      if (med._classificar && med._cronAtivo) med._cron.marcar(classeDoDesenho(object, material));
      return orig.call(this, camera, scene, geometry, material, object, group);
    };
  }

  _colher() {
    for (const q of this._cron.colher()) {
      this._empurrar(this._gpuTimer, q.total, 'gpuMsTimer');
      if (this.porPasse) this._somarPasses(q.porRotulo);
      if (this.aoCronometro) {
        try {
          this.aoCronometro(q.total, q.info);
        } catch (e) {
          console.error('render: resolução pelo cronômetro falhou:', e);
        }
      }
    }
  }

  // média por quadro de cada passe na janela (um passe que não houve no quadro conta 0: a sombra refeita às vezes)
  _somarPasses(porRotulo) {
    const J = this._passesJanela;
    const S = this._passesSoma;
    J.push(porRotulo);
    for (const [k, ms] of Object.entries(porRotulo)) S[k] = (S[k] ?? 0) + ms;
    if (J.length > JANELA_PASSES) for (const [k, ms] of Object.entries(J.shift())) S[k] -= ms;
    const g = {};
    for (const k of PASSES_GPU) if (S[k] > 1e-6) g[k] = +(S[k] / J.length).toFixed(3);
    this.stats.gpuPasses = g;
    this.stats.gpuQuadros = J.length;
  }

  _cerca() {
    const gl = this._gl();
    if (typeof gl.fenceSync !== 'function' || this._cercas.length > 4) return;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) return;
    gl.flush();
    this._cercas.push({ sync, t0: agora() });
    this._esperar();
  }

  // o estado da cerca só muda entre tarefas (WebGL2): olha de novo a cada mensagem até sinalizar
  _esperar() {
    if (this._laco || typeof MessageChannel === 'undefined') return;
    const canal = new MessageChannel();
    this._laco = canal;
    canal.port1.onmessage = () => {
      const gl = this._gl();
      while (this._cercas.length) {
        const c = this._cercas[0];
        const st = gl.getSyncParameter(c.sync, gl.SYNC_STATUS);
        if (st !== gl.SIGNALED) break;
        this._empurrar(this._gpuMs, agora() - c.t0, 'gpuMs');
        gl.deleteSync(c.sync);
        this._cercas.shift();
      }
      if (this._cercas.length && this.gpu) canal.port2.postMessage(0);
      else {
        for (const c of this._cercas) gl.deleteSync(c.sync);
        this._cercas.length = 0;
        canal.port1.close();
        this._laco = null;
      }
    };
    canal.port2.postMessage(0);
  }

  _empurrar(lista, ms, campo) {
    lista.push(ms);
    if (lista.length > 60) lista.shift();
    const ord = [...lista].sort((a, b) => a - b);
    this.stats[campo] = +ord[Math.floor(ord.length / 2)].toFixed(2); // mediana da janela
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

export function registrar() {}
