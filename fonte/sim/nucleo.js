// Núcleo da simulação: relógio, agendador de sistemas, comandos entre tiques (D17), consultas síncronas (D16), eventos,
// registros (tabelas, grades, JSON, sistemas, comandos, consultas e o contrato interno 2.10), espelho e diário de
// mudanças (2.4), tarefas do worker (D15) e o livro. Sem relógio, sem sorteio fora de sim.rng e sem three.
//
// Uso (a montagem completa, com os domínios, é fonte/sim/estado.js):
//   const sim = criarSim({ semente: 'heldopolis-1' });
//   sim.registrarSistema(20, 5, (sim, fatia, fatias) => { ... }, 1, { nome: 'cidadaos', ordem: ORDEM.cidade });
//   sim.cmd('velocidade', { v: 1 }); sim.avancar(16.7); sim.q.barra(); sim.mudancas.desde(v);
import { Rng, semear } from '../comum/rng.js';
import { copiaJson, copiaProfunda, clamp } from '../comum/util.js';
import { alturaEm } from '../comum/altura.js';
import { tempoDoTique, VELOCIDADES, TIQUES_POR_QUADRO } from '../comum/relogio.js';
import { COMANDOS, vaiNoLivro } from '../contratos/comandos.js';
import { CONSULTAS } from '../contratos/consultas.js';
import { EVENTOS } from '../contratos/eventos.js';
import { CAMADAS } from '../contratos/camadas.js';
import { ehCodigo } from '../contratos/codigos.js';
import { espelhoVazio, ANEL_DIARIO, DOMINIOS_DIARIO } from '../contratos/espelho.js';
import { SERVICOS_INTERNOS } from '../contratos/interno.js';
import { Tabela, TIPOS_SALVAVEIS } from './tabela.js';
import { Livro } from './livro.js';
import { Formas } from './formas.js';
import { Tarefas } from './tarefas.js';
import { criarAgregados } from './agregados.js';
import { instalarSubstitutos } from './substitutos.js';
import { barra } from './consultas/barra.js';
import { hashEstado } from './salvar/formato.js';

// ------------------------------------------------------------------------------------------------------------------
// Diário de mudanças (2.4): anel de 65.536 marcas com deduplicação por lote e `tudo` por domínio.
// Um lote fecha no fim de cada tique, depois de cada comando e a cada desde(): dentro de um lote, marcar de novo a
// mesma vaga não gasta o anel. versao sobe a cada marca nova. Como os domínios marcam:
//   tabela.marcar(i)                                  depois de escrever colunas da vaga i (alocar e liberar já marcam)
//   sim.mudancas.marcarRet('terreno' | 'floresta', x0, z0, x1, z1)      retângulo sujo, em metros
//   sim.mudancas.marcar('ladrilhos' | 'fluxos' | 'entregas' | 'arcologia' | 'holding' | 'valor' | 'ar' | 'ruido')
//   sim.mudancas.tudo(dominio)                       quem ler refaz o domínio inteiro (ex.: terreno gerado de novo)

const MASCARA = ANEL_DIARIO - 1;

export class Mudancas {
  constructor() {
    this.versao = 0;
    this.loteIni = 1;
    this.pos = 0; // marcas já escritas no anel
    this.cod = new Uint16Array(ANEL_DIARIO);
    this.val = new Int32Array(ANEL_DIARIO);
    this.ver = new Uint32Array(ANEL_DIARIO);
    this.rets = new Float64Array(ANEL_DIARIO * 4);
    /** @type {Map<string, object>} */
    this.dom = new Map();
    this.porCodigo = [];
    this.tudoEm = 0; // troca geral (carregar): todos os domínios
    for (const nome of DOMINIOS_DIARIO.retangulos) this._dominio(nome, 'ret');
    for (const nome of DOMINIOS_DIARIO.sinais) this._dominio(nome, 'sinal');
    for (const nome of DOMINIOS_DIARIO.grades) this._dominio(nome, 'grade');
  }

  _dominio(nome, tipo, cap = 0) {
    let d = this.dom.get(nome);
    if (d) return d;
    d = { nome, tipo, codigo: this.porCodigo.length, perdido: 0, em: 0, tudoEm: 0, realocadoEm: 0, tabela: null };
    if (tipo === 'idx') d.mudou = new Uint32Array(cap);
    this.dom.set(nome, d);
    this.porCodigo.push(d);
    return d;
  }

