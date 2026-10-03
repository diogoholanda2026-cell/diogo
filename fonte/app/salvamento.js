// Salvamento (D31, seção 2.9; dona: U2a): liga o armazém (IndexedDB) e o diário (localStorage) ao app e publica a API
// do `jogo` (seção 2.8): salvar, carregar, listarSaves, exportar, importar, e ainda continuar, apagarSave,
// sairParaMenu, quarentena e armazenamento. A persistência só liga quando o jogador entra numa partida (Continuar,
// Nova partida, Carregar ou Importar): a simulação que o app monta na carga, por trás do menu inicial, nunca grava
// por cima do diário da partida de verdade.
//   automático: a cada 5 min de relógio real se algo mudou, em rodízio nos 3 espaços automáticos, com a capa;
//   segundo plano: diário na hora e save SEM gzip (termina antes de o Android congelar a aba);
//   diário: a cada comando, ao pausar, no começo de cada save e a cada segundo (diario.js);
//   carregar: o save mais novo da linhagem do diário, aberto numa simulação nova e validado, mais a reprodução do
//   diário até o tique gravado; o save que não abre vai para a quarentena e o próximo é tentado.
import { SAVE } from '../contratos/save.js';
import { salvar as gerarBytes, abrirSave, lerSave, descomprimir, ehGzip } from '../sim/salvar/formato.js';
import { criarSimulacao } from '../sim/estado.js';
import { calendario } from '../comum/relogio.js';
import { SESSAO } from '../ui/acoes.js';
import { avisar } from '../ui/loja.js';
import { t } from '../ui/textos.js';
import {
  criarArmazem, bancoIndexedDB, bancoNaMemoria, localSeguro, proximoAuto, proximoManual, pedirPersistencia,
  situacaoArmazenamento, nomeArquivo, ehSlot, ehAuto, SLOTS_MANUAIS,
} from './armazem.js';
import { criarDiario, reproduzirDiario } from './diario.js';

/** Salvamento automático a cada 5 min de relógio real (D31). */
export const AUTO_MS = 5 * 60 * 1000;
/** Teto de espera da capa (o render desenha um quadro e o canvas vira JPEG). */
const CAPA_MS = 2500;
/** Maior arquivo aceito na importação. */
const MAX_IMPORTAR = 64 * 1048576;

