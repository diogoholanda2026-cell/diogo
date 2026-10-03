// Estilo do início (dona: U2a): a parcela não tem CSS próprio em tema/ (seção 3.1), então cada parte põe o seu num
// <style> uma vez, com os tokens de tema/tokens.css. O da entrada e do fundo vem no pacote principal (é o que aparece
// primeiro); o das telas sob demanda vem com elas (corpo/estilo.js).

const postos = new Set();

/** Põe um bloco de CSS na página (uma vez por id). */
export function usarEstilo(id, css) {
  if (postos.has(id) || typeof document === 'undefined') return;
  postos.add(id);
  const el = document.createElement('style');
  el.dataset.estilo = id;
  el.textContent = css;
  document.head.appendChild(el);
}

/** Entrada, fundo do menu, girar o celular e a moldura de quem está carregando. */
export const CSS_INICIO = `
html[data-inicio] #ui .ui-raiz>*:not(.lugar-sobre),html[data-inicio] #ui .lugar-sobre>*:not(.inicio):not(.girar):not(.toasts){visibility:hidden}
html[data-inicio] #ui .lugar-sobre>.toasts{z-index:4;top:calc(var(--mC) + 8px)}
.inicio{position:fixed;inset:0;z-index:2;pointer-events:auto;display:flex;color:var(--t1);
  background:linear-gradient(180deg,#171d26 0%,#0f141b 55%,#0b0f14 100%);font-family:var(--fonte)}
.inicio-capa{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.55;pointer-events:none}
.inicio-veu{position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(11,15,20,.92) 0%,rgba(11,15,20,.72) 42%,rgba(11,15,20,.25) 100%)}
.inicio-entrada{flex-direction:column;align-items:center;justify-content:center;cursor:pointer;text-align:center}
.inicio-marca{width:56px;height:56px;margin-bottom:20px;color:var(--ch)}
.inicio-titulo{margin:0;font-size:var(--t28);font-weight:650;letter-spacing:.2em;padding-left:.2em;line-height:1.2}
.inicio-cidade{margin:8px 0 0;font-size:var(--t15);font-weight:500;color:var(--ch);letter-spacing:.04em}
.inicio-entrar{margin-top:30px;min-height:var(--alvo);padding:0 var(--e5);border-radius:var(--rp);font-size:var(--t13);
  font-weight:650;letter-spacing:.12em;text-transform:uppercase;color:var(--t1);background:var(--s3);box-shadow:inset 0 0 0 1px var(--fio2)}
.inicio-entrar:hover{background:var(--acF)}
.inicio-aviso{margin-top:14px;font-size:var(--t12);font-weight:600;color:var(--t2)}
.inicio-espera{margin:auto;font-size:var(--t13);font-weight:600;color:var(--t2);letter-spacing:.08em;text-transform:uppercase}
@media (max-height:420px){.inicio-marca{width:44px;height:44px;margin-bottom:14px}.inicio-entrar{margin-top:20px}}
@media (prefers-reduced-motion:no-preference){:root:not([data-movimento=reduzido]) .inicio-entrar{animation:inicioPulso 2.4s ease-in-out infinite}}
@keyframes inicioPulso{0%,100%{opacity:1}50%{opacity:.72}}
.girar{display:none}
@media (orientation:portrait) and (pointer:coarse){.girar{position:fixed;inset:0;z-index:3;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;pointer-events:auto;background:#0b0f14;color:var(--t1);
  font-size:var(--t17);font-weight:600}.girar .glifo{color:var(--ch)}}
`;