  /** Liga uma tabela ao diário (o núcleo chama em registrarTabela com diario: true). */
  ligarTabela(t) {
    const velho = this.dom.get(t.nome);
    if (velho && velho.tipo !== 'idx') {
      // ex.: uma tabela 'entregas' com diario: true bateria no sinal 'entregas' do espelho
      throw new Error(`tabela ${t.nome}: o diário já tem o domínio '${t.nome}' (${velho.tipo}); use outro nome ou diario: false`);
    }
    const d = this._dominio(t.nome, 'idx', t.cap);
    d.tabela = t;
    return d;
  }

  _escrever(d, valor) {
    const v = ++this.versao;
    const k = this.pos & MASCARA;
    if (this.pos >= ANEL_DIARIO) {
      const velho = this.porCodigo[this.cod[k]];
      if (this.ver[k] > velho.perdido) velho.perdido = this.ver[k];
    }
    this.cod[k] = d.codigo;
    this.val[k] = valor;
    this.ver[k] = v;
    this.pos++;
    return v;
  }

  /** Marca a vaga idx de uma tabela do diário. */
  marcarIdx(nome, idx) {
    const d = this.dom.get(nome);
    if (!d) return;
    if (idx >= d.mudou.length) this.crescer(nome, d.tabela ? d.tabela.cap : idx + 1);
    if (d.mudou[idx] >= this.loteIni) return;
    d.mudou[idx] = this._escrever(d, idx);
  }

  /** Marca um retângulo sujo (terreno, floresta), em metros. */
  marcarRet(nome, x0, z0, x1, z1) {
    const d = this.dom.get(nome);
    if (!d) return;
    const k = this.pos & MASCARA;
    this._escrever(d, k);
    this.rets[4 * k] = x0;
    this.rets[4 * k + 1] = z0;
    this.rets[4 * k + 2] = x1;
    this.rets[4 * k + 3] = z1;
  }

  /** Marca um sinal (ladrilhos, fluxos, entregas, arcologia, holding) ou uma grade (valor, ar, ruido). */
  marcar(nome) {
    const d = this.dom.get(nome) ?? this._dominio(nome, 'sinal');
    d.em = ++this.versao;
  }

  /** Pede que quem ler refaça o domínio inteiro. */
  tudo(nome) {
    const d = this.dom.get(nome);
    if (d) d.tudoEm = ++this.versao;
  }

  /** Troca geral (carregar um save): todo domínio vale `tudo`. */
  tudoGeral() {
    this.tudoEm = ++this.versao;
    this.fecharLote();
  }

  /** Tabela cresceu: arrays novos. */
  realocado(nome) {
    const d = this.dom.get(nome);
    if (d) d.realocadoEm = ++this.versao;
  }

  crescer(nome, cap) {
    const d = this.dom.get(nome);
    if (!d || d.mudou.length >= cap) return;
    const m = new Uint32Array(cap);
    m.set(d.mudou);
    d.mudou = m;
  }

  fecharLote() {
    this.loteIni = this.versao + 1;
  }

