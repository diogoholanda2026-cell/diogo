// Salvamento: IndexedDB (com cópia no localStorage), exportar/importar arquivo e pedido de
// armazenamento persistente (o Chrome não apaga os dados do jogo quando o celular enche).
const DB = 'arcologia-de-held', LOJA = 'saves', CHAVE = 'jogo', LS = 'held-save-v2';
function abrir() { return new Promise((ok, erro) => { if (!window.indexedDB) return erro(new Error('sem IndexedDB')); const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(LOJA); r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error); }); }
export async function carregar() {
  let txt = null;
  try { const db = await abrir(); txt = await new Promise((ok, erro) => { const t = db.transaction(LOJA, 'readonly').objectStore(LOJA).get(CHAVE); t.onsuccess = () => ok(t.result || null); t.onerror = () => erro(t.error); }); } catch (_) {}
  if (!txt) try { txt = localStorage.getItem(LS); } catch (_) {}
  if (!txt) return null; try { return JSON.parse(txt); } catch (_) { return null; }
}
export async function gravar(S) {
  const txt = JSON.stringify(S);
  try { const db = await abrir(); await new Promise((ok, erro) => { const t = db.transaction(LOJA, 'readwrite'); t.objectStore(LOJA).put(txt, CHAVE); t.oncomplete = ok; t.onerror = () => erro(t.error); }); } catch (_) {}
  try { localStorage.setItem(LS, txt); } catch (_) {}
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
