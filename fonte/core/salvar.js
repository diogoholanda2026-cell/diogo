// Salvamento: localStorage primeiro (síncrono, sobrevive a um fechamento brusco) e IndexedDB depois,
// numa conexão só; ao carregar, lê os dois e fica com o mais novo (maior S.t). Save danificado nunca é
// descartado: vai para uma chave própria e o jogo avisa. Também exporta/importa arquivo e pede
// armazenamento persistente (o Chrome não apaga os dados do jogo quando o celular enche).
const DB = 'arcologia-de-held', LOJA = 'saves', CHAVE = 'jogo', LS = 'held-save-v2', CORROMPIDO = 'held-save-corrompido-';
let dbP = null; // conexão única com o IndexedDB
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
function guardarCorrompido(txt) { // guarda a cópia danificada (as três mais recentes) em vez de apagar
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
  if (a && b) return (+b.t || 0) > (+a.t || 0) ? b : a;
  return a || b;
}
// grava no localStorage na hora (síncrono) e depois no IndexedDB
export function gravarLocal(S, txt = JSON.stringify(S)) { try { localStorage.setItem(LS, txt); return true; } catch (_) { return false; } }
export function gravar(S) {
  const txt = JSON.stringify(S); gravarLocal(S, txt);
  return abrir().then((db) => new Promise((ok, erro) => { const t = db.transaction(LOJA, 'readwrite', { durability: 'relaxed' }); t.objectStore(LOJA).put(txt, CHAVE); t.oncomplete = ok; t.onerror = () => erro(t.error); t.onabort = () => erro(t.error); })).catch(() => {});
}
export async function apagar() { try { const db = await abrir(); await new Promise((ok) => { const t = db.transaction(LOJA, 'readwrite'); t.objectStore(LOJA).delete(CHAVE); t.oncomplete = ok; t.onerror = ok; }); } catch (_) {} try { localStorage.removeItem(LS); } catch (_) {} }
export function exportar(S) {
  const b = new Blob([JSON.stringify(S)], { type: 'application/json' }); const a = document.createElement('a'); const d = new Date();
  a.href = URL.createObjectURL(b); a.download = `arcologia-de-held-${d.toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
export function importar() {
  return new Promise((ok, erro) => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/json,.json'; i.onchange = () => { const f = i.files[0]; if (!f) return erro(new Error('nenhum arquivo')); f.text().then((t) => { try { const S = JSON.parse(t); if (!S || !S.itens || !S.modulos) throw new Error('arquivo inválido'); ok(S); } catch (e) { erro(e); } }); }; i.click(); });
}
export async function persistir() { try { if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true; if (navigator.storage?.persist) return await navigator.storage.persist(); } catch (_) {} return false; }
// configurações do aparelho (separadas do save)
const LC = 'held-config';
export function lerConfig() { try { return JSON.parse(localStorage.getItem(LC)) || {}; } catch (_) { return {}; } }
export function gravarConfig(c) { try { localStorage.setItem(LC, JSON.stringify(c)); } catch (_) {} }