  /**
   * Mudanças desde a versão v (formato em contratos/espelho.js). v < 0 pede tudo. Fecha o lote atual.
   * Uma versão acima da atual só pode ser de outra simulação (o app trocou a partida ao carregar): também vale tudo.
   */
  desde(v) {
    this.fecharLote();
    const tudoTodos = v < 0 || v < this.tudoEm || v > this.versao || !Number.isFinite(v);
    const menor = Math.max(0, this.pos - ANEL_DIARIO);
    // primeira marca com versão > v (as versões crescem com a posição no anel)
    let lo = menor;
    let hi = this.pos;
    while (lo < hi) {
      const m = Math.floor((lo + hi) / 2);
      if (this.ver[m & MASCARA] > v) hi = m;
      else lo = m + 1;
    }
    const listas = new Map();
    const tudo = {};
    for (const d of this.porCodigo) {
      if (d.tipo === 'idx' || d.tipo === 'ret') {
        tudo[d.nome] = tudoTodos || v < d.perdido || v < d.tudoEm;
        listas.set(d.codigo, []);
      }
    }
    for (let k = lo; k < this.pos; k++) {
      const s = k & MASCARA;
      const d = this.porCodigo[this.cod[s]];
      if (tudo[d.nome]) continue;
      const lista = listas.get(d.codigo);
      if (d.tipo === 'idx') {
        const idx = this.val[s];
        if (d.mudou[idx] === this.ver[s]) lista.push(idx);
      } else {
        const r = this.val[s] * 4;
        lista.push([this.rets[r], this.rets[r + 1], this.rets[r + 2], this.rets[r + 3]]);
      }
    }
    const res = {
      versao: this.versao,
      tudo: {
        terreno: !!tudo.terreno,
        floresta: !!tudo.floresta,
        vias: !!(tudo.nos || tudo.arestas),
        celulas: !!tudo.celulas,
        predios: !!tudo.predios,
      },
      realocado: [],
      n: {},
      grades: [],
    };
    for (const d of this.porCodigo) {
      if (d.tipo === 'idx') {
        res[d.nome] = Int32Array.from(listas.get(d.codigo));
        res.n[d.nome] = d.tabela ? d.tabela.n : 0;
        if (d.realocadoEm > v || tudoTodos) res.realocado.push(d.nome);
        if (!(d.nome in res.tudo)) res.tudo[d.nome] = !!tudo[d.nome];
      } else if (d.tipo === 'ret') {
        res[d.nome] = listas.get(d.codigo);
      } else if (d.tipo === 'grade') {
        if (d.em > v || tudoTodos) res.grades.push(d.nome);
      } else {
        res[d.nome] = d.em > v || tudoTodos;
      }
    }
    for (const nome of ['nos', 'arestas', 'celulas', 'predios']) {
      if (!res[nome]) res[nome] = new Int32Array(0);
      if (res.n[nome] === undefined) res.n[nome] = 0;
    }
    return res;
  }
}

// ------------------------------------------------------------------------------------------------------------------

const ehInteiro = (v) => Number.isInteger(v);

export class Sim {
  /**
   * @param {{ semente?: string | number, mapa?: string, trabalhador?: object | null, cronometro?: () => number,
   *           livroMax?: number }} op
   *   cronometro: função de tempo em ms fornecida pelo app ou pelo robô, só para medir (nunca decide nada).
   */
  constructor({ semente = 'heldopolis-1', mapa = 'heldopolis', trabalhador = null, cronometro = null, livroMax = 2000 } = {}) {
    this.semente = semente;
    this.mapa = mapa;
    this._tique = 0;
    this._seq = 0;
    this.velocidade = 0;
    this._acum = 0;
    this.parado = false;
    this.cronometro = cronometro;
    this.mudancas = new Mudancas();
    this.espelho = espelhoVazio(semente);
    Object.defineProperty(this.espelho, 'versao', { get: () => this.mudancas.versao, enumerable: true });
    this.espelho.tempo = tempoDoTique(0, 0, 0, {});
    /** @type {Record<string, Tabela>} */
    this.tabelas = {};
    this.grades = {};
    this.json = {};
    this._regTabela = new Map();
    this._regGrade = new Map();
    this._regJson = new Map();
    this._sistemas = [];
    this._agenda = null;
    this._comandos = new Map();
    this._consultas = new Map();
    this.q = {};
    this._ouvintes = new Map();
    this._fila = [];
    this._rngs = new Map();
    this._validadores = new Map();
    this._partesBarra = [];
    this._aoCarregar = [];
    this.livro = new Livro({ max: livroMax });
    this.erros = [];
    this.grafo = null;
    this.medidas = { tiques: 0, msUltimo: 0, msTotal: 0, msMax: 0, sistemas: {} };
    this.formas = new Formas({ marcarRet: (x0, z0, x1, z1) => this.mudancas.marcarRet('terreno', x0, z0, x1, z1) });
    this.tarefas = new Tarefas(this, { trabalhador });
    this._emTique = false;
    // os agregados são lidos entre uma rodada e outra (economia, barra): vão no save e no hash, senão uma partida
    // carregada no meio da rodada recebe outra contribuição até a próxima soma
    this.agregados = this.registrarJson('agregados', criarAgregados());
    this._criarRegistros();

    this.registrarComando('velocidade', (sim, { v }) => {
      if (!ehInteiro(v) || v < 0 || v >= VELOCIDADES.length) return { ok: false, codigo: 'valor' };
      sim.velocidade = v;
      sim.espelho.tempo.velocidade = v;
      sim.espelho.tempo.mult = VELOCIDADES[v];
      sim.emitir('velocidade', { v });
      return { ok: true };
    });
    this.registrarConsulta('barra', (sim) => barra(sim));
    this.registrarConsulta('hash', (sim) => hashEstado(sim));
    this.registrarConsulta('camada', (sim, id) => {
      const fn = sim.camadas.obter(id);
      return fn ? fn(sim) : null;
    });
    this.registrarValidador('tabelas', (sim) => {
      const e = [];
      for (const t of Object.values(sim.tabelas)) {
        if (t.n > t.cap) e.push(`${t.nome}: n acima de cap`);
        let vivos = 0;
        for (let i = 0; i < t.cap; i++) {
          if (!t.viva[i]) continue;
          if (i >= t.n) e.push(`${t.nome}: viva acima de n (${i})`);
          vivos++;
        }
        if (vivos !== t.vivos) e.push(`${t.nome}: contagem de vivos`);
      }
      return e;
    });
    instalarSubstitutos(this);
  }

