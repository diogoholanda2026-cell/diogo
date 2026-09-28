// Resolução dinâmica em degraus (desenho do render 1.4 e 2.10, D66). Dois caminhos:
//  - pelo cronômetro da placa (EXT_disjoint_timer_query_webgl2), nos perfis de PC com alvoGpu (15,5 ms de placa):
//    o ControleResolucao (puro, testado no Node) junta janelas de 20 quadros; desce quando a mediana passa 6% do alvo
//    em 2 janelas seguidas, pulando direto para o degrau que cabe pela conta de pixels (o custo medido é de pixel e vai
//    com a área); sobe só quando a previsão do degrau de cima (ms x (escala de cima / escala)²) cabe com 8% de folga
//    em 3 janelas e 3 s depois da última descida. A previsão superestima a subida (a parte fixa do quadro não cresce),
//    então depois de subir a medida fica abaixo do limiar de descer: histerese sem pisca-pisca. Uma subida desfeita
//    (descida até 12 s depois dela) pela segunda vez trava o degrau de cima por 1 min.
//  - pelo tempo de quadro (o Média e aparelhos sem o cronômetro): janelas de 1 s, desce depois de 2 lentas, sobe
//    depois de 5 boas e 10 s da última descida; uma subida desfeita 2 vezes em 15 s trava o degrau por 2 min.
// No 'pc' os degraus são 70%, 80%, 90% e 100% da nativa (com o teto de pixels de 1080p); nos outros, os DEGRAUS_PR do
// perfil. Parada com ?pr= (testes), no estado 'teste' (o Teste de desempenho mede com a resolução travada), com a tela
// coberta e nos primeiros 3 s (compilação). Abaixo do nominal a composição liga o CAS (nitidez) na medida da queda.
import { degrausDoPerfil, indiceDoDegrau } from './perfis.js';

/** Números do controle pelo cronômetro (alvo em ms de placa vem do perfil). */
export const CONTROLE = Object.freeze({
  janela: 20, // quadros por janela (a mediana ignora os picos raros: um quadro-chave do céu, a sombra refeita)
  desce: 1.06, // desce acima de alvo x 1,06
  sobe: 0.92, // sobe se a previsão do degrau de cima couber em alvo x 0,92
  janelasDesce: 2,
  janelasSobe: 3,
  esperaSobe: 3000, // ms depois da última descida
  desfeita: 12000, // uma descida até 12 s depois de subir desfaz a subida
  trava: 60000, // a segunda desfeita trava o degrau de cima por 1 min
});

/** Quadros sem resultado do cronômetro até o tempo de quadro assumir. */
const SEM_GPU = 30;

