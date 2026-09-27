// Quadro do render (desenho do render 1.4): limite de quadros pelo estado da tela, tamanho da tela e a ordem dos
// passes de um quadro:
//   1. passes raros em fatias do ambiente (uma face do cubo do céu, um quadro-chave da luz do ambiente e a mistura);
//   2. sombra própria (D43), só quando suja;
//   3. a cena no alvo HDR com MSAA: fundo do céu (tela cheia, sem profundidade) e a cena por cima, numa faixa de
//      profundidade (invertida) ou em duas (sem EXT_clip_control, motor/faixas.js);
//   4. composição na tela: bloom, exposição, AgX, CAS e pontilhado (motor/pos.js). O Leve desenha direto na tela.
// Mede cada passe (R.stats soma todos) e ajusta a resolução dinâmica em degraus (motor/resolucao.js).
// A sombra própria mora em render/sombra/mapa.js; a classe segue exportada daqui para o índice do render.
import * as THREE from 'three';
import { Pos } from './pos.js';
import { Resolucao } from './resolucao.js';
import { Faixas } from './faixas.js';

export { SombraPropria } from '../sombra/mapa.js';

/** Quadros da carga que ficam fora da janela do pior quadro. */
export const AQUECIMENTO = 3;

/** Quadros por segundo máximos por estado da tela (R.estado). */
export const TETO_QPS = Object.freeze({ livre: 0, coberto: 10, foto: 0, teste: 0 });

/**
 * Laço de desenho de um quadro.
 * @param {object} ctx  contexto do render (index.js): renderer, cena, camera, sombra, medidas, ganchos, perfil, pr
 */
export class Quadro {
  constructor(ctx) {
    this.ctx = ctx;
    this.estado = 'livre';
    this._ultimo = 0;
    this.desenhados = 0;
    this.w = 1;
    this.h = 1;
    this._medir = true;
    ctx.quadro = this;
    ctx.tela = { w: 1, h: 1 };
    // sem EXT_clip_control, ou com ?semClip=1, a profundidade invertida sai e entram as duas faixas
    const prof = ctx.renderer.state?.buffers?.depth;
    if (ctx.semClip && prof?.getReversed?.()) prof.setReversed(false);
    this.pos = new Pos(ctx);
    this.resolucao = new Resolucao(ctx);
    this.faixas = new Faixas(ctx);
    this._corLimpa = new THREE.Color(0, 0, 0);
    this._db = new THREE.Vector2();
    // mede a tela só quando ela muda (ler o layout a cada quadro força o navegador a refazê-lo depois da interface)
    if (typeof addEventListener !== 'undefined') addEventListener('resize', () => (this._medir = true));
  }

  /** Tamanho da tela em px CSS (no começo do quadro, só depois de um resize ou de trocar a razão de pixels). */
  medirTela() {
    const { renderer, camera, canvas } = this.ctx;
    if (!this._medir && renderer.getPixelRatio() === this.ctx.pr) return;
    this._medir = false;
    const w = Math.max(1, canvas.clientWidth || (typeof innerWidth !== 'undefined' ? innerWidth : 1));
    const h = Math.max(1, canvas.clientHeight || (typeof innerHeight !== 'undefined' ? innerHeight : 1));
    if (w !== this.w || h !== this.h || renderer.getPixelRatio() !== this.ctx.pr) {
      this.w = w;
      this.h = h;
      this.ctx.tela.w = w;
      this.ctx.tela.h = h;
      renderer.setPixelRatio(this.ctx.pr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  /** true se este quadro deve ser desenhado (teto de qps do estado). */
  vez(tMs) {
    const teto = TETO_QPS[this.estado] || 0;
    if (!teto) return true;
    if (tMs - this._ultimo < 1000 / teto - 2) return false;
    return true;
  }

  /** Desenha um quadro inteiro, medindo cada passe. */
  desenhar(tMs) {
    const ctx = this.ctx;
    const { renderer, cena, camera, sombra, medidas, ganchos } = ctx;
    this._ultimo = tMs;
    if (this.resolucao.medir(tMs, this.estado)) this._medir = true;
    medidas.gpu = this.estado === 'teste' || !!ctx.medirGpu;
    medidas.inicio(tMs);
    const amb = ctx.ambiente ?? null;
    amb?.antes(renderer, medidas);
    sombra.desenhar(renderer, medidas, ganchos.uniformes);

    const comPos = this.pos.ligado;
    const comp = amb?.composicao ?? { exposicao: 1, limiarBloom: 1.1 };
    const db = renderer.getDrawingBufferSize(this._db);
    if (comPos) this.pos.garantir(db.x, db.y);
    // o Leve (sem pós) usa o AgX do próprio three na tela; com pós a curva vai na composição
    const tom = comPos ? THREE.NoToneMapping : THREE.AgXToneMapping;
    if (renderer.toneMapping !== tom) renderer.toneMapping = tom;
    renderer.toneMappingExposure = comPos ? 1 : comp.exposicao;

    const autoLimpa = renderer.autoClear;
    medidas.passe(() => {
      renderer.setRenderTarget(comPos ? this.pos.alvo : null);
      renderer.setClearColor(this._corLimpa, 1);
      if (amb && !cena.background) {
        renderer.clear(true, true, false);
        renderer.autoClear = false;
        amb.desenharFundo(renderer, camera);
      }
    });
    this.faixas.desenhar(renderer, cena, camera, medidas);
    renderer.autoClear = autoLimpa;

    if (comPos) {
      const cas = this.resolucao.cas;
      medidas.passe(() => this.pos.compor({ exposicao: comp.exposicao, limiarBloom: comp.limiarBloom, cas, tMs }));
    }
    medidas.stats.msaa = comPos ? this.pos.amostras : 0;
    medidas.stats.alvo = comPos ? this.pos.formato : 'tela';
    medidas.stats.exposicao = +comp.exposicao.toFixed(3);
    medidas.stats.faixas = ctx.semClip ? 2 : 1;
    medidas.fim(tMs, { pr: ctx.pr, largura: this.w, altura: this.h, cenas: [cena, sombra.cena] });
    // os quadros da carga (compilação, primeiro cubo do céu, primeiros quadros-chave da luz) não entram no pior
    if (++this.desenhados === AQUECIMENTO) medidas.zerarJanela();
  }

  descartar() {
    this.pos.descartar();
  }
}

export function registrar() {}