  // ---------------------------------------------------------------------------------------------------- tempo

  /** Tiques já rodados; durante um tique, o índice dele. */
  get tique() {
    return this._tique;
  }

  get seq() {
    return this._seq;
  }

  /** Fluxo de sorteio do canal (estado no save). Só dentro de sistemas e comandos. */
  rng(canal) {
    let r = this._rngs.get(canal);
    if (!r) {
      r = new Rng(semear(this.semente, canal));
      this._rngs.set(canal, r);
    }
    return r;
  }

  /** Altura do chão pela grade do espelho (0 sem terreno). */
  alturaEm(x, z) {
    const t = this.espelho.terreno;
    return t ? alturaEm(t, x, z) : 0;
  }

  _agendaOrdenada() {
    if (!this._agenda) this._agenda = [...this._sistemas].sort((a, b) => a.ordem - b.ordem || a.reg - b.reg);
    return this._agenda;
  }

  _umTique(sincrono) {
    const T = this._tique;
    if (this.tarefas.pendentes.length && !this.tarefas.prontas(T, sincrono)) {
      if (!this.parado) {
        this.parado = true;
        this.emitir('tarefaAtrasada', { nome: this.tarefas.pendentes.find((p) => p.tiqueAplicar <= T)?.nome ?? '', tique: T });
        this._entregar();
      }
      return false;
    }
    this.parado = false;
    const crono = this.cronometro;
    const t0 = crono ? crono() : 0;
    this._emTique = true;
    try {
      this.tarefas.aplicarVencidas(T);
    } catch (e) {
      this._erro('tarefas', e);
    }
    for (const s of this._agendaOrdenada()) {
      if (!s.ativo) continue;
      const off = (((T - s.fase) % s.periodo) + s.periodo) % s.periodo;
      const k = s.mapa[off];
      if (k < 0) continue;
      const ts = crono ? crono() : 0;
      try {
        s.fn(this, k, s.fatias, T);
      } catch (e) {
        this._erro(s.nome, e);
      }
      if (crono) {
        const m = this.medidas.sistemas[s.nome] ?? (this.medidas.sistemas[s.nome] = { ms: 0, max: 0, n: 0 });
        const d = crono() - ts;
        m.ms += d;
        m.n++;
        if (d > m.max) m.max = d;
      }
    }
    this._emTique = false;
    this._tique = T + 1;
    tempoDoTique(this._tique, 0, this.velocidade, this.espelho.tempo);
    this.mudancas.fecharLote();
    this._entregar();
    this.medidas.tiques++;
    if (crono) {
      const d = crono() - t0;
      this.medidas.msUltimo = d;
      this.medidas.msTotal += d;
      if (d > this.medidas.msMax) this.medidas.msMax = d;
    }
    return true;
  }

