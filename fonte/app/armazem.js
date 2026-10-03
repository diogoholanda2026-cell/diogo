// Armazém dos saves (D31, seção 2.9; dona: U2a). IndexedDB 'heldopolis' com duas lojas: 'saves' (espaço para os bytes
// do save) e 'meta' (espaço para o resumo que o menu mostra, com a capa JPEG de 640 x 288). Os dois vão na MESMA
// transação: ou entram juntos ou nenhum entra (o Android pode matar a aba no meio e o save de antes fica inteiro).
// Espaços: 3 automáticos em rodízio ('auto1' a 'auto3') e 8 manuais ('manual1' a 'manual8'). As travas herdadas do jogo
// antigo (antigo/fonte/core/salvar.js): a da importação (nada grava por cima enquanto o arquivo importado entra), a
// quarentena do save danificado (nunca se apaga: vai para 'quarentena.<carimbo>', as 3 mais novas ficam) e o
// armazenamento persistente (o Chrome não apaga o jogo quando o aparelho enche). "Outra página gravou" é do diário.
// O banco é trocável: bancoIndexedDB() no navegador e bancoNaMemoria() nos testes do Node.
import { SAVE } from '../contratos/save.js';

export const SLOTS_AUTO = Object.freeze(Array.from({ length: SAVE.vagas.automaticos }, (_, i) => `auto${i + 1}`));
export const SLOTS_MANUAIS = Object.freeze(Array.from({ length: SAVE.vagas.manuais }, (_, i) => `manual${i + 1}`));
export const PREFIXO_QUARENTENA = 'quarentena.';
export const MAX_QUARENTENA = 3;
export const CHAVE_IMPORTANDO = 'heldopolis.importando';

export const ehAuto = (slot) => SLOTS_AUTO.includes(slot);
export const ehManual = (slot) => SLOTS_MANUAIS.includes(slot);
export const ehSlot = (slot) => ehAuto(slot) || ehManual(slot);

// ------------------------------------------------------------------------------------------------ bancos

/** Banco na memória com a mesma interface do IndexedDB (testes; navegador sem IndexedDB). */
export function bancoNaMemoria() {
  const lojas = { saves: new Map(), meta: new Map() };
  return {
    tipo: 'memoria',
    lojas,
    async ler(loja, chave) {
      return lojas[loja].get(chave) ?? null;
    },
    async listar(loja) {
      return [...lojas[loja].entries()].map(([chave, valor]) => ({ chave, valor }));
    },
    /** Grava ou apaga ([{ loja, chave, valor }], valor null apaga) de uma vez só. */
    async gravar(pares) {
      for (const p of pares) {
        if (p.valor === null || p.valor === undefined) lojas[p.loja].delete(p.chave);
        else lojas[p.loja].set(p.chave, p.valor);
      }
    },
  };
}

const pedido = (r) =>
  new Promise((ok, erro) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });

/** IndexedDB 'heldopolis' (uma conexão só, refeita se o navegador fechar). */
export function bancoIndexedDB(nome = SAVE.banco) {
  let conexao = null;
  const abrir = () => {
    if (conexao) return conexao;
    conexao = new Promise((ok, erro) => {
      if (typeof indexedDB === 'undefined') return erro(new Error('sem IndexedDB'));
      const r = indexedDB.open(nome, 1);
      r.onupgradeneeded = () => {
        for (const loja of SAVE.lojas) if (!r.result.objectStoreNames.contains(loja)) r.result.createObjectStore(loja);
      };
      r.onsuccess = () => {
        const db = r.result;
        db.onversionchange = () => {
          db.close();
          conexao = null;
        };
        db.onclose = () => {
          conexao = null;
        };
        ok(db);
      };
      r.onerror = () => erro(r.error);
      r.onblocked = () => erro(new Error('IndexedDB bloqueado'));
    });
    conexao.catch(() => {
      conexao = null;
    });
    return conexao;
  };
  return {
    tipo: 'indexeddb',
    async ler(loja, chave) {
      const db = await abrir();
      return (await pedido(db.transaction(loja, 'readonly').objectStore(loja).get(chave))) ?? null;
    },
    async listar(loja) {
      const db = await abrir();
      const st = db.transaction(loja, 'readonly').objectStore(loja);
      const [chaves, valores] = await Promise.all([pedido(st.getAllKeys()), pedido(st.getAll())]);
      return chaves.map((chave, i) => ({ chave, valor: valores[i] }));
    },
    async gravar(pares, { duravel = true } = {}) {
      const db = await abrir();
      const lojas = [...new Set(pares.map((p) => p.loja))];
      await new Promise((ok, erro) => {
        const tx = db.transaction(lojas, 'readwrite', { durability: duravel ? 'strict' : 'relaxed' });
        for (const p of pares) {
          const st = tx.objectStore(p.loja);
          if (p.valor === null || p.valor === undefined) st.delete(p.chave);
          else st.put(p.valor, p.chave);
        }
        tx.oncomplete = () => ok();
        tx.onerror = () => erro(tx.error);
        tx.onabort = () => erro(tx.error ?? new Error('gravação abortada'));
      });
    },
  };
}

