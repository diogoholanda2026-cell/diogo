// Quadro do render (desenho do render 1.4): limite de quadros pelo estado da tela e pelo perfil, tamanho da tela e a
// ordem dos passes de um quadro:
//   1. passes raros em fatias do ambiente (uma fatia de face do cubo do céu, um quadro-chave da luz do ambiente e a
//      mistura) e os dos domínios em ctx.quadro.antes (o campo da sombra de longe e do HAO, o mapa de luz da rua):
//      entram em R.stats;
//   2. sombra própria (D43), só quando suja;
//   3. a cena no alvo HDR com MSAA, numa faixa de profundidade (invertida) ou em duas (sem EXT_clip_control,
//      motor/faixas.js); o fundo do céu vai na própria cena, depois dos opacos e no plano distante (ceu.js, PC2);
//   4. composição na tela: bloom, exposição, AgX, CAS (sempre que o desenho interno é menor que a tela, na medida da
//      ampliação) e pontilhado (motor/pos.js). O Leve desenha direto na tela.
// Mede cada passe (R.stats soma todos; na página de teste o cronômetro da placa separa sombra, preparo, céu, cada
// família da cena, água e pós) e ajusta a resolução dinâmica em degraus (motor/resolucao.js: pelo cronômetro da placa
// nos perfis de PC, pelo tempo de quadro nos outros). O 'pc' tem teto de 60 qps (tetoQps).
// Aquecimento (D66): nenhum programa compila depois de "pronto". No primeiro quadro, com o ambiente e o alvo da cena
// prontos, o renderer.compileAsync do three (KHR_parallel_shader_compile) compila domínio por domínio: a cena da
// sombra no alvo dela e cada filho da cena (um domínio por grupo) no alvo HDR, com o mesmo tom do quadro, mais o que
// os domínios pedirem em ctx.quadro.aquecer (um Set: add(objeto | lista | () => objetos), para o que ainda não está na
// cena, como a etapa seguinte da Arcologia). Uma segunda rodada pega o que os domínios trouxeram na carga (depois de
// 2,5 s, com prédios e vias prontos, ou aos 12 s); quando ela termina, o vigia (capacidades.js) passa a contar cada
// programa novo como compilação depois de pronto.
// A sombra própria mora em render/sombra/mapa.js; a classe segue exportada daqui para o índice do render.
import * as THREE from 'three';
import { Pos, forcaCas } from './pos.js';
import { Resolucao } from './resolucao.js';
import { Faixas } from './faixas.js';
import { marcarPronto, desmarcarPronto, paginaDeTeste } from './capacidades.js';

export { SombraPropria } from '../sombra/mapa.js';

/** Quadros da carga que ficam fora da janela do pior quadro. */
export const AQUECIMENTO = 3;

/** Quadros por segundo máximos por estado da tela (R.estado); o perfil pode pôr um teto (tetoQps). */
export const TETO_QPS = Object.freeze({ livre: 0, coberto: 10, foto: 0, teste: 0 });

/** Tolerância do teto de qps: um quadro até 1 ms adiantado ainda desenha (o rAF oscila em volta do intervalo). */
const FOLGA_MS = 1;

/** Rodadas do aquecimento: a final depois de esperaMs com os domínios carregados, ou aos tetoMs. */
export const AQUECER = Object.freeze({ esperaMs: 2500, tetoMs: 12000, dominios: ['predios', 'vias'] });

const agora = () => (typeof performance !== 'undefined' ? performance.now() : 0);

/**
 * Ritmo do teto de qps (puro): a média fica no teto, sem acumular atraso nem rajada. Depois de um quadro, o próximo
 * vem um intervalo depois do previsto, nunca mais de um intervalo depois deste; atrasado (ou o primeiro), um
 * intervalo inteiro a partir de agora. Num monitor de 144 Hz com teto de 60, desenha 2 ou 3 atualizações e fica nos
 * 60 na média; a 60 Hz (mesmo com o rAF adiantado meio milissegundo) nunca pula um quadro.
 */
export class Ritmo {
  constructor() {
    this.proximo = -Infinity;
  }

  /** true se o quadro em tMs deve desenhar com o teto (0 = sem teto). */
  vez(tMs, teto) {
    return !teto || tMs >= this.proximo - FOLGA_MS;
  }