  _erro(onde, e) {
    const msg = String(e?.stack ?? e?.message ?? e);
    if (this.erros.length < 200) this.erros.push({ tique: this._tique, onde, mensagem: msg });
    if (this.erros.length <= 3) console.error(`sim: erro em ${onde} no tique ${this._tique}: ${msg}`);
  }

  /**
   * Roda n tiques já. Para cedo (devolvendo quantos rodou) se uma tarefa do worker atrasou, a não ser com
   * sincrono: true (reprodução e Node), que calcula na hora.
   */
  rodar(n = 1, { sincrono = false } = {}) {
    let feitos = 0;
    while (feitos < n && this._umTique(sincrono)) feitos++;
    return feitos;
  }

  /**
   * Laço do app (2.8): acumula o tempo real na velocidade atual e roda até 8 tiques por quadro. Devolve os tiques
   * rodados; espelho.tempo.frac fica com a fração até o próximo, para interpolar. Parado por tarefa: devolve 0.
   */
  avancar(msReais) {
    const mult = VELOCIDADES[this.velocidade] ?? 0;
    let n = 0;
    if (mult > 0) {
      this._acum += msReais * mult;
      while (this._acum >= 1000 && n < TIQUES_POR_QUADRO) {
        if (!this._umTique(false)) break;
        this._acum -= 1000;
        n++;
      }
      // sem espiral: não guarda mais que um tique de atraso
      if (this._acum > 1000) this._acum = 1000;
    }
    if (this.tarefas.pendentes.length) this.tarefas.bombear(4);
    // hora do céu, fase e calendário do espelho andam com a fração (o sol não pula de tique em tique)
    const frac = mult > 0 ? clamp(this._acum / 1000, 0, 1) : this.espelho.tempo.frac;
    if (n || frac !== this.espelho.tempo.frac) tempoDoTique(this._tique, frac, this.velocidade, this.espelho.tempo);
    return n;
  }

  // ---------------------------------------------------------------------------------------------------- registros

  /**
   * Registra uma tabela SoA (save, hash e, com diario: true, o diário de mudanças). Devolve a Tabela.
   * @example const t = sim.registrarTabela('obras', { predio: [Int32Array, 1, -1], fim: Uint32Array }, 256);
   */
  registrarTabela(nome, colunas, cap = 1024, { teto = Infinity, diario = false, salvar = true, hash = true } = {}) {
    if (this.tabelas[nome]) throw new Error(`tabela repetida: ${nome}`);
    const t = new Tabela(nome, colunas, cap, { teto });
    if (diario) {
      this.mudancas.ligarTabela(t);
      t.aoMarcar = (i) => this.mudancas.marcarIdx(nome, i);
      t.aoCrescer = (tab) => {
        this.mudancas.crescer(nome, tab.cap);
        this.mudancas.realocado(nome);
      };
    }
    this.tabelas[nome] = t;
    this._regTabela.set(nome, { salvar, hash, diario });
    return t;
  }

  /**
   * Registra uma grade mutável ({ dados: TypedArray, n?, passo?, origem? }) para o save e o hash.
   * A grade de alturas NÃO se registra (sai da semente e das formas, D5).
   */
  registrarGrade(nome, grade, { salvar = true, hash = true } = {}) {
    if (this.grades[nome]) throw new Error(`grade repetida: ${nome}`);
    if (!grade || !TIPOS_SALVAVEIS.includes(grade.dados?.constructor)) throw new Error(`grade ${nome}: dados num array tipado do save`);
    this.grades[nome] = grade;
    this._regGrade.set(nome, { salvar, hash });
    return grade;
  }

  /**
   * Registra uma seção JSON (estado pequeno). Devolve o objeto vivo: guarde só ele, nunca objetos de dentro dele entre
   * tiques (ao carregar o conteúdo é trocado no lugar). Arrays tipados dentro viram seção binária no save.
   * @example const h = sim.registrarJson('economia', { contratos: [], janela: 0 });
   */
  registrarJson(nome, padrao = {}, { salvar = true, hash = true } = {}) {
    if (this.json[nome]) throw new Error(`seção JSON repetida: ${nome}`);
    const obj = copiaProfunda(padrao);
    this.json[nome] = obj;
    this._regJson.set(nome, { salvar, hash });
    return obj;
  }