/** localStorage que não quebra (janela privada, página de teste): get, set e remove. */
export function localSeguro(armazenamento = typeof localStorage !== 'undefined' ? localStorage : null) {
  const m = new Map();
  return {
    get(k) {
      try {
        return armazenamento ? armazenamento.getItem(k) : m.get(k) ?? null;
      } catch (e) {
        return m.get(k) ?? null;
      }
    },
    set(k, v) {
      try {
        if (armazenamento) armazenamento.setItem(k, v);
        else m.set(k, v);
        return true;
      } catch (e) {
        m.set(k, v);
        return false;
      }
    },
    remove(k) {
      try {
        armazenamento?.removeItem(k);
      } catch (e) {
        // nada a fazer
      }
      m.delete(k);
    },
  };
}

// ------------------------------------------------------------------------------------------------ espaços

/** Espaço automático da vez: um vazio, senão o mais velho (fora os que estão sendo gravados). */
export function proximoAuto(metas, ocupados = []) {
  const livres = SLOTS_AUTO.filter((s) => !ocupados.includes(s));
  const lista = livres.length ? livres : SLOTS_AUTO;
  const vazio = lista.find((s) => !metas.some((m) => m.slot === s));
  if (vazio) return vazio;
  return [...lista].sort((a, b) => dataDe(metas, a) - dataDe(metas, b))[0];
}

/**
 * Espaço manual para "Salvar agora": o desta partida (o mais novo dela), senão um vazio, senão null (o jogador escolhe
 * qual substituir na tela Carregar).
 */
export function proximoManual(metas, partida = null) {
  const daPartida = metas.filter((m) => ehManual(m.slot) && partida && m.partida === partida).sort((a, b) => b.data - a.data)[0];
  if (daPartida) return daPartida.slot;
  return SLOTS_MANUAIS.find((s) => !metas.some((m) => m.slot === s)) ?? null;
}

const dataDe = (metas, slot) => metas.find((m) => m.slot === slot)?.data ?? 0;

/** Ordena os saves do mais novo para o mais velho (o menu mostra assim). */
export const ordenarSaves = (metas) => [...metas].sort((a, b) => (b.data ?? 0) - (a.data ?? 0));

// ------------------------------------------------------------------------------------------------ armazém

/**
 * @param {{ banco?: object, local?: object, agora?: () => number, sessao?: object }} op
 *   local: localStorage seguro (heldopolis.ultimo); sessao: sessionStorage seguro (a marca da importação)
 */
