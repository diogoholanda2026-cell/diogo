// Diário síncrono (D31; dona: U2a). O IndexedDB e o gzip são assíncronos e o Android mata a aba no meio; o diário
// fica no localStorage ('heldopolis.diario'), gravado na hora: a base (o save de onde a partida parte), os comandos do
// livro desde ela, o tique atual (a cada segundo, a cada comando e ao pausar) e o carimbo da página (id da sessão,
// tique e hora). Carregar = a base mais a reprodução dos comandos até o tique gravado (a simulação é determinística,
// D17, então o diário é pequeno). O carimbo refaz a trava "outra página gravou": se outra aba gravou a mesma partida
// depois desta, esta para de gravar e recarrega ao voltar (a de lá é a mais nova).
//
// Formato (v 1): { v, partida, ramo, base, cmds: [[tique, seq, nome, args]], tique, carimbo: { sessao, tique, t } }
//   base: { slot, criado, tique, seq } (um save) ou { nova: { semente, holding, modo } } (antes do primeiro save);
//   ramo: a linhagem (muda quando o jogador carrega um save velho: os saves de outro ramo são outro futuro)
import { SAVE } from '../contratos/save.js';
import { reproduzir } from '../sim/livro.js';
import { localSeguro } from './armazem.js';

export const VERSAO_DIARIO = 1;
/** Acima disto o diário pede um save (o livro da simulação guarda 2.000; o diário não depende dele). */
export const MAX_COMANDOS = 4000;
/** Grava o tique a cada segundo real. */
export const INTERVALO_MS = 1000;

/** Lê e confere um diário (texto do localStorage). null se não houver ou se não for um diário válido. */
export function lerDiario(texto) {
  if (!texto) return null;
  try {
    const d = JSON.parse(texto);
    if (!d || d.v !== VERSAO_DIARIO || typeof d.partida !== 'string' || !Array.isArray(d.cmds) || !Number.isFinite(d.tique)) return null;
    if (!d.base || (!d.base.nova && !(typeof d.base.slot === 'string' && Number.isFinite(d.base.criado)))) return null;
    return d;
  } catch (e) {
    return null;
  }
}

/** O diário vale para este save? (mesma partida e mesma base: o espaço e o carimbo de criação do save) */
export const diarioDoSave = (d, meta) => !!(d && meta && d.base?.slot === meta.slot && d.base?.criado === meta.criado && (!meta.partida || meta.partida === d.partida));

/**
 * Reproduz o diário numa simulação aberta da base (D17): os comandos depois da base, até o tique gravado.
 * @returns {{ aplicados: number, recusados: object[], tique: number }}
 */
export function reproduzirDiario(sim, d) {
  const seq0 = d.base?.seq ?? 0;
  const cmds = d.cmds.filter((e) => e[1] > seq0 && e[0] >= sim.tique);
  const ate = Math.max(sim.tique, d.tique);
  const r = reproduzir(sim, cmds, ate);
  return { ...r, tique: sim.tique };
}

/**
 * Diário de uma página.
 * @param {{ local?: object, sessao: string, agora?: () => number }} op
 */
