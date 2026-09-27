// Preferências locais do jogador (D31: 'heldopolis.prefs' no localStorage, separado do save): qualidade, som,
// vibração, dicas, tamanho da interface, "Sempre dia", alto contraste e reduzir movimento. Leitura e escrita toleram
// localStorage bloqueado (janela privada, página de teste). F0 cria; U2a (Configurações) usa e acrescenta campos.

export const CHAVE_PREFS = 'heldopolis.prefs';

export const PREFS_PADRAO = Object.freeze({
  qualidade: 'auto', // 'auto' | 'ultra' | 'alta' | 'media' | 'leve'
  som: 0.8,
  musica: 0.5,
  vibrar: true,
  dicas: true,
  tamanho: 1, // escala da interface: 0,9 (só PC), 1, 1,12 ou 1,25
  sempreDia: false,
  contraste: false,
  reduzirMovimento: null, // null segue o sistema
});

/** Lê as preferências (com os padrões para o que faltar). */
export function lerPrefs() {
  try {
    const bruto = typeof localStorage !== 'undefined' ? localStorage.getItem(CHAVE_PREFS) : null;
    const lido = bruto ? JSON.parse(bruto) : {};
    return { ...PREFS_PADRAO, ...(lido && typeof lido === 'object' ? lido : {}) };
  } catch (e) {
    return { ...PREFS_PADRAO };
  }
}

/** Grava as preferências; devolve false se o armazenamento recusou. */
export function gravarPrefs(p) {
  try {
    localStorage.setItem(CHAVE_PREFS, JSON.stringify({ ...PREFS_PADRAO, ...p }));
    return true;
  } catch (e) {
    return false;
  }
}

/** Aplica o que é da página: tamanho da interface, alto contraste e reduzir movimento. */
export function aplicarPrefs(p, raiz = typeof document !== 'undefined' ? document.documentElement : null) {
  if (!raiz) return;
  raiz.style.setProperty('--ajuste', String(p.tamanho || 1));
  if (p.contraste) raiz.dataset.contraste = '1';
  else delete raiz.dataset.contraste;
  if (p.reduzirMovimento === true) raiz.dataset.movimento = 'reduzido';
  else delete raiz.dataset.movimento;
}
