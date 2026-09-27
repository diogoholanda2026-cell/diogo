// Resolução dinâmica em degraus (desenho do render 1.4 e 2.10): mede o tempo de quadro em janelas de 1 s e desce um
// degrau depois de 2 janelas lentas, sobe depois de 5 boas e 10 s da última descida; uma subida desfeita 2 vezes em
// menos de 15 s trava o degrau por 2 min. Parada com ?pr= (testes), no estado 'teste' (o Teste de desempenho mede
// com a resolução travada), com a tela coberta e nos primeiros 3 s (compilação). Abaixo do degrau nominal a
// composição liga o CAS (nitidez adaptativa) na medida da queda. Reaproveitado do jogo antigo (engine.js).
import { degrausDoPerfil } from './perfis.js';

export class Resolucao {
  /** @param {object} ctx  contexto do render (perfil, pr) */
  constructor(ctx, { fixa = null } = {}) {
    this.ctx = ctx;
    this.fixa = fixa ?? (typeof location !== 'undefined' && /[?&]pr=/.test(location.search || ''));
    this.acc = { t: 0, n: 0 };
    this.r = { lento: 0, bom: 0, ultDesce: -1e9, subiu: {}, desfeitas: {}, bloq: {} };
    this.t0 = null;
    this.ultimo = 0;
  }

  get dpr() {
    return typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
  }

  /** Degrau nominal do perfil neste aparelho (o mais alto). */
  get nominal() {
    const d = degrausDoPerfil(this.ctx.perfil, this.dpr);
    return d[d.length - 1];
  }

  /** Força do CAS (0 a 1) pela queda da resolução abaixo do nominal. */
  get cas() {
    if (!this.ctx.perfil.pos) return 0;
    const q = 1 - this.ctx.pr / this.nominal;
    return q > 0.02 ? Math.min(1, 0.35 + q * 2.5) : 0;
  }

  /**
   * Um quadro desenhado em tMs. Devolve true se trocou a razão de pixels (ctx.pr; o quadro refaz a tela).
   * @param {string} estado  R.estado
   */
  medir(tMs, estado = 'livre') {
    if (this.t0 === null) this.t0 = tMs;
    const dt = this.ultimo ? tMs - this.ultimo : 0;
    this.ultimo = tMs;
    if (this.fixa || estado !== 'livre' || tMs - this.t0 < 3000 || !(dt > 0) || dt > 250) return false;
    if (typeof document !== 'undefined' && document.hidden) return false;
    const a = this.acc;
    a.t += dt;
    a.n++;
    if (a.t < 1000) return false;
    const media = a.t / a.n;
    a.t = 0;
    a.n = 0;
    return this.ajustar(media, 1000 / (this.ctx.perfil.qps ?? 30), tMs);
  }

  /** Decide o degrau pela média da janela e o alvo em ms. */
  ajustar(media, alvo, agora) {
    const R = this.r;
    const D = degrausDoPerfil(this.ctx.perfil, this.dpr);
    let i = D.indexOf(this.ctx.pr);
    if (i < 0) i = Math.max(0, D.findIndex((s) => s >= this.ctx.pr) - 1);
    if (media > alvo * 1.15) {
      R.lento++;
      R.bom = 0;
    } else if (media < alvo * 1.05) {
      R.bom++;
      R.lento = 0;
    } else {
      R.lento = 0;
      R.bom = 0;
    }
    if (R.lento >= 2 && i > 0) {
      if (agora - (R.subiu[i] || -1e9) < 15000) {
        R.desfeitas[i] = (R.desfeitas[i] || 0) + 1;
        if (R.desfeitas[i] >= 2) {
          R.bloq[i] = agora + 120000;
          R.desfeitas[i] = 0;
        }
      }
      this.ctx.pr = D[i - 1];
      R.lento = R.bom = 0;
      R.ultDesce = agora;
      return true;
    }
    if (R.bom >= 5 && i < D.length - 1 && agora - R.ultDesce > 10000 && !((R.bloq[i + 1] || 0) > agora)) {
      this.ctx.pr = D[i + 1];
      R.subiu[i + 1] = agora;
      R.bom = 0;
      return true;
    }
    return false;
  }
}

export function registrar() {}
