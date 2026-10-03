// Estilo das telas do sistema (dona: U2a), sob demanda junto com elas: menu inicial, nova partida, saves, créditos,
// configurações e teste de desempenho. Tokens de tema/tokens.css; só transform e opacity animam.

export const CSS_CORPO = `
.inicio .tela{top:var(--mC);z-index:3}
.ini-menu{position:relative;z-index:1;display:flex;flex-direction:column;justify-content:center;gap:var(--e4);
  width:min(400px,calc(100% - 2*var(--e4)));margin:auto auto auto max(var(--mE),5vw);padding:var(--e4) 0;max-height:100%;overflow-y:auto}
.ini-cab{display:flex;align-items:center;gap:var(--e3)}
.ini-cab .inicio-marca{width:44px;height:44px;margin:0;color:var(--ch);flex:none}
.ini-cab h1{margin:0;font-size:var(--t20);font-weight:650;letter-spacing:.16em;line-height:1.2}
.ini-cab p{margin:2px 0 0;font-size:var(--t13);font-weight:600;color:var(--ch);letter-spacing:.04em}
.ini-botoes{display:flex;flex-direction:column;gap:var(--e2);padding:var(--e3);border-radius:var(--r3);background:var(--s1);box-shadow:var(--luz),var(--sombra2)}
.ini-bt{justify-content:space-between!important;width:100%;height:auto!important;min-height:var(--alvo);padding:0 var(--e3)!important;text-align:left;white-space:normal!important}
.ini-bt-textos{display:flex;flex-direction:column;min-width:0;gap:2px;padding:var(--e2) 0}
.ini-bt-titulo{font-size:var(--t15);font-weight:650}
.ini-bt-sub{font-size:var(--t12);font-weight:600;opacity:.86;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ini-tecla{flex:none;min-width:22px;padding:2px 6px;border-radius:var(--r1);font:600 var(--t12) var(--fonte);text-align:center;
  background:rgba(255,255,255,.1);box-shadow:inset 0 0 0 1px var(--fio2)}
.bt-pri .ini-tecla{background:rgba(11,15,20,.14);box-shadow:inset 0 0 0 1px rgba(11,15,20,.3)}
.ini-erro{margin:0;padding:var(--e2) var(--e3);border-radius:var(--r2);font-size:var(--t13);font-weight:600;color:var(--er);background:var(--s1)}
.ini-rodape{font-size:var(--t12);font-weight:600;color:var(--t2);padding-left:var(--e1)}
.ini-form{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--e3) var(--e4);max-width:760px}
.ini-campo{display:flex;flex-direction:column;gap:6px;min-width:0}
.ini-campo>span{font-size:var(--t12);font-weight:650;color:var(--t2);text-transform:uppercase;letter-spacing:.06em}
.ini-campo input{height:var(--alvo);padding:0 var(--e3);border-radius:var(--r2);border:0;background:var(--s3);color:var(--t1);
  font:600 var(--t15) var(--fonte);box-shadow:inset 0 0 0 1px var(--fio2);user-select:text;-webkit-user-select:text;pointer-events:auto}
.ini-campo input:focus{outline:2px solid var(--ac);outline-offset:1px}
.ini-campo input[aria-invalid=true]{box-shadow:inset 0 0 0 1px var(--er)}
.ini-cores{display:flex;flex-wrap:wrap;gap:var(--e2)}
.ini-cor{width:var(--alvo);height:var(--alvo);border-radius:var(--rp)!important;box-shadow:inset 0 0 0 2px rgba(255,255,255,.18)}
.ini-cor[aria-checked=true]{box-shadow:0 0 0 2px var(--s1),0 0 0 4px var(--t1)}
.ini-largo{grid-column:1/-1}
.ini-nota{margin:0;font-size:var(--t13);font-weight:500;color:var(--t2)}
.ini-acoes{display:flex;flex-wrap:wrap;gap:var(--e2);margin-top:var(--e2)}
.ini-acoes .bt-pri,.ini-acoes .bt-sec{min-height:var(--alvo);padding:0 var(--e4)}
.sv-grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:var(--e3)}
.sv-cartao{display:flex;flex-direction:column;border-radius:var(--r2);background:var(--s2);box-shadow:inset 0 0 0 1px var(--fio);overflow:hidden;min-width:0}
.sv-capa{display:block;width:100%;aspect-ratio:20/9;object-fit:cover;background:linear-gradient(135deg,#1c2430,#0f141b)}
.sv-corpo{display:flex;flex-direction:column;gap:2px;padding:var(--e2) var(--e3)}
.sv-titulo{display:flex;justify-content:space-between;gap:var(--e2);font-size:var(--t13);font-weight:650;color:var(--t2);text-transform:uppercase;letter-spacing:.05em}
.sv-nome{font-size:var(--t15);font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sv-sub{font-size:var(--t12);font-weight:600;color:var(--t2)}
.sv-acoes{display:flex;flex-wrap:wrap;gap:var(--e1);padding:0 var(--e2) var(--e2)}
.sv-acoes .bt{min-height:var(--alvo);padding:0 var(--e3)}
.dois-toques{height:auto;min-height:var(--alvo)}
.sv-vazio .sv-corpo{padding:var(--e3)}
.sv-topo{display:flex;flex-wrap:wrap;gap:var(--e2);align-items:center;margin-bottom:var(--e3)}
.sv-topo .bt{min-height:var(--alvo);padding:0 var(--e3)}
.cfg-layout{display:flex;gap:var(--e4);align-items:flex-start}
.cfg-abas{flex:none;flex-direction:column;width:168px;position:sticky;top:0;overflow:visible}
.cfg-abas .aba{justify-content:flex-start;width:100%;border-radius:var(--r1)}
.cfg-abas .aba.ativa{background:var(--s3);box-shadow:inset 2px 0 0 var(--ac)}
.cfg-painel{flex:1;min-width:0}
.cfg-corpo{display:flex;flex-direction:column;max-width:880px}
.cfg-linha{display:flex;align-items:center;justify-content:space-between;gap:var(--e4);min-height:52px;padding:var(--e2) 0;border-bottom:1px solid var(--fio)}
.cfg-textos{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.cfg-rot{font-size:var(--t15);font-weight:600}
.cfg-exp{font-size:var(--t12);font-weight:500;color:var(--t2)}
.cfg-ctl{flex:none;display:flex;align-items:center;gap:var(--e2);max-width:62%}
.cfg-ctl .segmentado{flex-wrap:wrap}
.cfg-ctl .deslizante{min-width:220px}
.cfg-manter{display:flex;align-items:center;gap:var(--e3);flex-wrap:wrap;margin:var(--e2) 0;padding:var(--e2) var(--e3);border-radius:var(--r2);
  background:var(--chF);box-shadow:inset 0 0 0 1px var(--ch)}
.cfg-manter b{font-size:var(--t15)}
.cfg-dica{margin:var(--e3) 0 0;font-size:var(--t12);font-weight:600;color:var(--t2)}
.cfg-teclas{display:grid;grid-template-columns:auto 1fr;gap:6px var(--e4);font-size:var(--t13);align-items:baseline}
.cfg-teclas b{font-weight:650;white-space:nowrap}
.cfg-teclas span{color:var(--t2);font-weight:500}
.td-cartao{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:var(--e4);margin-top:var(--e4);align-items:start}
.td-cartao>.secao{margin:0}
.cfg-ctl .interruptor-texto{min-width:68px}
.td-grupo h3{margin:0 0 var(--e1);font-size:var(--t12);font-weight:650;color:var(--t2);text-transform:uppercase;letter-spacing:.06em}
.td-par{display:flex;justify-content:space-between;gap:var(--e3);padding:5px 0;border-bottom:1px solid var(--fio);font-size:var(--t13)}
.td-par span{color:var(--t2);font-weight:500}
.td-par b{font-weight:650;text-align:right;word-break:break-word}
.td-falha{color:var(--er)}
.td-texto{width:100%;height:120px;margin-top:var(--e2);border-radius:var(--r1);border:0;background:#0b0f14;color:var(--t1);font:12px var(--mono);
  box-shadow:inset 0 0 0 1px var(--fio2);user-select:text;-webkit-user-select:text}
.td-intro{max-width:720px}
@media (max-height:460px){.ini-menu{gap:var(--e2);padding:var(--e2) 0}.ini-botoes{padding:var(--e2);gap:6px}.ini-bt-textos{padding:6px 0}.ini-cab .inicio-marca{width:36px;height:36px}}
@media (max-width:700px){.ini-form{grid-template-columns:minmax(0,1fr)}.cfg-ctl{max-width:70%}}
@media (max-width:1100px){.cfg-abas{width:132px}.cfg-linha{flex-wrap:wrap;gap:var(--e2)}.cfg-ctl{max-width:100%}}
`;