  /** Um quadro desenhado em tMs. */
  desenhou(tMs, teto) {
    if (!teto) return;
    const I = 1000 / teto;
    const p = Math.min(this.proximo + I, tMs + I);
    this.proximo = p < tMs ? tMs + I : p;
  }
}

/** Objetos de uma fonte do aquecimento: um Object3D, uma lista ou uma função que devolve um deles. */
function objetosDa(f) {
  const v = typeof f === 'function' ? f() : f;
  return (Array.isArray(v) ? v : [v]).filter((o) => o?.isObject3D);
}

const nomeDoGrupo = (o) => o.name || o.userData?.familia || o.type || 'objeto';

/**
 * Aquecimento dos programas (D66): compila na carga tudo o que a cena tem (mesmo o escondido ou fora da vista, que
 * compilaria no meio do jogo ao aparecer) e marca "pronto" no vigia. Um Set de fontes: os domínios põem o que ainda
 * não está na cena (o objeto de verdade: o programa depende do tipo, das instâncias e dos atributos).
 */
export class Aquecimento {
  constructor(ctx, op = {}) {
    this.ctx = ctx;
    this.op = { ...AQUECER, ...op };
    this.fontes = new Set();
    this.estado = 'espera'; // 'espera' | 'aquecendo' | 'pronto'
    this.rodadas = 0;
    this.grupos = [];
    this.ms = 0;
    this.programas = 0;
    this.t0 = null;
    this._c0 = 0;
    this._perfil = null;
    this._pendente = null;
    this._novas = false;
    this._geracao = 0; // sobe a cada troca de perfil: a rodada que ainda estava no ar deixa de valer
    this._resolvida = false;
    this.msThread = 0; // a parte síncrona das rodadas (a thread parada montando os programas)
    this.promessa = new Promise((ok) => (this._ok = ok));
  }

  /** Fonte de um domínio (Object3D, lista ou função); depois de pronto, entra na rodada seguinte. */
  add(f) {
    this.fontes.add(f);
    if (this.estado === 'pronto') this._novas = true;
    return this;
  }

  delete(f) {
    return this.fontes.delete(f);
  }

  has(f) {
    return this.fontes.has(f);
  }

  get pronto() {
    return this.estado === 'pronto';
  }

  /** Relatório para R.stats e a página de teste. */
  relatorio() {
    return { estado: this.estado, rodadas: this.rodadas, ms: Math.round(this.ms), msThread: Math.round(this.msThread), programas: this.programas, fontes: this.fontes.size, grupos: this.grupos };
  }

  /**
   * Um quadro desenhado, com o alvo da cena já garantido. alvo: { alvo: WebGLRenderTarget | null, tom } do quadro.
   * @returns {boolean} true se começou uma rodada neste quadro
   */
  quadro(tMs, alvo) {
    const ctx = this.ctx;
    if (ctx.perfil !== this._perfil) {
      const troca = this._perfil !== null;
      this._perfil = ctx.perfil;
      if (troca) this._reiniciar();
    }
    if (this._pendente) return false;
    if (this.estado === 'pronto') {
      if (!this._novas) return false;
      this._novas = false;
      return this._rodada(alvo, 'extra');
    }
    if (this.rodadas === 0) {
      this.t0 = tMs;
      this._c0 = agora();
      return this._rodada(alvo, 'primeira');
    }
    const dt = tMs - this.t0;
    if ((dt >= this.op.esperaMs && this._carregados()) || dt >= this.op.tetoMs) return this._rodada(alvo, 'final');
    return false;
  }

  // prédios e vias com o que a vista pede (os setores da oficina chegam nos primeiros segundos)
  _carregados() {
    return this.op.dominios.every((n) => {
      try {
        const d = this.ctx.dominio?.(n);
        return typeof d?.pronto === 'function' ? !!d.pronto() : true;
      } catch (e) {
        return true;
      }
    });
  }

  // troca de perfil (R.qualidade): os programas novos dela são da carga, não soluço. A rodada no ar deixa de valer
  // (não marca pronto com os programas do perfil de antes); quem ainda espera a promessa recebe o aquecimento novo
  _reiniciar() {
    this._geracao++;
    this._pendente = null;
    this.estado = 'espera';
    this.rodadas = 0;
    this.programas = 0;
    this.ms = 0;
    this.msThread = 0;
    this._novas = false;
    desmarcarPronto(this.ctx.capac?.programas);
    if (this._resolvida) {
      this._resolvida = false;
      this.promessa = new Promise((ok) => (this._ok = ok));
    }
    this._publicar();
  }

