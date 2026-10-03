// Estilo da primeira hora (dona: U2a): cartão da dica, mão fantasma, anel de guia e o traçado sugerido. Vai num
// <style> (a parcela não tem CSS em tema/); só transform e opacity animam, e com "reduzir movimento" nada pulsa.
import { usarEstilo } from '../inicio/estilo.js';

const CSS_GUIA = `
.dica-cartao{position:absolute;max-width:min(360px,calc(100vw - 32px));padding:var(--e3) var(--e3) var(--e2);border-radius:var(--r2);
  background:var(--s1);box-shadow:var(--luz),var(--sombra2);pointer-events:auto;animation:dicaEntra var(--d3) var(--curva)}
.dica-quem{display:flex;align-items:center;gap:6px;font-size:var(--t12);font-weight:650;color:var(--ch);text-transform:uppercase;letter-spacing:.05em}
.dica-texto{margin:6px 0 var(--e2);font-size:var(--t15);font-weight:600;line-height:1.35}
.dica-acoes{display:flex;flex-wrap:wrap;gap:var(--e1)}
.dica-acoes .bt{min-height:var(--alvo);padding:0 var(--e3)}
.mao{position:absolute;width:36px;height:36px;margin:-6px 0 0 -10px;color:#fff;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.55))}
.mao-toque{animation:maoToque 1.2s var(--curva) 3}
.mao-via{animation:maoVia 2.4s var(--curva) 3}
.mao-arrasto{animation:maoArrasto 1.6s var(--curva) 3}
@keyframes maoToque{0%,100%{transform:none;opacity:.9}40%{transform:scale(.82);opacity:1}60%{transform:scale(.82)}}
@keyframes maoVia{0%{transform:translate(-70px,20px);opacity:0}10%{opacity:1}22%{transform:translate(-70px,20px) scale(.82)}30%{transform:translate(-70px,20px)}
  55%{transform:translate(70px,-10px)}62%{transform:translate(70px,-10px) scale(.82)}70%{transform:translate(70px,-10px)}85%{transform:translate(0,-34px) scale(.82)}100%{transform:translate(0,-34px);opacity:0}}
@keyframes maoArrasto{0%{transform:translate(-40px,0) scale(.82);opacity:0}15%{opacity:1}85%{transform:translate(40px,0) scale(.82);opacity:1}100%{opacity:0}}
@keyframes dicaEntra{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.guia-anel{position:absolute;border-radius:var(--r2);box-shadow:0 0 0 2px var(--ch);pointer-events:none;animation:guiaPulso 1.6s ease-out infinite}
@keyframes guiaPulso{0%{transform:scale(1);opacity:1}70%{transform:scale(1.18);opacity:0}100%{transform:scale(1.18);opacity:0}}
.sug-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.sug-svg polyline,.sug-svg polygon,.sug-svg circle{fill:none;stroke:#d9bd84;stroke-width:3;stroke-dasharray:10 8;stroke-linecap:round;stroke-linejoin:round}
.sug-svg polygon{fill:rgba(217,189,132,.10)}
.sug-chip{position:absolute;transform:translate(-50%,-100%);display:inline-flex;align-items:center;gap:6px;min-height:var(--alvo);padding:0 var(--e3);
  border-radius:var(--rp);background:var(--s1);box-shadow:var(--luz),var(--sombra2),inset 0 0 0 1px var(--ch);color:var(--ch);font-size:var(--t13);
  font-weight:650;pointer-events:auto;white-space:nowrap}
:root[data-movimento=reduzido] .mao,:root[data-movimento=reduzido] .guia-anel,:root[data-movimento=reduzido] .dica-cartao{animation:none}
@media (prefers-reduced-motion:reduce){.mao,.guia-anel,.dica-cartao{animation:none}}
`;

export const usarEstiloGuia = () => usarEstilo('guia', CSS_GUIA);

/** A mão fantasma (glifo de dedo, desenhado aqui: o conjunto de glifos não tem mão). */
export const DEDO = [
  'M9.5 12.5V5a1.5 1.5 0 0 1 3 0v6',
  'M12.5 10.5a1.5 1.5 0 0 1 3 0V12',
  'M15.5 11.5a1.5 1.5 0 0 1 3 0v3a6.5 6.5 0 0 1-6.5 6.5h-.8a5 5 0 0 1-4-2l-2.6-3.5a1.5 1.5 0 0 1 2.3-1.9l2.1 2.4',
];