export function criarArmazem({ banco = bancoIndexedDB(), local = localSeguro(), agora = () => Date.now(), sessao = null } = {}) {
  let trava = null; // motivo ('importacao') enquanto nada além do arquivo importado pode gravar
  const marcaSessao = sessao ?? localSeguro(typeof sessionStorage !== 'undefined' ? sessionStorage : null);

  const arm = {
    banco,
    /** Grava os bytes e o resumo do espaço numa transação só; marca o último. */
    async gravar(slot, bytes, meta, { duravel = true, ignorarTrava = false } = {}) {
      if (!ehSlot(slot)) throw new Error(`espaço desconhecido: ${slot}`);
      if (trava && !ignorarTrava) return { ok: false, codigo: 'ocupado', motivo: trava };
      const m = { ...meta, slot, bytes: bytes.length };
      await banco.gravar([{ loja: 'saves', chave: slot, valor: bytes }, { loja: 'meta', chave: slot, valor: m }], { duravel });
      local.set(SAVE.chaves.ultimo, slot);
      return { ok: true, meta: m };
    },
    async ler(slot) {
      const [bytes, meta] = await Promise.all([banco.ler('saves', slot), banco.ler('meta', slot)]);
      if (!bytes) return null;
      return { bytes: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), meta: meta ?? { slot } };
    },
    /** Resumos dos espaços com save (sem a quarentena), do mais novo ao mais velho. */
    async listar() {
      const l = await banco.listar('meta');
      return ordenarSaves(l.filter((x) => ehSlot(x.chave)).map((x) => ({ ...x.valor, slot: x.chave })));
    },
    async apagar(slot) {
      if (!ehSlot(slot)) return { ok: false, codigo: 'valor' };
      await banco.gravar([{ loja: 'saves', chave: slot, valor: null }, { loja: 'meta', chave: slot, valor: null }]);
      if (local.get(SAVE.chaves.ultimo) === slot) local.remove(SAVE.chaves.ultimo);
      return { ok: true };
    },
    /** Último espaço gravado ou carregado (localStorage), se ainda tiver save. */
    ultimo: () => local.get(SAVE.chaves.ultimo),
    definirUltimo: (slot) => local.set(SAVE.chaves.ultimo, slot),
    /**
     * Quarentena (trava herdada): o save que não abriu sai do espaço e fica guardado com o motivo; as 3 cópias mais
     * novas ficam, as outras saem. Nunca apaga o único que existe sem guardar antes.
     */
    async quarentena(slot, motivo = '') {
      const lido = await arm.ler(slot);
      if (!lido) return { ok: false, codigo: 'nada' };
      const chave = `${PREFIXO_QUARENTENA}${agora()}`;
      const meta = { ...lido.meta, slot: chave, origem: slot, motivo: String(motivo).slice(0, 200), quando: agora(), capa: null };
      const velhas = (await arm.listarQuarentena()).slice(MAX_QUARENTENA - 1);
      await banco.gravar([
        { loja: 'saves', chave, valor: lido.bytes },
        { loja: 'meta', chave, valor: meta },
        { loja: 'saves', chave: slot, valor: null },
        { loja: 'meta', chave: slot, valor: null },
        ...velhas.flatMap((v) => [{ loja: 'saves', chave: v.slot, valor: null }, { loja: 'meta', chave: v.slot, valor: null }]),
      ]);
      if (local.get(SAVE.chaves.ultimo) === slot) local.remove(SAVE.chaves.ultimo);
      return { ok: true, chave };
    },
    /** Cópias em quarentena, da mais nova à mais velha. */
    async listarQuarentena() {
      const l = await banco.listar('meta');
      return l
        .filter((x) => String(x.chave).startsWith(PREFIXO_QUARENTENA))
        .map((x) => ({ ...x.valor, slot: x.chave }))
        .sort((a, b) => (b.quando ?? 0) - (a.quando ?? 0));
    },
    /** Lê bytes de qualquer chave (a quarentena inclusive), para exportar. */
    async bytes(chave) {
      const b = await banco.ler('saves', chave);
      return b ? (b instanceof Uint8Array ? b : new Uint8Array(b)) : null;
    },
    /** Trava da importação: até destravar, só a gravação do arquivo importado passa (e a página sabe pela sessão). */
    travar(motivo = 'importacao') {
      trava = motivo;
      marcaSessao.set(CHAVE_IMPORTANDO, motivo);
    },
    destravar() {
      trava = null;
      marcaSessao.remove(CHAVE_IMPORTANDO);
    },
    travado: () => trava,
    /** A página anterior caiu no meio de uma importação (a marca ficou na sessão). */
    importacaoInterrompida: () => !!marcaSessao.get(CHAVE_IMPORTANDO),
  };
  return arm;
}

/** Pede o armazenamento persistente (o Chrome não apaga o jogo quando o aparelho enche). true se já é ou ficou. */
export async function pedirPersistencia() {
  try {
    const st = typeof navigator !== 'undefined' ? navigator.storage : null;
    if (!st) return false;
    if (st.persisted && (await st.persisted())) return true;
    return st.persist ? await st.persist() : false;
  } catch (e) {
    return false;
  }
}

/** Situação do armazenamento: persistente, usado e cota (MB), quando o navegador diz. */
export async function situacaoArmazenamento() {
  const st = typeof navigator !== 'undefined' ? navigator.storage : null;
  const out = { persistente: null, usadoMB: null, cotaMB: null };
  try {
    if (st?.persisted) out.persistente = await st.persisted();
    if (st?.estimate) {
      const e = await st.estimate();
      out.usadoMB = e.usage / 1048576;
      out.cotaMB = e.quota / 1048576;
    }
  } catch (e) {
    // o navegador não informa
  }
  return out;
}

/** Nome do arquivo exportado: 'heldopolis-holding-held-2026-10-03.held'. */
export function nomeArquivo(nome = 'partida', quando = Date.now()) {
  const d = new Date(quando);
  const dd = (x) => String(x).padStart(2, '0');
  const limpo = String(nome || 'partida')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'partida';
  return `heldopolis-${limpo}-${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}${SAVE.extensao}`;
}

/** registrar(app) vem de app/controle.js; quem liga o armazém ao app é o salvamento.js. */
export function registrar() {}