  _rodada(alvo, tipo) {
    const { renderer, cena, camera, sombra } = this.ctx;
    this.rodadas++;
    if (tipo !== 'extra') this.estado = 'aquecendo';
    const n0 = this.ctx.capac?.programas?.lista?.length ?? 0;
    const g = this._geracao;
    const t0 = agora();
    const grupos = [];
    if (typeof renderer?.compileAsync === 'function' && cena) {
      const compilar = (nome, obj, cam, destino) => {
        try {
          grupos.push({ nome, p: renderer.compileAsync(obj, cam, destino) });
        } catch (e) {
          console.warn(`render: aquecimento de ${nome} falhou:`, e);
        }
      };
      // o programa depende do alvo (espaço de cor e tom): cada cena compila no alvo em que desenha
      const antesAlvo = renderer.getRenderTarget();
      const antesTom = renderer.toneMapping;
      try {
        if (sombra?.cena && sombra.alvo && sombra.ligada !== false) {
          renderer.setRenderTarget(sombra.alvo);
          compilar('sombra', sombra.cena, sombra.cams?.[0] ?? camera, sombra.cena);
        }
        renderer.setRenderTarget(alvo?.alvo ?? null);
        if (alvo?.tom !== undefined) renderer.toneMapping = alvo.tom;
        for (const filho of [...cena.children]) compilar(nomeDoGrupo(filho), filho, camera, cena);
        // uma cena à parte (um passe fora da cena principal, como a suavização da luz da noite) compila com as luzes
        // dela: o número de luzes entra na chave do programa, e com as da cena principal ele compilaria de novo no uso
        for (const f of this.fontes) for (const o of objetosDa(f)) compilar(nomeDoGrupo(o), o, camera, o.isScene ? o : cena);
      } finally {
        renderer.setRenderTarget(antesAlvo);
        renderer.toneMapping = antesTom;
      }
    }
    this.msThread += agora() - t0;
    const fim = (nome, erro = null) => ({ nome, ms: +(agora() - t0).toFixed(1), ...(erro ? { erro: String(erro?.message ?? erro) } : {}) });
    const pendente = Promise.all(grupos.map((x) => Promise.resolve(x.p).then(() => fim(x.nome), (e) => fim(x.nome, e)))).then((lista) => this._terminar(lista, tipo, n0, g, pendente));
    this._pendente = pendente;
    this._publicar();
    return true;
  }

  _terminar(lista, tipo, n0, g, pendente) {
    if (this._pendente === pendente) this._pendente = null;
    if (g !== this._geracao) return; // o perfil trocou no meio da rodada
    const vigia = this.ctx.capac?.programas;
    this.programas += Math.max(0, (vigia?.lista?.length ?? 0) - n0);
    this.grupos = lista.sort((a, b) => b.ms - a.ms).slice(0, 10);
    if (tipo !== 'extra') this.ms = agora() - this._c0;
    if (tipo === 'final') {
      this.estado = 'pronto';
      marcarPronto(vigia, this.ctx.quadro?.desenhados ?? 0);
      const rel = this.relatorio();
      this._resolvida = true;
      this._ok(rel);
      this.ctx.emitir?.('aquecido', rel);
    }
    this._publicar();
  }

  _publicar() {
    const s = this.ctx.medidas?.stats;
    if (s) s.aquecimento = this.relatorio();
  }
}

/**
 * Laço de desenho de um quadro.
 * @param {object} ctx  contexto do render (index.js): renderer, cena, camera, sombra, medidas, ganchos, perfil, pr
 */
