// Resolução dinâmica em degraus (desenho do render 1.4 e 2.10, D66). Dois caminhos:
//  - pelo cronômetro da placa (EXT_disjoint_timer_query_webgl2), nos perfis de PC com alvoGpu (15,5 ms de placa):
//    o ControleResolucao (puro, testado no Node) junta janelas de 20 quadros; desce quando a mediana passa 6% do alvo
//    em 2 janelas seguidas, pulando direto para o degrau que cabe pela conta de pixels (o custo medido é de pixel e vai
//    com a área); sobe só quando a previsão do degrau de cima (ms x (escala de cima / escala)²) cabe com 8% de folga
//    em 3 janelas e 3 s depois da última descida. A previsão superestima a subida (a parte fixa do quadro não cresce),
//    então depois de subir a medida fica abaixo do limiar de descer: histerese sem pisca-pisca. Uma subida desfeita
//    (descida até 12 s depois dela) pela segunda vez trava o degrau de cima por 1 min.
//  - pelo tempo de quadro (o Média e aparelhos sem o cronômetro): janelas de 1 s pela MEDIANA dos quadros (um soluço
//    não derruba a resolução e quadros lentos de verdade, até 2,5 s, contam: antes qualquer quadro acima de 250 ms era
//    ignorado e o controle ficava cego justo no celular que mais precisa dele), desce depois de 2 lentas (de 1 só se a
//    mediana passar de 1,8 vezes o alvo, pulando direto ao degrau que cabe pela conta de pixels), sobe depois de 5
//    boas e 10 s da última descida; uma subida desfeita 2 vezes em 15 s trava o degrau por 2 min.
//  - em movimento (TOQ1, D99; só nos perfis do caminho do tempo de quadro, o Média e o Leve): enquanto a câmera é mexida
//    (gesto ou deslize, a entrada avisa a cada quadro) a resolução cai a 72% (piso 0,55) se o quadro já está perto do
//    alvo, e volta à de antes 280 ms depois de a vista parar; a nitidez (CAS) segue a queda e some na volta.
// No 'pc' os degraus são 70%, 80%, 90% e 100% da nativa (com o teto de pixels de 1080p); nos outros, os DEGRAUS_PR do
// perfil. Parada com ?pr= (testes), no estado 'teste' (o Teste de desempenho mede com a resolução travada), com a tela
// coberta e nos primeiros 3 s (compilação). Abaixo do nominal a composição liga o CAS (nitidez) na medida da queda.
// O jogador escolhe nas Configurações (R.resolucao, C1b): a resolução dinâmica desligada trava no nominal do perfil e a
// nitidez 'desligada' tira o CAS (o automático segue a ampliação e a queda).
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

/** Um intervalo maior que isto entre dois quadros é pausa (aba no fundo, tela coberta), não lentidão. */
const PAUSA_MS = 2500;

/**
 * Resolução em movimento: escala sobre a atual, piso da razão de pixels, folga depois de a vista parar (ms) e a fração
 * do alvo que o tempo de quadro já precisa ter para valer a troca (um aparelho folgado não perde nitidez à toa).
 */