  /**
   * Registra um sistema do tique. Com fatias = k, o sistema roda k vezes por período, espalhado, recebendo a fatia.
   * Forma posicional (periodo, fase, fn, fatias, op) ou objeto ({ periodo, fase, fn, fatias, nome, ordem }).
   * @returns {{ desligar: () => void, ligar: () => void }}
   * @example sim.registrarSistema(20, 0, (sim, fatia, fatias) => varrer(sim, fatia, fatias), 20, { nome: 'predios', ordem: 400 })
   */
  registrarSistema(periodo, fase, fn, fatias = 1, op = {}) {
    if (typeof periodo === 'object' && periodo !== null) {
      ({ periodo = 1, fase = 0, fn, fatias = 1 } = periodo);
      op = arguments[0];
    }
    if (!ehInteiro(periodo) || periodo < 1) throw new Error('registrarSistema: período inteiro >= 1');
    if (!ehInteiro(fase) || fase < 0 || fase >= periodo) throw new Error('registrarSistema: fase em [0, período)');
    if (!ehInteiro(fatias) || fatias < 1 || fatias > periodo) throw new Error('registrarSistema: fatias em [1, período]');
    if (typeof fn !== 'function') throw new Error('registrarSistema: fn');
    const mapa = new Int32Array(periodo).fill(-1);
    for (let k = 0; k < fatias; k++) mapa[Math.floor((k * periodo) / fatias)] = k;
    const s = {
      nome: op.nome ?? (fn.name || `sistema${this._sistemas.length}`),
      periodo,
      fase,
      fn,
      fatias,
      mapa,
      ordem: op.ordem ?? 500,
      substituto: op.substituto ?? null,
      ativo: true,
      reg: this._sistemas.length,
    };
    this._sistemas.push(s);
    this._agenda = null;
    return {
      desligar: () => {
        s.ativo = false;
      },
      ligar: () => {
        s.ativo = true;
      },
      sistema: s,
    };
  }

  /**
   * Registra um comando do contrato (contratos/comandos.js). fn(sim, args) → Resposta (ou undefined = ok).
   * Um comando substituto (da F0) é trocado sem erro pelo da parcela dona.
   * `foraDoContrato` só para testes.
   */
  registrarComando(nome, fn, { substituto = null, foraDoContrato = false, livro } = {}) {
    if (!COMANDOS[nome] && !foraDoContrato) throw new Error(`comando fora do contrato: ${nome}`);
    const atual = this._comandos.get(nome);
    if (atual && !atual.substituto) throw new Error(`comando repetido: ${nome}`);
    this._comandos.set(nome, { fn, substituto, livro: livro ?? (COMANDOS[nome] ? vaiNoLivro(nome) : true) });
  }

  /**
   * Registra uma consulta do contrato (contratos/consultas.js): sim.q.<nome>(...args) chama fn(sim, ...args).
   * Nomes com ponto viram objetos (q.via.previa). Pura: não pode mudar o estado.
   */
  registrarConsulta(nome, fn, { substituto = null, foraDoContrato = false } = {}) {
    if (!CONSULTAS[nome] && !foraDoContrato) throw new Error(`consulta fora do contrato: ${nome}`);
    const atual = this._consultas.get(nome);
    if (atual && !atual.substituto) throw new Error(`consulta repetida: ${nome}`);
    this._consultas.set(nome, { fn, substituto });
    const partes = nome.split('.');
    let alvo = this.q;
    for (let i = 0; i < partes.length - 1; i++) alvo = alvo[partes[i]] ?? (alvo[partes[i]] = {});
    alvo[partes[partes.length - 1]] = (...args) => fn(this, ...args);
  }

  /** Validador do carregar (validar(sim)): fn(sim) → lista de erros (texto). */
  registrarValidador(nome, fn) {
    this._validadores.set(nome, fn);
  }

  /** Parte de q.barra (S2a, S3a): fn(barra, sim) completa ou troca campos do objeto da barra. */
  registrarParteBarra(nome, fn) {
    this._partesBarra = this._partesBarra.filter((p) => p.nome !== nome);
    this._partesBarra.push({ nome, fn });
  }