export class Quadro {
  constructor(ctx) {
    this.ctx = ctx;
    this.estado = 'livre';
    this._ultimo = 0;
    this.ritmo = new Ritmo();
    this.desenhados = 0;
    this.w = 1;
    this.h = 1;
    this._medir = true;
    this._tAtual = 0;
    ctx.quadro = this;
    ctx.tela = { w: 1, h: 1 };
    // sem EXT_clip_control, ou com ?semClip=1, a profundidade invertida sai e entram as duas faixas
    const prof = ctx.renderer.state?.buffers?.depth;
    if (ctx.semClip && prof?.getReversed?.()) prof.setReversed(false);
    // a sonda e a bancada relatam a profundidade que o quadro usa de fato, não a que o aparelho aceita
    if (ctx.capac) ctx.capac.invertida = !!prof?.getReversed?.();
    this.pos = new Pos(ctx);
    this.resolucao = new Resolucao(ctx);
    this.faixas = new Faixas(ctx);
    this.aquecimento = new Aquecimento(ctx);
    /** Fontes do aquecimento dos domínios: ctx.quadro.aquecer.add(objeto | lista | () => objetos). */
    this.aquecer = this.aquecimento;
    // passes dos domínios antes da cena: fn(renderer, medidas, tMs), depois de medidas.inicio (contam no quadro)
    this.antes = new Set();
    this._corLimpa = new THREE.Color(0, 0, 0);
    this._db = new THREE.Vector2();
    this._alvoCena = { alvo: null, tom: THREE.NoToneMapping };
    this._porPasse = paginaDeTeste();
    // o cronômetro da placa devolve o ms de um quadro uns quadros depois: vai para a resolução dinâmica
    if (ctx.medidas) {
      ctx.medidas.aoCronometro = (ms, info) => {
        if (this.resolucao.amostraGpu(ms, info?.pr ?? ctx.pr, this._tAtual, this.estado)) this._medir = true;
      };
    }
    // mede a tela só quando ela muda (ler o layout a cada quadro força o navegador a refazê-lo depois da interface)
    this._aoMudarTela = () => (this._medir = true);
    if (typeof addEventListener !== 'undefined') addEventListener('resize', this._aoMudarTela);
  }