export function criarDiario({ local = localSeguro(), sessao, agora = () => Date.now() } = {}) {
  const chave = SAVE.chaves.diario;
  let atual = null;
  let ultimoSeq = 0;
  let meuT = 0; // hora da última gravação desta página (ou da leitura, ao assumir a partida)
  let ultimaGravacao = -Infinity;
  let sujo = false;
  let parado = null; // motivo ('outraPagina') quando esta página não grava mais
  let falhou = false; // o localStorage recusou a última gravação (cheio): pede um save, que esvazia o diário
  let meuTexto = null; // o último texto gravado por esta página (conferir a outra página sem ler o JSON)

  const diario = {
    ler: () => lerDiario(local.get(chave)),
    get atual() {
      return atual;
    },
    get parado() {
      return parado;
    },
    /**
     * Assume uma partida: a base, os comandos já aplicados desde ela (reproduzidos ao carregar) e o tique. Grava na hora.
     */
    comecar({ partida, ramo = null, base, cmds = [], tique = 0, seqVisto = null }) {
      atual = { v: VERSAO_DIARIO, partida, ramo, base, cmds: cmds.map((e) => [e[0], e[1], e[2], e[3]]), tique, carimbo: null };
      ultimoSeq = seqVisto ?? cmds.reduce((m, e) => Math.max(m, e[1]), base?.seq ?? 0);
      parado = null;
      meuT = Math.max(meuT, diario.ler()?.carimbo?.t ?? 0);
      diario.gravar(true);
      return atual;
    },
    /** Larga a partida (menu inicial): o diário fica no localStorage como está. */
    largar() {
      atual = null;
    },
    /** Junta os comandos novos do livro e o tique; true se algo mudou. */
    acompanhar(sim) {
      if (!atual || !sim) return false;
      let mudou = false;
      const livro = sim.livro;
      if (livro && livro.ultimoSeq > ultimoSeq) {
        for (const e of livro.desde(ultimoSeq)) {
          atual.cmds.push([e[0], e[1], e[2], e[3]]);
          ultimoSeq = e[1];
        }
        mudou = true;
      }
      if (sim.tique !== atual.tique) {
        atual.tique = sim.tique;
        sujo = true;
      }
      if (mudou) sujo = true;
      return mudou;
    },
    /** Precisa de save já (diário grande demais, ou o localStorage recusou). */
    cheio: () => !!atual && (falhou || atual.cmds.length > MAX_COMANDOS),
    /** Grava no localStorage se passou o intervalo (ou forcar). Devolve true se gravou. */
    talvez(tMs, forcar = false) {
      if (!atual || parado) return false;
      if (!forcar && (!sujo || tMs - ultimaGravacao < INTERVALO_MS)) return false;
      ultimaGravacao = tMs;
      return diario.gravar();
    },
    /** Gravação síncrona (segundo plano, comando, pausa, começo de save). Confere antes se outra página gravou. */
    gravar(forcarDono = false) {
      if (!atual || parado) return false;
      if (!forcarDono && diario.outraPagina()) {
        parado = 'outraPagina';
        return false;
      }
      const t = Math.max(agora(), meuT + 1);
      atual.carimbo = { sessao, tique: atual.tique, t };
      const texto = JSON.stringify(atual);
      const ok = local.set(chave, texto);
      falhou = !ok;
      if (ok) {
        meuT = t;
        meuTexto = texto;
        sujo = false;
      }
      return ok;
    },
    /**
     * Outra página gravou a mesma partida depois desta (trava herdada, agora pelo carimbo): ela é a mais nova.
     */
    outraPagina() {
      if (!atual) return false;
      const texto = local.get(chave);
      if (texto !== null && texto === meuTexto) return false; // o último texto é o desta página: ninguém gravou depois
      const d = lerDiario(texto);
      return !!(d && d.partida === atual.partida && d.carimbo && d.carimbo.sessao !== sessao && d.carimbo.t > meuT);
    },
    /**
     * Um save terminou: ele vira a base e os comandos até o seq dele saem do diário. Só troca por uma base mais nova.
     */
    fixarBase(base) {
      if (!atual || parado) return false;
      const velha = atual.base;
      if (velha && !velha.nova && Number.isFinite(velha.seq) && (base.tique < velha.tique || base.seq < velha.seq)) return false;
      atual.base = { slot: base.slot, criado: base.criado, tique: base.tique, seq: base.seq };
      atual.cmds = atual.cmds.filter((e) => e[1] > base.seq);
      return diario.gravar();
    },
  };
  return diario;
}

/** registrar(app) vem de app/controle.js; quem liga o diário ao app é o salvamento.js. */
export function registrar() {}