const mediana = (l) => {
  const o = [...l].sort((a, b) => a - b);
  const m = o.length >> 1;
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

/**
 * Controle da resolução pelo tempo de placa. Puro: sem relógio (o tempo vem de fora), sem DOM, sem three.
 * @example
 * const c = new ControleResolucao({ escalas: [0.7, 0.8, 0.9, 1], alvo: 15.5 });
 * for (const ms of amostras) { const j = c.amostra(ms, agora); if (j >= 0) usarDegrau(j); }
 */
export class ControleResolucao {
  /**
   * @param {{ escalas: number[], alvo: number } & Partial<typeof CONTROLE>} op
   *   escalas: tamanho relativo de cada degrau, do menor ao maior (o custo de pixel vai com o quadrado)
   */
  constructor({ escalas, alvo, ...op }) {
    if (!escalas?.length || !(alvo > 0)) throw new Error('ControleResolucao: escalas e alvo');
    Object.assign(this, CONTROLE, op);
    this.escalas = escalas;
    this.alvo = alvo;
    this.i = escalas.length - 1;
    this.amostras = [];
    this.lentas = 0;
    this.boas = 0;
    this.ultDesce = -Infinity;
    this.subiu = [];
    this.desfeitas = [];
    this.travadoAte = [];
    this.ultimaMediana = 0;
  }

  get n() {
    return this.escalas.length;
  }

  /** Põe o degrau atual (trocado de fora: perfil, tela): a janela recomeça. */
  definir(i) {
    if (i === this.i) return;
    this.i = Math.max(0, Math.min(this.n - 1, i));
    this.amostras.length = 0;
    this.lentas = 0;
    this.boas = 0;
  }

  /** Previsão do ms de placa no degrau j pela mediana m medida no degrau atual. */
  prever(m, j) {
    const k = this.escalas[j] / this.escalas[this.i];
    return m * k * k;
  }

  /**
   * Um quadro medido no degrau atual. Devolve o degrau novo quando troca, senão -1.
   * @param {number} ms     tempo de placa do quadro
   * @param {number} agora  ms (o relógio de quem chama)
   */
  amostra(ms, agora) {
    if (!(ms > 0) || !Number.isFinite(ms)) return -1;
    this.amostras.push(ms);
    if (this.amostras.length < this.janela) return -1;
    const m = mediana(this.amostras);
    this.amostras.length = 0;
    this.ultimaMediana = m;
    return this.decidir(m, agora);
  }

  /** Decide pela mediana de uma janela. */
  decidir(m, agora) {
    const i = this.i;
    const topo = this.n - 1;
    if (m > this.alvo * this.desce) {
      this.lentas++;
      this.boas = 0;
    } else if (i < topo && this.prever(m, i + 1) <= this.alvo * this.sobe) {
      this.boas++;
      this.lentas = 0;
    } else {
      this.lentas = 0;
      this.boas = 0;
    }
    if (this.lentas >= this.janelasDesce && i > 0) {
      // o maior degrau abaixo em que a previsão cabe no alvo (pelo menos um abaixo; o menor se nenhum couber)
      let j = i - 1;
      while (j > 0 && this.prever(m, j) > this.alvo) j--;
      if (agora - (this.subiu[i] ?? -Infinity) < this.desfeita) {
        const n = (this.desfeitas[i] ?? 0) + 1;
        this.desfeitas[i] = n >= 2 ? 0 : n;
        if (n >= 2) this.travadoAte[i] = agora + this.trava;
      }
      this.ultDesce = agora;
      return this._ir(j);
    }
    if (this.boas >= this.janelasSobe && agora - this.ultDesce >= this.esperaSobe && !((this.travadoAte[i + 1] ?? -Infinity) > agora)) {
      this.subiu[i + 1] = agora;
      return this._ir(i + 1);
    }
    return -1;
  }

  _ir(j) {
    this.i = j;
    this.lentas = 0;
    this.boas = 0;
    this.amostras.length = 0;
    return j;
  }
}

export class Resolucao {
  /** @param {object} ctx  contexto do render (perfil, pr, tela) */
  constructor(ctx, { fixa = null } = {}) {
    this.ctx = ctx;
    this.fixa = fixa ?? (typeof location !== 'undefined' && /[?&]pr=/.test(location.search || ''));
    this.acc = { t: 0, n: 0 };
    this.r = { lento: 0, bom: 0, ultDesce: -1e9, subiu: {}, desfeitas: {}, bloq: {} };
    this.t0 = null;
    this.ultimo = 0;
    this.controle = null; // caminho do cronômetro
    this.semGpu = Infinity; // quadros desde a última amostra do cronômetro
    this.trocas = 0;
    this.ultimaTroca = null; // { de, para, modo, ms }
    this._perfil = null;
    this._chave = '';
    this._degraus = null;
  }

  get dpr() {
    return typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
  }

  /** Degraus do perfil neste aparelho e nesta tela, do menor ao nominal. */
  get degraus() {
    return degrausDoPerfil(this.ctx.perfil, this.dpr, this.ctx.tela);
  }

  /** Degrau nominal do perfil neste aparelho (o mais alto). */
  get nominal() {
    const d = this.degraus;
    return d[d.length - 1];
  }

  /** Força do CAS (0 a 1) pela queda da resolução abaixo do nominal. */
  get cas() {
    if (!this.ctx.perfil.pos) return 0;
    const q = 1 - this.ctx.pr / this.nominal;
    return q > 0.02 ? Math.min(1, 0.35 + q * 2.5) : 0;
  }

  /**
   * Quem decide agora: 'fixa', 'cronometro' (tempo de placa; o resultado chega uns quadros depois) ou 'quadro'
   * (tempo de quadro: sem o cronômetro, ou 30 quadros sem resultado dele).
   */
  get modo() {
    if (this.fixa) return 'fixa';
    return this.ctx.perfil.alvoGpu && this.semGpu < SEM_GPU ? 'cronometro' : 'quadro';
  }

  /**
   * Acerta ctx.pr a uma troca de perfil (começa no nominal) ou de tela (mantém o degrau; os degraus do 'pc' vêm da
   * tela). O quadro chama antes de medir a tela. true se ctx.pr mudou.
   */
  conferir() {
    const ctx = this.ctx;
    const chave = `${ctx.perfil.id}|${this.dpr}|${ctx.tela?.w ?? 0}|${ctx.tela?.h ?? 0}`;
    if (chave === this._chave) return false;
    const perfilNovo = ctx.perfil !== this._perfil;
    const antes = this._degraus;
    const D = this.degraus;
    this._chave = chave;
    this._perfil = ctx.perfil;
    this._degraus = D;
    if (perfilNovo) {
      this.controle = null;
      this.acc = { t: 0, n: 0 };
      this.r = { lento: 0, bom: 0, ultDesce: -1e9, subiu: {}, desfeitas: {}, bloq: {} };
      // a troca de perfil compila os programas dele: os 3 s de espera recomeçam
      if (antes) this.t0 = null;
    }
    if (this.fixa) return false;
    const pr0 = ctx.pr;
    ctx.pr = perfilNovo || !antes ? D[D.length - 1] : D[Math.min(D.length - 1, indiceDoDegrau(antes, ctx.pr))];
    return ctx.pr !== pr0;
  }

  /** true se a resolução dinâmica pode agir agora. */
  _pode(tMs, estado) {
    if (this.t0 === null) this.t0 = tMs;
    if (this.fixa || estado !== 'livre' || tMs - this.t0 < 3000) return false;
    return !(typeof document !== 'undefined' && document.hidden);
  }

  _trocar(pr, tMs, modo, ms) {
    this.ultimaTroca = { de: this.ctx.pr, para: pr, modo, ms: +(+ms).toFixed(2), t: Math.round(tMs) };
    this.ctx.pr = pr;
    this.trocas++;
  }

  /**
   * Uma amostra do cronômetro da placa: ms de um quadro desenhado com a razão de pixels pr (o resultado chega uns
   * quadros depois; o de antes de uma troca não vale). true se trocou ctx.pr (o quadro refaz a tela).
   */
  amostraGpu(ms, pr, tMs, estado = 'livre') {
    const alvo = this.ctx.perfil.alvoGpu;
    if (!alvo) return false;
    this.semGpu = 0;
    if (!this._pode(tMs, estado)) return false;
    if (Math.abs(pr - this.ctx.pr) > 1e-3) return false;
    const D = this._degraus ?? this.degraus;
    const topo = D[D.length - 1];
    // os degraus relativos mudam com a tela ou o dpr nos perfis sem escalas fixas: o controle recomeça com os novos
    const c = this.controle;
    if (!c || c.alvo !== alvo || c.n !== D.length || D.some((d, k) => Math.abs(d / topo - c.escalas[k]) > 1e-4)) {
      this.controle = new ControleResolucao({ escalas: D.map((d) => d / topo), alvo });
    }
    const i = indiceDoDegrau(D, this.ctx.pr);
    this.controle.definir(i);
    const j = this.controle.amostra(ms, tMs);
    if (j < 0 || j === i) return false;
    this._trocar(D[j], tMs, 'cronometro', this.controle.ultimaMediana);
    return true;
  }

  /**
   * Um quadro desenhado em tMs (o caminho do tempo de quadro, quando o cronômetro não manda). Devolve true se trocou a
   * razão de pixels (ctx.pr; o quadro refaz a tela).
   * @param {string} estado  R.estado
   */
  medir(tMs, estado = 'livre') {
    const dt = this.ultimo ? tMs - this.ultimo : 0;
    this.ultimo = tMs;
    this.semGpu++;
    if (!this._pode(tMs, estado) || !(dt > 0) || dt > 250) return false;
    if (this.modo === 'cronometro') {
      this.acc.t = 0;
      this.acc.n = 0;
      return false;
    }
    const a = this.acc;
    a.t += dt;
    a.n++;
    if (a.t < 1000) return false;
    const media = a.t / a.n;
    a.t = 0;
    a.n = 0;
    const pr0 = this.ctx.pr;
    const trocou = this.ajustar(media, 1000 / (this.ctx.perfil.qps ?? 30), tMs);
    if (trocou) {
      const novo = this.ctx.pr;
      this.ctx.pr = pr0;
      this._trocar(novo, tMs, 'quadro', media);
    }
    return trocou;
  }

  /** Decide o degrau pela média da janela e o alvo em ms (caminho do tempo de quadro). */
  ajustar(media, alvo, agora) {
    const R = this.r;
    const D = this.degraus;
    const i = indiceDoDegrau(D, this.ctx.pr);
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