  /** Chamado depois de aplicar um save (refazer índices derivados). */
  aoCarregar(fn) {
    this._aoCarregar.push(fn);
  }

  /**
   * Troca um serviço do contrato interno pelo da parcela dona e desliga os sistemas substitutos marcados com esse nome.
   * Comandos e consultas substitutos saem quando a dona registra os seus (registrarComando e registrarConsulta).
   * @example sim.implementar('holding', { pagar, receber, comprarParaObra, entregar, efeito, caixa })
   */
  implementar(servico, funcoes = {}) {
    const def = SERVICOS_INTERNOS[servico];
    if (!def) throw new Error(`serviço interno desconhecido: ${servico}`);
    const alvo = this[servico];
    for (const [k, fn] of Object.entries(funcoes)) {
      if (!def.funcoes.includes(k)) throw new Error(`${servico}.${k} não está no contrato interno`);
      alvo[k] = fn;
    }
    for (const s of this._sistemas) if (s.substituto === servico) s.ativo = false;
  }

  /** true se o substituto do serviço ainda está ligado. */
  substitutoAtivo(servico) {
    return this._sistemas.some((s) => s.substituto === servico && s.ativo);
  }

  _criarRegistros() {
    const sim = this;
    const custos = new Map();
    this.custos = {
      /** fn(sim) → créditos por hora de jogo */
      registrar(nome, fn) {
        custos.set(nome, fn);
      },
      remover(nome) {
        custos.delete(nome);
      },
      lista() {
        return [...custos.keys()].sort().map((nome) => ({ nome, valor: +custos.get(nome)(sim) || 0 }));
      },
      total() {
        let s = 0;
        for (const nome of [...custos.keys()].sort()) s += +custos.get(nome)(sim) || 0;
        return s;
      },
    };
    const colocaveis = new Map();
    this.colocaveis = {
      registrar(tipo, def) {
        if (colocaveis.has(tipo)) throw new Error(`colocável repetido: ${tipo}`);
        colocaveis.set(tipo, def);
      },
      obter: (tipo) => colocaveis.get(tipo) ?? null,
      tipos: () => [...colocaveis.keys()],
    };
    const camadas = new Map();
    this.camadas = {
      /** Só ids de contratos/camadas.js (D29); registrar de novo troca a função. */
      registrar(id, fn) {
        if (!CAMADAS[id]) throw new Error(`camada fora do contrato: ${id}`);
        camadas.set(id, fn);
      },
      obter: (id) => camadas.get(id) ?? null,
      ids: () => [...camadas.keys()],
    };
    const avisos = new Map();
    this.avisos = {
      registrar(codigo, fn) {
        avisos.set(codigo, fn);
      },
      obter: (codigo) => avisos.get(codigo) ?? null,
      codigos: () => [...avisos.keys()],
    };
    const travessias = [];
    this.travessia = {
      registrar(fn) {
        travessias.push(fn);
      },
      /** Pergunta se um trecho sobre água vira travessia (ponte); null sem registro (a via é recusada com 'agua'). */
      consultar(trecho) {
        for (const fn of travessias) {
          const r = fn(sim, trecho);
          if (r) return r;
        }
        return null;
      },
    };
    const prod = this.registrarJson('produtores', { seq: 0, lista: [] });
    this.redes = {
      /** Produtor de água ou energia; devolve o id. Estado salvo (seção 'produtores'). */
      produtor({ tipo, ref, capacidade, no }) {
        if (tipo !== 'agua' && tipo !== 'energia') throw new Error(`produtor: tipo ${tipo}`);
        const id = ++prod.seq;
        prod.lista.push({ id, tipo, ref, capacidade, no });
        return id;
      },
      remover(id) {
        const i = prod.lista.findIndex((p) => p.id === id);
        if (i >= 0) prod.lista.splice(i, 1);
        return i >= 0;
      },
      produtores: (tipo) => prod.lista.filter((p) => !tipo || p.tipo === tipo),
    };
  }

  // ---------------------------------------------------------------------------------------------------- comandos