const novoId = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e8).toString(36)}`;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const comTeto = (p, ms) => Promise.race([p, esperar(ms).then(() => null)]);

/** O save é da linhagem do diário? (mesma partida e ramo, entre a base e o tique gravado) */
export function serveAoDiario(meta, d) {
  if (!meta || !d || !meta.ramo || meta.ramo !== d.ramo || meta.partida !== d.partida) return false;
  const base = d.base ?? {};
  return (meta.tique ?? 0) <= d.tique && (meta.seq ?? 0) >= (base.seq ?? 0);
}

/** Ordem de tentativa no Continuar: os saves da linhagem do diário (o mais adiantado primeiro), depois o último. */
export function ordemContinuar(metas, d, ultimo = null) {
  const daLinhagem = d ? metas.filter((m) => serveAoDiario(m, d)).sort((a, b) => (b.tique ?? 0) - (a.tique ?? 0) || (b.data ?? 0) - (a.data ?? 0)) : [];
  const resto = metas.filter((m) => !daLinhagem.includes(m)).sort((a, b) => (b.slot === ultimo) - (a.slot === ultimo) || (b.data ?? 0) - (a.data ?? 0));
  return [...daLinhagem.map((m) => ({ meta: m, diario: true })), ...resto.map((m) => ({ meta: m, diario: false }))];
}

/**
 * O que o Continuar abre, para o menu inicial mostrar ("Onde você parou"): a partida do diário que caiu antes do
 * primeiro save, o save da linhagem do diário com a data do tique gravado no diário, ou o último save. null sem nada.
 */
export function resumoContinuar(metas, d, ultimo = null) {
  if (d?.base?.nova) {
    const c = calendario(d.tique);
    return { nome: d.base.nova.holding?.nome ?? '', populacao: null, mes: c.mes, ano: c.ano, data: null, partida: d.partida };
  }
  const [primeiro] = ordemContinuar(metas, d, ultimo);
  if (!primeiro) return null;
  if (!primeiro.diario) return primeiro.meta;
  const c = calendario(d.tique);
  return { ...primeiro.meta, mes: c.mes, ano: c.ano };
}

/** Resumo do save para o menu (meta do IndexedDB, seção 2.9) tirado da simulação. */
export function metaDaSim(sim, extra = {}) {
  const b = sim.q?.barra?.() ?? {};
  const cal = calendario(sim.tique);
  const ident = sim.json?.identidade ?? {};
  return {
    nome: ident.nome ?? '',
    cor: ident.cor ?? '',
    tique: sim.tique,
    seq: sim.livro?.ultimoSeq ?? 0,
    populacao: Math.round(b.populacao ?? 0),
    creditos: Math.round(b.creditos ?? 0),
    marco: b.marco?.n ?? 0,
    mes: b.data?.mes ?? cal.mes,
    ano: b.data?.ano ?? cal.ano,
    versao: SAVE.versaoSave,
    ...extra,
  };
}

/**
 * O salvamento sem o app (testes no Node e o app): armazém, diário e as operações.
 * @param {{ obterSim: () => object, trocarSim: (sim) => void, criarSim?: (op) => object, banco?: object, local?: object,
 *           agora?: () => number, capa?: () => Promise<Blob|null>, camera?: () => object|null, aoSalvar?: (r) => void }} op
 */
export function criarSalvamento({
  obterSim, trocarSim, criarSim = (op) => criarSimulacao(op), banco = null, local = localSeguro(), agora = () => Date.now(),
  capa = async () => null, camera = () => null, aoSalvar = () => {}, sessao = SESSAO,
} = {}) {
  const arm = criarArmazem({ banco: banco ?? (typeof indexedDB !== 'undefined' ? bancoIndexedDB() : bancoNaMemoria()), local, agora });
  const diario = criarDiario({ local, sessao, agora });
  const E = { ativo: false, partida: null, ramo: null, criador: null, emCurso: new Set(), marca: null, atraso: 0, ultimoCriado: 0, avisouOutra: false };

  const mudou = () => {
    const sim = obterSim();
    return !!sim && (!E.marca || E.marca.tique !== sim.tique || E.marca.seq !== (sim.livro?.ultimoSeq ?? 0));
  };

  /** Liga a persistência numa partida: o diário assume a base e os comandos já aplicados. */
  function assumir({ partida, ramo, criador = null, base, cmds = [], marca = null }) {
    const sim = obterSim();
    E.ativo = true;
    E.partida = partida;
    E.ramo = ramo;
    E.criador = criador;
    E.marca = marca;
    E.avisouOutra = false;
    diario.comecar({ partida, ramo, base, cmds, tique: sim.tique, seqVisto: sim.livro?.ultimoSeq ?? 0 });
  }

  async function salvar(slot = 'auto', { comprimido = true, comCapa = true, evitar = [] } = {}) {
    const sim = obterSim();
    if (!E.ativo || !sim) return { ok: false, codigo: 'nada' };
    if (arm.travado()) return { ok: false, codigo: 'ocupado' };
    if (diario.parado) return { ok: false, codigo: 'outraPagina' };
    let metas = [];
    try {
      metas = await arm.listar();
    } catch (e) {
      return { ok: false, codigo: 'erro', dados: { mensagem: String(e?.message ?? e) } };
    }
    let alvo = slot;
    let semEspaco = false;
    if (slot === 'manual') {
      alvo = proximoManual(metas, E.partida);
      if (!alvo) {
        semEspaco = true; // os 8 manuais ocupados por outras partidas: vai para o rodízio (nada some)
        alvo = 'auto';
      }
    }
    if (alvo === 'auto') alvo = proximoAuto(metas, [...E.emCurso, ...evitar]);
    if (evitar.includes(alvo)) return { ok: false, codigo: 'ocupado' };
    if (!ehSlot(alvo)) return { ok: false, codigo: 'valor' };
    if (E.emCurso.has(alvo)) return { ok: false, codigo: 'ocupado' };
    E.emCurso.add(alvo);
    try {
      // o diário vai para o disco antes de tudo: se a aba morrer no meio do save, nada se perde
      diario.acompanhar(sim);
      diario.gravar();
      // outra aba assumiu esta partida agora mesmo: o retrato desta é velho e não pode virar save da mesma linhagem
      if (diario.parado) return { ok: false, codigo: 'outraPagina' };
      const criado = (E.ultimoCriado = Math.max(agora(), E.ultimoCriado + 1));
      const tique = sim.tique;
      const seq = sim.livro?.ultimoSeq ?? 0;
      const vista = { camera: camera(), velocidade: sim.velocidade ?? 0, partida: E.partida, criador: E.criador };
      const nome = sim.json?.identidade?.nome ?? '';
      const promessa = gerarBytes(sim, { nome, criado, vista, comprimido }); // o retrato é tirado aqui, síncrono
      const meta = metaDaSim(sim, { criado, data: criado, partida: E.partida, ramo: E.ramo, criador: E.criador, comprimido, auto: ehAuto(alvo) });
      const [bytes, jpeg] = await Promise.all([promessa, comCapa ? comTeto(capa().catch(() => null), CAPA_MS) : null]);
      meta.capa = jpeg ?? (comCapa ? null : metas.find((m) => m.partida === E.partida && m.capa)?.capa ?? null);
      if (E.atraso) await esperar(E.atraso);
      const r = await arm.gravar(alvo, bytes, meta, { duravel: !ehAuto(alvo) });
      if (!r.ok) return r;
      if (E.partida === meta.partida) {
        diario.fixarBase({ slot: alvo, criado, tique, seq });
        if (!E.marca || tique >= E.marca.tique) E.marca = { tique, seq };
      }
      const resp = { ok: true, slot: alvo, semEspaco, meta: r.meta };
      aoSalvar(resp);
      return resp;
    } catch (e) {
      console.error('salvar', e);
      return { ok: false, codigo: 'erro', dados: { mensagem: String(e?.message ?? e) } };
    } finally {
      E.emCurso.delete(alvo);
    }
  }

  /** Abre um save numa simulação nova; com o diário da linhagem, reproduz até o tique gravado. */
  async function abrir(meta, d = null) {
    const lido = await arm.ler(meta.slot);
    if (!lido) return { ok: false, codigo: 'nada' };
    let aberto;
    try {
      aberto = await abrirSave(lido.bytes, ({ semente, mapa }) => criarSim({ semente, mapa }));
    } catch (e) {
      return { ok: false, codigo: 'danificado', dados: { mensagem: String(e?.message ?? e) } };
    }
    const { sim, cab, erros } = aberto;
    if (erros.some((x) => x.nome === 'hash')) return { ok: false, codigo: 'danificado', dados: { mensagem: erros.map((x) => x.erro).join('; ') } };
    const avisos = erros.map((x) => `${x.nome}: ${x.erro}`);
    let reproduzidos = 0;
    let cmds = [];
    if (d) {
      try {
        const r = reproduzirDiario(sim, { ...d, base: { ...d.base, seq: meta.seq ?? cab.nucleo?.seq ?? 0 } });
        reproduzidos = r.aplicados;
        cmds = d.cmds.filter((e) => e[1] > (meta.seq ?? 0));
      } catch (e) {
        avisos.push(`diário: ${e?.message ?? e}`);
        return { ok: true, sim, cab, avisos, reproduzidos: 0, cmds: [], diarioFalhou: true };
      }
    }
    return { ok: true, sim, cab, avisos, reproduzidos, cmds };
  }

  /** Troca para o save aberto e assume a partida (com o diário reproduzido ou numa linhagem nova). */
  function entrarNoSave(meta, aberto, { comDiario }) {
    const { sim, cab } = aberto;
    trocarSim(sim, cab);
    arm.definirUltimo(meta.slot);
    const partida = meta.partida ?? cab.vista?.partida ?? novoId();
    const usouDiario = comDiario && !aberto.diarioFalhou;
    const ramo = usouDiario ? meta.ramo : novoId();
    assumir({
      partida, ramo, criador: meta.criador ?? cab.vista?.criador ?? null,
      base: { slot: meta.slot, criado: meta.criado ?? cab.criado, tique: meta.tique ?? cab.tique, seq: meta.seq ?? 0 },
      cmds: usouDiario ? aberto.cmds : [],
      // o estado do save: com o diário reproduzido além dele, o automático grava o que andou
      marca: { tique: meta.tique ?? cab.tique, seq: meta.seq ?? cab.nucleo?.seq ?? 0 },
    });
    return { ok: true, slot: meta.slot, reproduzidos: aberto.reproduzidos ?? 0, avisos: aberto.avisos ?? [], cab };
  }

  /** Tenta os saves na ordem; o que não abre vai para a quarentena. */
  async function tentar(lista) {
    const danificados = [];
    for (const { meta, diario: comDiario } of lista) {
      const d = comDiario ? diario.ler() : null;
      const r = await abrir(meta, d);
      if (!r.ok) {
        if (r.codigo === 'danificado') {
          danificados.push(meta.slot);
          await arm.quarentena(meta.slot, r.dados?.mensagem ?? '').catch(() => {});
          continue;
        }
        continue;
      }
      return { ...entrarNoSave(meta, r, { comDiario }), danificados };
    }
    return { ok: false, codigo: 'nada', danificados };
  }

  const api = {
    arm,
    diario,
    E,
    mudou,
    salvar,
    /**
     * Continuar (menu inicial): a linhagem do diário (com a reprodução) ou o último save. O diário é sempre da última
     * partida jogada: se ela caiu antes do primeiro save, volta pela semente e pelos comandos e salva na hora.
     */
    async continuar() {
      const d = diario.ler();
      if (d?.base?.nova) {
        const r = api.reconstruirNova(d);
        if (r.ok) {
          salvar('auto');
          return r;
        }
      }
      const metas = await arm.listar();
      return tentar(ordemContinuar(metas, d, arm.ultimo()));
    },
    /** Partida que caiu antes do primeiro save: a semente e a identidade do diário mais os comandos. */
    reconstruirNova(d) {
      const n = d.base.nova;
      const sim = criarSim({ semente: n.semente, holding: n.holding, modo: n.modo });
      try {
        reproduzirDiario(sim, { ...d, base: { seq: 0 } });
      } catch (e) {
        return { ok: false, codigo: 'danificado', dados: { mensagem: String(e?.message ?? e) } };
      }
      trocarSim(sim, null);
      assumir({ partida: d.partida, ramo: d.ramo ?? novoId(), criador: n.criador ?? null, base: d.base, cmds: d.cmds });
      return { ok: true, slot: null, reproduzidos: d.cmds.length };
    },
    /** Carregar um espaço escolhido (sem o diário: é uma volta no tempo; a partida de agora é salva antes). */
    async carregar(slot) {
      // a partida de agora vai para o rodízio, nunca por cima do espaço que vai ser aberto (o automático mais velho)
      if (E.ativo && mudou()) await salvar('auto', { evitar: [slot] });
      const meta = (await arm.listar()).find((m) => m.slot === slot);
      if (!meta) return { ok: false, codigo: 'nada' };
      return tentar([{ meta, diario: false }]);
    },
    /** Nova partida já trocada pelo app: liga a persistência e grava o primeiro save. */
    async comecarNova({ semente, nome, cor, modo = 'normal', criador = null } = {}) {
      const partida = novoId();
      // os comandos que a simulação nova já tem (a identidade com o criador, dada pelo app antes daqui) vão para o
      // diário: a partida que cair antes do primeiro save volta com eles, no mesmo seq e no mesmo hash
      const cmds = obterSim()?.livro?.desde(0) ?? [];
      assumir({ partida, ramo: novoId(), criador, base: { nova: { semente, holding: { nome, cor }, modo, criador } }, cmds, marca: null });
      return salvar('auto');
    },
    /** Larga a partida (menu inicial): salva se mudou e para de gravar. */
    async largar() {
      const r = E.ativo && mudou() ? await salvar('auto') : { ok: true };
      E.ativo = false;
      diario.largar();
      return r;
    },
    async listarSaves() {
      try {
        return await arm.listar();
      } catch (e) {
        return [];
      }
    },
    async apagarSave(slot) {
      const r = await arm.apagar(slot);
      // era a base do diário da partida em jogo: um save novo vira a base (senão a aba que cair perde o que andou)
      if (r.ok && E.ativo && diario.atual?.base?.slot === slot) await salvar('auto', { evitar: [slot] });
      return r;
    },
    /**
     * Bytes do save (um espaço, uma cópia da quarentena ou o último) para exportar. Sem espaço e com a partida em
     * jogo, salva antes: o arquivo leva a partida de agora, não a de até 5 min atrás.
     */
    async exportar(slot = null) {
      let agoraSalvo = null;
      if (!slot && E.ativo && mudou()) {
        const r = await salvar('auto');
        if (r.ok) agoraSalvo = r.slot;
      }
      const metas = await arm.listar();
      const chave = slot ?? agoraSalvo ?? diario.atual?.base?.slot ?? arm.ultimo() ?? metas[0]?.slot;
      if (!chave) return { ok: false, codigo: 'nada' };
      const bytes = await arm.bytes(chave);
      if (!bytes) return { ok: false, codigo: 'nada' };
      const meta = metas.find((m) => m.slot === chave) ?? (await arm.listarQuarentena()).find((m) => m.slot === chave) ?? {};
      return { ok: true, bytes, nome: nomeArquivo(meta.nome || 'partida', meta.data ?? agora()), slot: chave };
    },
    /**
     * Importar (.held, cru ou gzip) com a trava herdada: nada grava enquanto o arquivo entra; ele é conferido inteiro
     * (cabeçalho, versão, validação e hash) antes de ocupar um espaço, e a partida importada abre na hora.
     */
    async importar(arquivo) {
      if (!arquivo) return { ok: false, codigo: 'nada' };
      arm.travar('importacao');
      try {
        if (E.ativo && mudou()) {
          arm.destravar();
          await salvar('auto');
          arm.travar('importacao');
        }
        if (Number.isFinite(arquivo.size) && (arquivo.size <= 0 || arquivo.size > MAX_IMPORTAR)) return { ok: false, codigo: 'valor' };
        const bytes = arquivo instanceof Uint8Array ? arquivo : new Uint8Array(await arquivo.arrayBuffer());
        if (!bytes.length || bytes.length > MAX_IMPORTAR) return { ok: false, codigo: 'valor' };
        let cab;
        try {
          cab = lerSave(ehGzip(bytes) ? await descomprimir(bytes) : bytes).cab;
        } catch (e) {
          return { ok: false, codigo: 'valor', dados: { mensagem: String(e?.message ?? e) } };
        }
        let aberto;
        try {
          aberto = await abrirSave(bytes, ({ semente, mapa }) => criarSim({ semente, mapa }));
        } catch (e) {
          return { ok: false, codigo: 'danificado', dados: { mensagem: String(e?.message ?? e) } };
        }
        if (aberto.erros.some((x) => x.nome === 'hash')) return { ok: false, codigo: 'danificado' };
        const metas = await arm.listar();
        const slot = SLOTS_MANUAIS.find((s) => !metas.some((m) => m.slot === s)) ?? proximoAuto(metas, [...E.emCurso]);
        const criado = (E.ultimoCriado = Math.max(agora(), E.ultimoCriado + 1));
        const partida = cab.vista?.partida ?? novoId();
        const ramo = novoId();
        const meta = metaDaSim(aberto.sim, { criado, data: criado, partida, ramo, criador: cab.vista?.criador ?? null, importado: true, auto: ehAuto(slot) });
        meta.criado = cab.criado || criado;
        const r = await arm.gravar(slot, bytes, meta, { ignorarTrava: true });
        if (!r.ok) return r;
        trocarSim(aberto.sim, aberto.cab);
        arm.definirUltimo(slot);
        assumir({ partida, ramo, criador: meta.criador, base: { slot, criado: meta.criado, tique: meta.tique, seq: meta.seq }, marca: { tique: meta.tique, seq: meta.seq } });
        return { ok: true, slot, cab };
      } finally {
        arm.destravar();
      }
    },
    quarentena: () => arm.listarQuarentena(),
    armazenamento: () => situacaoArmazenamento(),
    persistir: () => pedirPersistencia(),
  };
  return api;
}

// ------------------------------------------------------------------------------------------------ app

/**
 * Liga o salvamento ao app (app/controle.js chama registrar(app) antes de montar a interface): implementa as funções
 * do `jogo` e acrescenta continuar, apagarSave, sairParaMenu, quarentena, armazenamento e app.salvamento (estado e
 * ganchos de teste).
 */
export function registrar(app) {
  if (typeof window === 'undefined') return;
  const S = criarSalvamento({
    obterSim: () => app.sim,
    trocarSim: (sim, cab) => {
      app.trocarSim(sim);
      const cam = cab?.vista?.camera;
      if (cam && app.R?.camera?.definir) {
        try {
          app.R.camera.definir(cam);
        } catch (e) {
          // câmera de um save velho: fica a de agora
        }
      }
    },
    capa: () => (app.R?.capa ? app.R.capa(SAVE.capa[0], SAVE.capa[1]) : Promise.resolve(null)),
    camera: () => {
      try {
        return app.R?.camera?.estado?.() ?? null;
      } catch (e) {
        return null;
      }
    },
    aoSalvar: (r) => app.emitir('salvo', r),
  });
  if (S.arm.importacaoInterrompida()) {
    S.arm.destravar();
    console.warn('salvamento: a importação anterior não terminou; os saves seguem como estavam');
  }

  const avisoFalha = (r) => {
    if (r?.codigo === 'outraPagina') avisar({ texto: t('u2.salvar.outraPagina'), gravidade: 'atencao', glifo: 'salvar' });
  };
  const salvarPublico = async (slot = 'manual', op = {}) => {
    const r = await S.salvar(slot, op);
    avisoFalha(r);
    if (r.ok && r.semEspaco) avisar({ texto: t('u2.salvar.semEspaco'), gravidade: 'info', glifo: 'salvar' });
    return r;
  };
  const posCarregar = (r) => {
    if (r?.danificados?.length) avisar({ texto: t('u2.carregar.danificado', { n: r.danificados.length }), gravidade: 'atencao', glifo: 'alerta' });
    if (r?.avisos?.length) console.warn('carregar:', r.avisos);
    if (r?.ok) {
      app.R?.estado?.('livre');
      app.emitir('carregado', { slot: r.slot });
    }
    return r;
  };

  app.implementar({
    salvar: salvarPublico,
    carregar: async (slot) => posCarregar(await S.carregar(slot)),
    listarSaves: () => S.listarSaves(),
    // os bytes e o nome do arquivo; quem baixa ou compartilha é a tela (inicio/corpo/comum.js)
    exportar: (slot = null) => S.exportar(slot),
    importar: async (arquivo) => posCarregar(await S.importar(arquivo)),
  });
  // nova partida do app (controle.js): salva a de agora, troca e liga a persistência com o primeiro save
  const novaDoApp = app.novaPartida;
  app.novaPartida = async (op = {}) => {
    if (S.E.ativo) await S.largar();
    const r = await novaDoApp.call(app, op);
    if (!r?.ok) return r;
    const sim = app.sim;
    // o criador vai no comando da identidade (a S3a guarda quando aceitar o campo; hoje é ignorado sem erro)
    if (op.criador) sim.cmd('holding.identidade', { nome: op.nome, cor: op.cor, modo: op.modo ?? 'normal', criador: op.criador });
    await S.comecarNova({ semente: sim.semente, nome: op.nome, cor: op.cor, modo: op.modo ?? 'normal', criador: op.criador ?? null });
    app.R?.estado?.('livre');
    // a abertura (U2b) e quem mais quiser saber que uma partida nasceu
    app.emitir('novaPartida', { nome: op.nome, cor: op.cor, criador: op.criador ?? null });
    return { ok: true };
  };
  app.continuar = async () => posCarregar(await S.continuar());
  app.apagarSave = (slot) => S.apagarSave(slot);
  app.quarentena = () => S.quarentena();
  app.armazenamento = () => S.armazenamento();
  app.persistir = () => S.persistir();
  app.temPartida = () => S.E.ativo;
  app.temDiario = () => !!S.diario.ler();
  app.resumoContinuar = async () => resumoContinuar(await S.listarSaves(), S.diario.ler(), S.arm.ultimo());
  // Sair para o menu inicial: salva, larga a partida e avisa a interface (ui/inicio). Só onde há menu inicial: com
  // ?menu=0, nas cenas e na cidade sintética ninguém o abre e o jogo ficaria coberto e parado (o item some do menu)
  const temMenu = !app.cena && (app.tipo ?? 'partida') === 'partida' && new URLSearchParams(location.search).get('menu') !== '0';
  if (temMenu) app.sairParaMenu = async () => {
    const r = await S.largar();
    try {
      app.sim?.cmd?.('velocidade', { v: 0 });
    } catch (e) {
      // sem velocidade nesta simulação
    }
    app.R?.estado?.('coberto');
    app.emitir('menuInicial', {});
    return r;
  };
  app.salvamento = {
    estado: () => ({ ativo: S.E.ativo, partida: S.E.partida, ramo: S.E.ramo, criador: S.E.criador, emCurso: [...S.E.emCurso], marca: S.E.marca, parado: S.diario.parado, travado: S.arm.travado(), diario: S.diario.atual }),
    /** Gancho de teste: segura a gravação no IndexedDB por ms (o retrato já foi tirado). */
    atrasar: (ms) => (S.E.atraso = Math.max(0, +ms || 0)),
    mudou: () => S.mudou(),
  };

  // a cada quadro: o diário acompanha o livro (comando novo grava na hora; o tique, a cada segundo) e o automático
  let tAuto = null;
  app.aoQuadro((tMs) => {
    if (!S.E.ativo) {
      tAuto = null;
      return;
    }
    const sim = app.sim;
    if (tAuto === null) tAuto = tMs;
    if (S.diario.acompanhar(sim)) S.diario.talvez(tMs, true);
    else S.diario.talvez(tMs);
    if (S.diario.parado === 'outraPagina' && !S.E.avisouOutra) {
      S.E.avisouOutra = true;
      avisar({ texto: t('u2.salvar.outraPagina'), gravidade: 'atencao', glifo: 'salvar' });
    }
    // um save por vez: o diário cheio esperando o save em curso não dispara outro a cada quadro
    const auto = app.prefs?.autoSalvar !== false;
    if (!S.E.emCurso.size && ((auto && tMs - tAuto >= AUTO_MS && S.mudou()) || S.diario.cheio())) {
      tAuto = tMs;
      S.salvar('auto');
    }
  });
  // pausar grava o tique exato (nenhum tique se perde com o jogo parado)
  let soltarVel = null;
  const ligarSim = (sim) => {
    soltarVel?.();
    soltarVel = sim?.on?.('velocidade', ({ v }) => {
      if (v === 0 && S.E.ativo) {
        S.diario.acompanhar(sim);
        S.diario.gravar();
      }
    });
  };
  ligarSim(app.sim);
  app.on('trocouSim', ({ sim }) => ligarSim(sim));
  // segundo plano: diário na hora e o save cru; ao voltar, se outra aba gravou esta partida, recarrega
  const gravarJa = () => {
    if (!S.E.ativo) return;
    S.diario.acompanhar(app.sim);
    S.diario.gravar();
  };
  app.aoSegundoPlano((oculto) => {
    if (oculto) {
      gravarJa();
      if (S.E.ativo && app.prefs?.autoSalvar !== false && S.mudou()) S.salvar('auto', { comprimido: false, comCapa: false });
    } else if (S.E.ativo && (S.diario.parado === 'outraPagina' || S.diario.outraPagina())) {
      location.reload();
    }
  });
  addEventListener('pagehide', gravarJa);
  document.addEventListener('freeze', gravarJa);
}