export const MOVIMENTO = Object.freeze({ escala: 0.72, piso: 0.55, folgaMs: 280, perto: 0.8 });

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
    this.travada = fixa ?? (typeof location !== 'undefined' && /[?&]pr=/.test(location.search || '')); // ?pr= e testes
    this.dinamica = true; // preferência do jogador (R.resolucao)
    this.semCas = false; // nitidez 'desligada' (R.resolucao)
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
    this.dtMedio = 0; // média móvel do tempo de quadro (ms), para o "perto do alvo" da resolução em movimento
    this.mov = { base: null, perfil: null, tUlt: 0, tCaiu: -1e9 }; // base: a razão de pixels de antes do movimento (null: sem queda)
    this.trocasMovimento = 0;
  }

  get dpr() {
    return typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
  }

  /** Parada: pela consulta (?pr=, a bancada e os testes) ou pelo jogador (resolução dinâmica desligada). */
  get fixa() {
    return this.travada || !this.dinamica;
  }

  set fixa(v) {
    this.travada = !!v;
  }

  /**
   * Preferência do jogador (R.resolucao): { dinamica, nitidez: 'auto' | 'desligada' }. Desligar a dinâmica volta ao
   * nominal do perfil (o quadro refaz a tela quando ctx.pr muda); religar recomeça os 3 s de espera. true se ctx.pr
   * mudou.
   */
  preferir({ dinamica, nitidez } = {}) {
    if (nitidez !== undefined) this.semCas = nitidez === 'desligada';
    if (dinamica === undefined || !!dinamica === this.dinamica) return false;
    this.dinamica = !!dinamica;
    this.controle = null;
    this.acc = { t: 0, n: 0 };
    this.r = { lento: 0, bom: 0, ultDesce: -1e9, subiu: {}, desfeitas: {}, bloq: {} };
    this.mov.base = null;
    if (this.dinamica) {
      this.t0 = null;
      return false;
    }
    if (this.travada) return false;
    const pr0 = this.ctx.pr;
    this.ctx.pr = this.nominal;
    return this.ctx.pr !== pr0;
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
    if (!this.ctx.perfil.pos || this.semCas) return 0;
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
    // uma troca de tela ou de perfil no meio de um movimento: a queda do movimento sai, a conta é do degrau
    if (this.mov.base !== null) {
      if (ctx.perfil === this.mov.perfil) ctx.pr = this.mov.base;
      this.mov.base = null;
    }
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
    if (this.travada) return false;
    const pr0 = ctx.pr;
    // com a dinâmica desligada pelo jogador fica no nominal (o 'pc' acerta o teto de 1080p pela tela)
    ctx.pr = perfilNovo || !antes || !this.dinamica ? D[D.length - 1] : D[Math.min(D.length - 1, indiceDoDegrau(antes, ctx.pr))];
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
   * razão de pixels (ctx.pr; o quadro refaz a tela). A janela de 1 s decide pela mediana dos quadros.
   * @param {string} estado  R.estado
   */
  medir(tMs, estado = 'livre') {
    const dt = this.ultimo ? tMs - this.ultimo : 0;
    this.ultimo = tMs;
    this.semGpu++;
    if (dt > 0 && dt < PAUSA_MS) this.dtMedio = this.dtMedio ? this.dtMedio * 0.85 + dt * 0.15 : dt;
    if (!this._pode(tMs, estado) || !(dt > 0) || dt > PAUSA_MS) return false;
    if (this.modo === 'cronometro') {
      this.acc.t = 0;
      this.acc.n = 0;
      this.acc.dts = null;
      return false;
    }
    // os quadros de compilação da carga não são o jogo; e com a resolução baixada pelo movimento a medida não vale
    const aq = this.ctx.quadro?.aquecimento;
    if (this.mov.base !== null || (aq && aq.estado !== 'pronto')) {
      this.acc = { t: 0, n: 0 };
      return false;
    }
    const a = this.acc;
    a.t += dt;
    a.n++;
    (a.dts ??= []).push(dt);
    if (a.t < 1000) return false;
    const media = mediana(a.dts);
    this.acc = { t: 0, n: 0 };
    const pr0 = this.ctx.pr;
    const trocou = this.ajustar(media, 1000 / (this.ctx.perfil.qps ?? 30), tMs);
    if (trocou) {
      const novo = this.ctx.pr;
      this.ctx.pr = pr0;
      this._trocar(novo, tMs, 'quadro', media);
    }
    return trocou;
  }

  /**
   * A câmera está em movimento (gesto ou deslize; a entrada chama a cada quadro). Só no caminho do tempo de quadro (o
   * Média e o Leve): com o quadro já perto do alvo a resolução cai a 72% enquanto a vista se mexe e volta à de antes 280
   * ms depois de ela parar (a nitidez volta junto). true se mudou ctx.pr (o quadro refaz a tela no quadro seguinte).
   */
  movimento(ativo, tMs) {
    const ctx = this.ctx;
    const M = this.mov;
    if (M.base !== null) {
      if (ctx.perfil !== M.perfil || this.fixa) {
        M.base = null; // o perfil mudou ou a dinâmica foi travada: ctx.pr já é de quem mudou
        return false;
      }
      if (ativo) {
        M.tUlt = tMs;
        return false;
      }
      if (tMs - M.tUlt < MOVIMENTO.folgaMs) return false;
      const antes = ctx.pr;
      ctx.pr = M.base;
      M.base = null;
      this.acc = { t: 0, n: 0 };
      return ctx.pr !== antes;
    }
    const perfil = ctx.perfil;
    if (!ativo || this.fixa || perfil.alvoGpu || perfil.nativo || this.t0 === null || tMs - this.t0 < 3000) return false;
    if (ctx.quadro && ctx.quadro.estado !== 'livre') return false; // a tela coberta, o modo foto e o Teste de desempenho medem parados
    if (typeof document !== 'undefined' && document.hidden) return false;
    const aq = ctx.quadro?.aquecimento;
    if (aq && aq.estado !== 'pronto') return false;
    // o quadro está perto do alvo? Depois de cair uma vez vale por 20 s (a média cai porque a resolução caiu: sem isso o
    // segundo arrasto, logo depois do primeiro, não baixaria e engasgaria)
    if (!(this.dtMedio > (1000 / (perfil.qps ?? 30)) * MOVIMENTO.perto) && tMs - M.tCaiu > 20000) return false;
    const novo = Math.max(MOVIMENTO.piso, ctx.pr * MOVIMENTO.escala);
    if (novo >= ctx.pr - 0.04) return false;
    M.tCaiu = tMs;
    this.ultimaTroca = { de: ctx.pr, para: novo, modo: 'movimento', ms: +this.dtMedio.toFixed(2), t: Math.round(tMs) };
    M.base = ctx.pr;
    M.perfil = perfil;
    M.tUlt = tMs;
    ctx.pr = novo;
    this.trocasMovimento++;
    return true;
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
    // muito lento (mediana acima de 1,8 vez o alvo): uma janela basta, e o degrau sai da conta de pixels (um terço do
    // quadro é fixo, dois terços vão com a área), o maior que cabe no alvo, no mínimo um abaixo
    const severo = media > alvo * 1.8;
    if (R.lento >= (severo ? 1 : 2) && i > 0) {
      if (agora - (R.subiu[i] || -1e9) < 15000) {
        R.desfeitas[i] = (R.desfeitas[i] || 0) + 1;
        if (R.desfeitas[i] >= 2) {
          R.bloq[i] = agora + 120000;
          R.desfeitas[i] = 0;
        }
      }
      let j = i - 1;
      if (severo) while (j > 0 && media * (0.35 + 0.65 * (D[j] / D[i]) ** 2) > alvo) j--;
      this.ctx.pr = D[j];
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
