// Salvamento: localStorage primeiro (síncrono, sobrevive a um fechamento brusco) e IndexedDB depois,
// numa conexão só; ao carregar, lê os dois e fica com o gravado por último (S.gravado, carimbado a cada gravação;
// saves antigos usam S.t). Save danificado nunca é descartado: vai para uma chave própria e o jogo avisa.
// Importar e apagar travam a gravação até a página recarregar: o pagehide do reload não pode gravar o jogo
// da memória por cima do arquivo importado. Também exporta/importa arquivo e pede armazenamento persistente
// (o Chrome não apaga os dados do jogo quando o celular enche).
// Contrato da importação (para a interface): `const S = await importar(); await gravarImportado(S); location.reload()`
// (ou só gravar(S): importar() já trava). Até o reload, gravar/gravarLocal de qualquer outro objeto não fazem nada e
// sessionStorage['held-importando'] fica marcado; main.js não salva no pagehide/visibilitychange/freeze com a marca
// e a apaga (fimImportacao) depois de carregar o save importado.
const DB = 'arcologia-de-held', LOJA = 'saves', CHAVE = 'jogo', LS = 'held-save-v2', CORROMPIDO = 'held-save-corrompido-';
export const IMPORTANDO = 'held-importando';
let dbP = null; // conexão única com o IndexedDB
let trava = null; // depois de importar (o save importado) ou apagar ({}), só esse objeto pode ser gravado
const bloqueado = (S) => trava !== null && S !== trava;
const travar = (S) => { trava = S; try { sessionStorage.setItem(IMPORTANDO, '1'); } catch (_) {} };
export function importando() { if (trava !== null) return true; try { return !!sessionStorage.getItem(IMPORTANDO); } catch (_) { return false; } }
export function fimImportacao() { try { sessionStorage.removeItem(IMPORTANDO); } catch (_) {} }
const quando = (S) => Math.max(+S.gravado || 0, +S.t || 0);
// duas páginas do mesmo jogo (o app instalado congelado em segundo plano e uma aba do Chrome): cada página lembra o
// carimbo do último save que leu ou gravou; se o localStorage tiver o mesmo jogo (criado igual) gravado depois disso,
// outra página jogou por cima e esta está desatualizada: não grava (o main.js recarrega a página ao voltar)
let ultimo = 0;
export function outraPaginaGravou(S) {
  try { const L = JSON.parse(localStorage.getItem(LS) || 'null'); return !!(L && S && L.criado === S.criado && quando(L) > ultimo); } catch (_) { return false; }
}
function abrir() {
  if (dbP) return dbP;
  dbP = new Promise((ok, erro) => {
    if (!globalThis.indexedDB) return erro(new Error('sem IndexedDB'));
    const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(LOJA);
    r.onsuccess = () => { const db = r.result; db.onversionchange = () => { db.close(); dbP = null; }; db.onclose = () => { dbP = null; }; ok(db); };
    r.onerror = () => erro(r.error); r.onblocked = () => erro(new Error('IndexedDB bloqueado'));
  });
  dbP.catch(() => { dbP = null; });
  return dbP;
}
const avisos = []; // mensagens para a interface mostrar depois de carregar
export function avisosSave() { return avisos.splice(0); }
export function guardarCorrompido(txt) { // guarda a cópia danificada (as três mais recentes) em vez de apagar
  try {
    const velhos = Object.keys(localStorage).filter((k) => k.startsWith(CORROMPIDO)).sort(); while (velhos.length >= 3) localStorage.removeItem(velhos.shift());
    localStorage.setItem(CORROMPIDO + Date.now(), txt);
  } catch (_) {}
  if (!avisos.includes('Save danificado: uma cópia foi guardada')) avisos.push('Save danificado: uma cópia foi guardada');
}
function ler(txt) { if (!txt) return null; try { const S = JSON.parse(txt); if (S && typeof S === 'object' && S.itens && S.modulos) return S; } catch (_) {} guardarCorrompido(txt); return null; }
function lerIDB() {
  return abrir().then((db) => new Promise((ok, erro) => { const t = db.transaction(LOJA, 'readonly').objectStore(LOJA).get(CHAVE); t.onsuccess = () => ok(t.result || null); t.onerror = () => erro(t.error); })).catch(() => null);
}
export async function carregar() {
  let ls = null; try { ls = localStorage.getItem(LS); } catch (_) {}
  const idb = await lerIDB();
  const a = ler(ls), b = idb && idb !== ls ? ler(idb) : null;
  const S = a && b ? (quando(b) > quando(a) ? b : a) : a || b; if (S) ultimo = quando(S);
  return S;
}
// grava no localStorage na hora (síncrono) e depois no IndexedDB
export function gravarLocal(S, txt) {
  if (bloqueado(S) || (txt == null && outraPaginaGravou(S))) return false; if (txt == null) { S.gravado = Date.now(); txt = JSON.stringify(S); }
  ultimo = quando(S); try { localStorage.setItem(LS, txt); return true; } catch (_) { return false; }
}
export function gravar(S) {
  if (bloqueado(S) || outraPaginaGravou(S)) return Promise.resolve(); S.gravado = Date.now(); const txt = JSON.stringify(S); gravarLocal(S, txt);
  return abrir().then((db) => new Promise((ok, erro) => { const t = db.transaction(LOJA, 'readwrite', { durability: 'relaxed' }); t.objectStore(LOJA).put(txt, CHAVE); t.oncomplete = ok; t.onerror = () => erro(t.error); t.onabort = () => erro(t.error); })).catch(() => {});
}
export function gravarImportado(S) { S.gravado = Date.now(); travar(S); return gravar(S); } // grava o save importado e trava o resto
export async function apagar() { travar({}); try { const db = await abrir(); await new Promise((ok) => { const t = db.transaction(LOJA, 'readwrite'); t.objectStore(LOJA).delete(CHAVE); t.oncomplete = ok; t.onerror = ok; }); } catch (_) {} try { localStorage.removeItem(LS); } catch (_) {} }
export function exportar(S) {
  const b = new Blob([JSON.stringify(S)], { type: 'application/json' }); const a = document.createElement('a'); const d = new Date();
  a.href = URL.createObjectURL(b); a.download = `arcologia-de-held-${d.toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
export function importar() {
  return new Promise((ok, erro) => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/json,.json'; i.onchange = () => { const f = i.files[0]; if (!f) return erro(new Error('nenhum arquivo')); f.text().then((t) => { try { const S = JSON.parse(t); if (!S || !S.itens || !S.modulos) throw new Error('arquivo inválido'); S.gravado = Date.now(); travar(S); ok(S); } catch (e) { erro(e); } }); }; i.click(); });
}
export async function persistir() { try { if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true; if (navigator.storage?.persist) return await navigator.storage.persist(); } catch (_) {} return false; }
// configurações do aparelho (separadas do save)
const LC = 'held-config';
export function lerConfig() { try { return JSON.parse(localStorage.getItem(LC)) || {}; } catch (_) { return {}; } }
export function gravarConfig(c) { try { localStorage.setItem(LC, JSON.stringify(c)); } catch (_) {} }