  /**
   * Tamanho da tela em px CSS (no começo do quadro, só depois de um resize, de trocar a razão de pixels ou o perfil);
   * a resolução dinâmica acerta os degraus pela tela (o 'pc' tem o teto de 1080p).
   */
  medirTela() {
    const { renderer, camera, canvas } = this.ctx;
    if (!this._medir && renderer.getPixelRatio() === this.ctx.pr && this.ctx.perfil === this._perfilTela) return;
    this._medir = false;
    this._perfilTela = this.ctx.perfil;
    const w = Math.max(1, canvas.clientWidth || (typeof innerWidth !== 'undefined' ? innerWidth : 1));
    const h = Math.max(1, canvas.clientHeight || (typeof innerHeight !== 'undefined' ? innerHeight : 1));
    this.ctx.tela.w = w;
    this.ctx.tela.h = h;
    this.resolucao.conferir();
    if (w !== this.w || h !== this.h || renderer.getPixelRatio() !== this.ctx.pr) {
      this.w = w;
      this.h = h;
      renderer.setPixelRatio(this.ctx.pr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  /**
   * Força do CAS (PC2): sempre que o desenho interno é menor que a tela (o teto de pixels do 'pc' numa tela maior que
   * 1080p ou a resolução dinâmica abaixo do nominal), na medida da ampliação (forcaCas, motor/pos.js).
   */
  get cas() {
    if (!this.ctx.perfil.pos) return 0;
    const dpr = this.resolucao.dpr || 1;
    return Math.max(forcaCas(dpr / (this.ctx.pr || dpr)), this.resolucao.cas);
  }

  /** Teto de qps do momento: o do estado da tela e o do perfil (0 = sem teto). */
  get teto() {
    const e = TETO_QPS[this.estado] || 0;
    const p = this.estado === 'livre' ? this.ctx.perfil?.tetoQps || 0 : 0;
    return e && p ? Math.min(e, p) : e || p;
  }

  /** true se este quadro deve ser desenhado (teto de qps do estado e do perfil). */
  vez(tMs) {
    return this.ritmo.vez(tMs, this.teto);
  }

  /** Desenha um quadro inteiro, medindo cada passe. */
  desenhar(tMs) {
    const ctx = this.ctx;
    const { renderer, cena, camera, sombra, medidas, ganchos } = ctx;
    this._tAtual = tMs;
    this._ultimo = tMs;
    this.ritmo.desenhou(tMs, this.teto);
    if (this.resolucao.medir(tMs, this.estado)) this._medir = true;
    medidas.gpu = this.estado === 'teste' || !!ctx.medirGpu;
    medidas.cronometrar = !!ctx.perfil.alvoGpu && !this.resolucao.fixa;
    medidas.porPasse = this._porPasse || !!ctx.medirGpu;
    if (ctx.capac?.programas) ctx.capac.programas.quadro = this.desenhados;
    medidas.inicio(tMs);
    const amb = ctx.ambiente ?? null;
    medidas.marcar('ceu');
    amb?.antes(renderer, medidas);
    medidas.marcar('preparo');
    for (const fn of this.antes) {
      try {
        fn(renderer, medidas, tMs);
      } catch (e) {
        console.error('render: passe antes da cena falhou:', e);
      }
    }
    medidas.marcar('sombra');
    sombra.desenhar(renderer, medidas, ganchos.uniformes);

    const comPos = this.pos.ligado;
    const comp = amb?.composicao ?? { exposicao: 1, limiarBloom: 1.1 };
    const db = renderer.getDrawingBufferSize(this._db);
    if (comPos) this.pos.garantir(db.x, db.y);
    // o Leve (sem pós) usa o AgX do próprio three na tela; com pós a curva vai na composição
    const tom = comPos ? THREE.NoToneMapping : THREE.AgXToneMapping;
    if (renderer.toneMapping !== tom) renderer.toneMapping = tom;
    renderer.toneMappingExposure = comPos ? 1 : comp.exposicao;

    // aquecimento: com o ambiente (a luz do ambiente entra no programa) e o alvo da cena prontos
    this._alvoCena.alvo = comPos ? this.pos.alvo : null;
    this._alvoCena.tom = tom;
    try {
      this.aquecimento.quadro(tMs, this._alvoCena);
    } catch (e) {
      console.error('render: aquecimento falhou:', e);
    }

    const autoLimpa = renderer.autoClear;
    medidas.marcar('ceu');
    medidas.passe(() => {
      renderer.setRenderTarget(comPos ? this.pos.alvo : null);
      renderer.setClearColor(this._corLimpa, 1);
      if (amb && !cena.background) {
        renderer.clear(true, true, false);
        renderer.autoClear = false;
        // o fundo na cena (ceu.js) vai depois dos opacos, só onde nada foi desenhado
        if (!amb.fundoNaCena) amb.desenharFundo(renderer, camera);
      }
    });
    medidas.classificar(true);
    try {
      this.faixas.desenhar(renderer, cena, camera, medidas);
    } finally {
      medidas.classificar(false);
    }
    renderer.autoClear = autoLimpa;

    medidas.marcar('pos');
    if (comPos) {
      const cas = this.cas;
      medidas.passe(() => this.pos.compor({ exposicao: comp.exposicao, limiarBloom: comp.limiarBloom, cas, tMs }));
    }
    const s = medidas.stats;
    s.msaa = comPos ? this.pos.amostras : 0;
    s.alvo = comPos ? this.pos.formato : 'tela';
    s.exposicao = +comp.exposicao.toFixed(3);
    s.faixas = ctx.semClip ? 2 : 1;
    this._publicarResolucao(db);
    medidas.fim(tMs, { pr: ctx.pr, largura: this.w, altura: this.h, cenas: [cena, sombra.cena] });
    // os quadros da carga (compilação, primeiro cubo do céu, primeiros quadros-chave da luz) não entram no pior
    if (++this.desenhados === AQUECIMENTO) medidas.zerarJanela();
  }

  // resolução interna em pixels, a escala da nativa e quem decide (R.stats.resolucao, a página de teste)
  _publicarResolucao(db) {
    const s = this.ctx.medidas.stats;
    const r = this.resolucao;
    const dpr = r.dpr || 1;
    const x = s.resolucao ?? (s.resolucao = {});
    x.w = db.x;
    x.h = db.y;
    x.pr = this.ctx.pr;
    x.nominal = r.nominal;
    x.escala = +(this.ctx.pr / x.nominal).toFixed(3);
    x.nativa = { w: Math.round(this.w * dpr), h: Math.round(this.h * dpr) };
    x.modo = r.modo;
    x.alvoGpu = this.ctx.perfil.alvoGpu ?? null;
    x.cas = +this.cas.toFixed(2);
    x.trocas = r.trocas;
    x.ultimaTroca = r.ultimaTroca;
  }

  descartar() {
    if (typeof removeEventListener !== 'undefined') removeEventListener('resize', this._aoMudarTela);
    if (this.ctx.medidas?.aoCronometro) this.ctx.medidas.aoCronometro = null;
    this.ctx.medidas?.descartar?.();
    this.pos.descartar();
  }
}

export function registrar() {}
