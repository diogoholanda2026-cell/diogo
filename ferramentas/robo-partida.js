// Robô de partida completa no navegador: joga do início ao fim pela API do Controle, abre painéis e fecha modais
// (os automáticos entram numa fila: nenhum abre com painel aberto, outro modal ou a festa de uma aprovação).
// Uso: node ferramentas/testar.mjs /tmp/robo.png "teste=1&novo=1&q=leve&pr=1" 700 400 2000 "$(cat ferramentas/robo-partida.js)"
// Resultado em window.__resultado: capítulo, nível, vida, população, etapas e módulos pendentes.
(async () => {
  const H = window.__held, C = H.C, J = H.J; const esp = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = []; const t0 = Date.now(); J.S.ritmo = 4000; J.S.creditos = 200000; J.S.mutirao = 5;
  const paineis = ['obras', 'producao', 'almox', 'pedidos', 'deposito', 'escritorio'];
  for (let volta = 0; volta < 5000; volta++) { // para assim que o canteiro é replantado
    J.S.creditos = 1e7; J.tick(Date.now());
    for (const u of ['usina1', 'usina2', 'usina3']) if (J.S.predios[u].ok) C.coletarUsina(u, -1, null);
    for (const o of ['carpintaria', 'concreto', 'horto', 'serralheria', 'vidracaria', 'eletrica', 'laboratorio']) if (J.S.predios[o].ok && J.S.predios[o].prontos.length) C.coletarOficina(o, null);
    for (const id of Object.keys(J.S.predios)) if (!J.S.predios[id].ok && J.construirPredio(id) === 'ok') C.predioConstruido(id);
    for (const [k, st] of Object.entries(J.S.etapas)) if (st.estado === 'pronta') C.aprovarEtapa(k);
    for (const f of Object.keys(J.S.modulos)) J.S.modulos[f].forEach((m, i) => { if (m.obra?.estado === 'pronta') C.aprovarModulo(f, i); });
    // abre a prancha da próxima etapa de cada projeto e tenta iniciar
    for (const p of window.__PROJ) { const nx = J.proximaEtapa(p); if (!nx) continue; if (nx.s === 'disponivel' || nx.s === 'prancha') { const key = p.id + '.' + nx.e.id; for (const [k, n] of Object.entries(J.faltaEtapa(key))) J.S.itens[k] = (J.S.itens[k] || 0) + n; J.entregarTudo(key); if (J.iniciarEtapa(key) === 'ok') C.sincronizar(); } }
    for (const f of Object.keys(J.S.modulos)) J.S.modulos[f].forEach((m, i) => { if (J.situacaoModulo(f, i) === 'disponivel') { const r = J.requisitosModulo(f, i); for (const [k, n] of Object.entries(r.itens)) J.S.itens[k] = (J.S.itens[k] || 0) + n; if (J.melhorarModulo(f, i) === 'ok') C.sincronizar(); } });
    if (volta % 7 === 0) { const t = paineis[(volta / 7) % paineis.length | 0]; C.paineis.abrir(t); await esp(30); C.paineis.fechar(true); }
    if (volta % 11 === 0) { C.paineis.abrir('usina', 'usina1'); await esp(20); C.paineis.fechar(true); C.paineis.abrir('oficina', 'carpintaria'); await esp(20); C.paineis.fechar(true); C.paineis.abrir('modulo', ['anel', 0]); await esp(20); C.paineis.fechar(true); }
    // fecha modais (nível: Continuar; final: data-fecha) e escolhe a primeira opção dos capítulos; a festa da
    // aprovação segura a fila de modais por 2,6 s, e o robô aprova quase todo turno: ele libera a fila
    for (const v of document.querySelectorAll('.veu:not(.sai)')) { const e = v.querySelector('[data-esc]'); if (e) e.click(); else (v.querySelector('[data-continuar]') || v.querySelector('[data-fecha]'))?.click(); }
    C._festaAte = 0; C.update(0.3, performance.now());
    await esp(120);
    log.push(J.S.cap); if (J.S.etapas['reflorestar.e1']?.estado === 'feita') { await esp(6000); break; }
  }
  const pend = []; for (const p of window.__PROJ) { const nx = J.proximaEtapa(p); if (nx) pend.push(p.id + '.' + nx.e.id + ':' + nx.s); }
  const mods = Object.entries(J.S.modulos).map(([f, a]) => f + ':' + a.map((m, i) => m.nivel + (m.obra ? '(' + m.obra.estado + ')' : '') + J.situacaoModulo(f, i)[0]).join(','));
  const sites = [...C.sites.entries()].map(([k, s]) => k + (s.concluindo ? '*' : ''));
  window.__resultado = { voltas: log.length, cap: J.S.cap, nivel: J.S.nivel, vida: J.vida().toFixed(1), pop: J.pop, ms: Date.now() - t0, sites, draws: H.engine.stats.calls, pend: pend.slice(0, 40), mods, capEsc: J.S.capEscolhas, metas: J.capitulo()?.metas.map((m) => m.txt + ':' + J.metaFeita(m)) };
})();