  /**
   * Aplica um comando na hora (D17), entre dois tiques; funciona pausado. Devolve { ok, ... } ou { ok: false, codigo }.
   * Os argumentos são copiados como JSON puro, que é o que vai para o livro.
   */
  cmd(nome, args = {}) {
    const def = this._comandos.get(nome);
    if (!def) return { ok: false, codigo: 'comando' };
    if (this._emTique) {
      // um sistema que chama cmd() mudaria o estado no meio do tique e o livro não reproduziria (D17)
      this._erro(`comando ${nome}`, new Error('cmd() chamado dentro do tique; os sistemas mudam o estado direto'));
      return { ok: false, codigo: 'erro' };
    }
    const a = copiaJson(args ?? {});
    if (def.livro) {
      this._seq++;
      this.livro.anotar(this._tique, this._seq, nome, a);
    }
    let r;
    try {
      r = def.fn(this, a);
    } catch (e) {
      this._erro(`comando ${nome}`, e);
      r = { ok: false, codigo: 'erro', dados: { mensagem: String(e?.message ?? e) } };
    }
    if (r === undefined || r === null || r === true) r = { ok: true };
    else if (typeof r === 'string') r = { ok: false, codigo: r };
    else if (r.ok === undefined) r = { ok: true, ...r };
    if (!r.ok && !ehCodigo(r.codigo)) this._erro(`comando ${nome}`, new Error(`código fora do contrato: ${r.codigo}`));
    this.mudancas.fecharLote();
    this._entregar();
    return r;
  }

  // ---------------------------------------------------------------------------------------------------- eventos

  /** Ouve um evento do contrato (ou '*' para todos: fn(dados, nome)). Devolve a função que desliga. */
  on(nome, fn) {
    if (nome !== '*' && !EVENTOS[nome]) throw new Error(`evento fora do contrato: ${nome}`);
    const lista = this._ouvintes.get(nome) ?? [];
    lista.push(fn);
    this._ouvintes.set(nome, lista);
    return () => {
      const l = this._ouvintes.get(nome);
      const i = l ? l.indexOf(fn) : -1;
      if (i >= 0) l.splice(i, 1);
    };
  }

  /** Emite um evento; é entregue no fim do tique ou logo depois do comando. */
  emitir(nome, dados = {}) {
    if (!EVENTOS[nome]) throw new Error(`evento fora do contrato: ${nome}`);
    this._fila.push([nome, dados]);
  }

  _entregar() {
    while (this._fila.length) {
      const [nome, dados] = this._fila.shift();
      for (const fn of [...(this._ouvintes.get(nome) ?? []), ...(this._ouvintes.get('*') ?? [])]) {
        try {
          fn(dados, nome);
        } catch (e) {
          console.error(`sim: ouvinte de ${nome} falhou:`, e);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------------------------------- save

  /** Estado próprio do núcleo (vai no save e no hash): tique, seq e os fluxos de sorteio. */
  estadoNucleo() {
    const rng = {};
    for (const canal of [...this._rngs.keys()].sort()) rng[canal] = Array.from(this._rngs.get(canal).s);
    return { tique: this._tique, seq: this._seq, rng };
  }

  definirNucleo(d) {
    this._tique = d.tique | 0;
    this._seq = d.seq | 0;
    this._rngs.clear();
    for (const [canal, s] of Object.entries(d.rng ?? {})) this._rngs.set(canal, new Rng(Uint32Array.from(s)));
    this._acum = 0;
    this.parado = false;
    tempoDoTique(this._tique, 0, this.velocidade, this.espelho.tempo);
  }

  /** Roda os validadores (células x prédios, grafo, caixa, dívida...). Devolve [{ nome, erro }]. */
  validar() {
    const out = [];
    for (const [nome, fn] of this._validadores) {
      let lista;
      try {
        lista = fn(this) ?? [];
      } catch (e) {
        lista = [String(e?.message ?? e)];
      }
      for (const erro of lista) out.push({ nome, erro });
    }
    return out;
  }

  /** Hash do estado (FNV-1a sobre as seções binárias e o JSON canônico). */
  hash() {
    return hashEstado(this);
  }

  /** Registros para o formato do save (somente leitura). */
  get registros() {
    return { tabelas: this._regTabela, grades: this._regGrade, json: this._regJson };
  }
}

/** Cria uma simulação só com o núcleo e os substitutos (sem os domínios; para isso, estado.js). */
export const criarSim = (op) => new Sim(op);
