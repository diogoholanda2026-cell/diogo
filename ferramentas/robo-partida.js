// Robô de partida completa no navegador: joga do início ao fim pela API do Controle, abre painéis e fecha modais
// (os automáticos entram numa fila: nenhum abre com painel aberto, outro modal ou a festa de uma aprovação).
// Também exercita a economia nova pela API J: lotes de até 10 (com um espaço automático), filas em lotes, coleta
// automática (o Coletar só recolhe sobras), aceleradores, Usina de Pedidos, empréstimo (tomado e quitado) e valuation.
// Uso: node ferramentas/testar.mjs /tmp/robo.png "teste=1&novo=1&q=leve&pr=1" 700 400 2000 "$(cat ferramentas/robo-partida.js)"
// Resultado em window.__resultado: capítulo, nível, vida, população, etapas e módulos pendentes, economia.
(async () => {
  const H = window.__held, C = H.C, J = H.J; const esp = (ms) => new Promise((r) => setTimeout(r, ms));
  const LUGAR = ['cidAeroporto', 'cidPorto']; // áreas próprias: o Controle constrói direto
  const ORDEM = ['sul', 'leste', 'norte', 'sudeste', 'nordeste', 'leste2', 'sudeste2', 'nordeste2', 'sul2', 'norte2', 'sudeste3', 'nordeste3', 'sudeste4', 'nordeste4', 'sudeste5', 'nordeste5', 'sul3', 'norte3', 'sul3leste', 'norte3leste'];
  const log = []; const t0 = Date.now(); J.S.ritmo = 4000; J.S.creditos = 200000; J.S.mutirao = 5;
  const paineis = ['obras', 'producao', 'almox', 'pedidos', 'deposito', 'escritorio', 'cidade'];
  const eco = { lotes: 0, auto: 0, coletas: 0, acelerados: 0, pedidosFab: 0, emprestimo: null, valuation: 0, calendario: null, erros: [], cidade: 0, tempo: 0, bairros: 1 };
  // a Prefeitura primeiro (libera os bairros), depois delegacia, escola e posto no meio do Sul, perto das moradias
  const CID = ['cidPrefeitura', 'cidCasas', 'cidSeguranca', 'cidEscola', 'cidAgua', 'cidSaude', 'cidPraca', 'cidComercio', 'cidTerraco', 'cidEnergia', 'cidCasas', 'cidSaneamento', 'cidParque', 'cidMercado',
    'cidConstrutora', 'cidEstacao', 'cidTorre', 'cidFabrica', 'cidFaculdade', 'cidHidreletrica', 'cidLogistica', 'cidEscritorio', 'cidShopping', 'cidCultura', 'cidHospital', 'cidBanco', 'cidPorto', 'cidLuxo', 'cidComercio', 'cidAeroporto', 'cidEstadio', 'cidLuxo', 'cidTerraco', 'cidTorre'];
  // moradias e serviços vão para o meio do Sul (a área de atendimento cobre as moradias); comércio e lazer, para os bairros abertos
  const SUL = new Set(['cidPrefeitura', 'cidCasas', 'cidSeguranca', 'cidEscola', 'cidAgua', 'cidSaude', 'cidTerraco', 'cidEnergia', 'cidSaneamento', 'cidTorre', 'cidFaculdade', 'cidHidreletrica', 'cidHospital', 'cidLuxo']);
  const construiveis = (b) => { const L = J.lotesConstruiveis(b); return [...L.limpos, ...L.mata]; }; // o modo de colocar desmata o lote com mata
  const meio = (b) => { const L = construiveis(b).map((id) => { const [, i, j] = id.split(':'); return { id, i: +i, j: +j }; }); if (!L.length) return null; const ci = L.reduce((a, l) => a + l.i, 0) / L.length, cj = L.reduce((a, l) => a + l.j, 0) / L.length; let best = L[0], bd = 1e9; for (const l of L) { const d = Math.hypot(l.i - ci, (l.j - cj) * 1.5); if (d < bd) { bd = d; best = l; } } return best.id; };
  const ok = (r, oque) => { if (r !== 'ok') eco.erros.push(oque + ':' + r); return r === 'ok'; };
  J.on((t, d) => { if (t === 'coleta' && d.auto) eco.coletas += d.n; });
  const brutos = ['madeira', 'brita', 'aco', 'argila', 'mudas', 'vidro', 'cobre', 'fibra'];
  for (let volta = 0; volta < 5000; volta++) { // para assim que o canteiro é replantado
    J.S.creditos = 1e7; J.tick(Date.now());
    for (const u of ['usina1', 'usina2', 'usina3']) if (J.S.predios[u].ok) C.coletarUsina(u, -1, null);
    for (const o of ['carpintaria', 'concreto', 'horto', 'serralheria', 'vidracaria', 'eletrica', 'laboratorio']) if (J.S.predios[o].ok && J.S.predios[o].prontos.length) C.coletarOficina(o, null);
    for (const id of Object.keys(J.S.predios)) if (!J.S.predios[id].ok && J.construirPredio(id) === 'ok') C.predioConstruido(id);
    // lotes: um espaço livre da Usina de Materiais produz até 10 de uma matéria-prima liberada (o primeiro em automático)
    { const u = J.S.predios.usina1; const i = u.slots.findIndex((s, k) => k < u.nSlots && !s); if (i >= 0) { const k = brutos.filter((b) => J.liberado(b))[volta % 8 % brutos.filter((b) => J.liberado(b)).length]; const n = 1 + (volta % 10); if (ok(J.produzir('usina1', k, n, i === 0), 'produzir')) { eco.lotes += n; if (i === 0) eco.auto++; } } }
    // oficina em lote, limitado pelos insumos (J.loteMax)
    { const cp = J.S.predios.carpintaria; if (cp.ok && cp.fila.length < J.vagasFila('carpintaria') && J.liberado('viga')) { const n = J.loteMax('carpintaria', 'viga'); if (n >= 1) ok(J.enfileirar('carpintaria', 'viga', Math.min(3, n)), 'enfileirar'); } }
    for (const [k, st] of Object.entries(J.S.etapas)) if (st.estado === 'pronta') C.aprovarEtapa(k);
    for (const f of Object.keys(J.S.modulos)) J.S.modulos[f].forEach((m, i) => { if (m.obra?.estado === 'pronta') C.aprovarModulo(f, i); });
    // abre a prancha da próxima etapa de cada projeto e tenta iniciar
    for (const p of window.__PROJ) { const nx = J.proximaEtapa(p); if (!nx) continue; if (nx.s === 'disponivel' || nx.s === 'prancha') { const key = p.id + '.' + nx.e.id; for (const [k, n] of Object.entries(J.faltaEtapa(key))) J.S.itens[k] = (J.S.itens[k] || 0) + n; J.entregarTudo(key); if (J.iniciarEtapa(key) === 'ok') C.sincronizar(); } }
    for (const f of Object.keys(J.S.modulos)) J.S.modulos[f].forEach((m, i) => { if (J.situacaoModulo(f, i) === 'disponivel') { const r = J.requisitosModulo(f, i); for (const [k, n] of Object.entries(r.itens)) J.S.itens[k] = (J.S.itens[k] || 0) + n; if (J.melhorarModulo(f, i) === 'ok') C.sincronizar(); } });
    // aceleradores das etapas na obra mais longa; Usina de Pedidos no primeiro pedido aberto; empréstimo tomado e quitado
    if (J.S.aceleradores?.obra > 0) { let best = null, bf = 0; for (const [k, st] of Object.entries(J.S.etapas)) if (st.estado === 'obra' && st.fim - J.agora > bf) { bf = st.fim - J.agora; best = k; } if (best && ok(J.acelerar({ etapa: best }), 'acelerar')) eco.acelerados++; }
    if (J.S.predios.usina2?.ok && !J.S.pedidos.some((p) => p.auto)) { const i = J.S.pedidos.findIndex((p) => p.itens); if (i >= 0) { const r = J.fabricarPedido(i); if (r === 'ok') eco.pedidosFab++; else if (r !== 'nada') eco.erros.push('fabricarPedido:' + r); } }
    // compra de tempo com créditos: 5 min na etapa em obra mais longa e 1 min num módulo em obra (a cada 13 voltas)
    if (volta % 13 === 6) { let best = null, bf = 0; for (const [k, st] of Object.entries(J.S.etapas)) if (st.estado === 'obra' && st.fim - J.agora > bf) { bf = st.fim - J.agora; best = k; } if (best && ok(J.comprarTempo({ etapa: best }, 5), 'comprarTempo')) eco.tempo += 5;
      for (const f of Object.keys(J.S.modulos)) { const i = J.S.modulos[f].findIndex((m) => m.obra?.estado === 'obra'); if (i >= 0) { if (ok(J.comprarTempo({ modulo: [f, i] }, 1), 'comprarTempoModulo')) eco.tempo += 1; break; } } }
    // cidade: a cada 25 voltas um prédio novo pelo modo de colocar do Controle (os níveis sobem pelo laço dos módulos e as
    // obras prontas são aprovadas como as dos módulos), alternando entre os bairros abertos; compra cada bairro quando o
    // capítulo chega
    if (volta % 25 === 20 && eco.cidade < CID.length && LUGAR.includes(CID[eco.cidade])) { const f = CID[eco.cidade]; if (J.tipoCidadeLiberado(f)) { const n0 = J.S.modulos[f].length; C.colocarCidade(f); if (J.S.modulos[f].length > n0) eco.cidade++; else eco.erros.push('cidade:' + f); } }
    else if (volta % 25 === 20 && eco.cidade < CID.length) { const f = CID[eco.cidade]; if (J.tipoCidadeLiberado(f)) { const abertos = ORDEM.filter((b) => J.bairroAberto(b)); const b = SUL.has(f) ? 'sul' : abertos[eco.cidade % abertos.length]; const lv = construiveis(b); const id = b === 'sul' ? meio(b) : lv[eco.cidade * 3 % Math.max(1, Math.min(20, lv.length))]; const p = id && H.mundo.cidade.centroLote(id); C.colocarCidade(f); if (p) { const n0 = J.S.modulos[f].length; C._colocarEm(p); if (J.S.modulos[f].length > n0) eco.cidade++; else eco.erros.push('cidade:' + f); } C.cancelarColocar(); } }
    for (const b of ORDEM) if (!J.bairroAberto(b)) { const r = J.comprarBairro(b); if (r === 'ok') { eco.bairros++; C.sincronizar(); } else if (r !== 'capitulo' && r !== 'prefeitura') eco.erros.push('comprarBairro:' + b + ':' + r); }
    // serviços da cidade quando a folga acaba (como um jogador faria): água, energia ou saneamento com menos de 3 mil de sobra
    if (volta % 25 === 8) for (const [k, f] of [['agua', 'cidAgua'], ['energia', 'cidEnergia'], ['saneamento', 'cidSaneamento']]) { const si = J.servicoInfo(k); if (si.cap - si.uso < 3000 && !J.podeConstruir(f)) { const id = meio('sul'); if (id && (J.loteLimpo(id) || J.desmatar(id) === 'ok') && J.construirCidade(f, id) === 'ok') { eco.servicosExtra = (eco.servicosExtra || 0) + 1; C.sincronizar(); } break; } }
    // desmate pelo toque duplo do Controle num lote da borda do Sul (volta 12)
    if (volta === 12) { const id = J.lotesConstruiveis('sul').mata.slice(-1)[0]; const p = id && H.mundo.cidade.centroLote(id); if (p) { C._toqueMata(p); C._toqueMata(p); if (!J.loteLimpo(id)) eco.erros.push('desmate:' + id); } }
    // terrenos pelo modo do Controle: compra um lote, e dois toques no mesmo lote o vendem pelo preço atual; outro fica
    if (volta === 30) { const ids = J.lotesLivres('sul').slice(-2); C.colocarTerreno(); for (const id of ids) C._colocarEm(H.mundo.cidade.centroLote(id)); const p = H.mundo.cidade.centroLote(ids[0]); C._colocarEm(p); C._colocarEm(p); C.cancelarColocar(); eco.terrenos = J.terrenosInfo(); if (eco.terrenos.n !== 1) eco.erros.push('terrenos:' + eco.terrenos.n); }
    if (volta === 5) { ok(J.emprestar(10000), 'emprestar'); eco.emprestimo = J.emprestimoInfo().divida; } if (volta === 9) ok(J.quitar(), 'quitar');
    if (volta % 7 === 0) { const t = paineis[(volta / 7) % paineis.length | 0]; C.paineis.abrir(t); await esp(30); C.paineis.fechar(true); }
    if (volta % 11 === 0) { C.paineis.abrir('usina', 'usina1'); await esp(20); C.paineis.fechar(true); C.paineis.abrir('oficina', 'carpintaria'); await esp(20); C.paineis.fechar(true); C.paineis.abrir('modulo', ['anel', 0]); await esp(20); C.paineis.fechar(true); }
    // fecha modais (nível: Continuar; final: data-fecha) e escolhe a primeira opção dos capítulos; a festa da
    // aprovação segura a fila de modais por 2,6 s, e o robô aprova quase todo turno: ele libera a fila
    for (const v of document.querySelectorAll('.veu:not(.sai)')) { const e = v.querySelector('[data-esc]'); if (e) e.click(); else (v.querySelector('[data-continuar]') || v.querySelector('[data-fecha]'))?.click(); }
    C._festaAte = 0; C.update(0.3, performance.now());
    await esp(120);
    log.push(J.S.cap); if (J.S.etapas['reflorestar.e1']?.estado === 'feita') { await esp(6000); break; }
  }
  eco.cidadeInfo = J.cidadeInfo(); eco.rendaInfo = J.rendaInfo?.(); { const F = J.fontesCobertura(), pf = J.temPrefeitura(); eco.moradias = []; for (const f of ['cidCasas', 'cidTerraco', 'cidTorre']) for (const m of J.S.modulos[f]) eco.moradias.push(f.slice(3) + m.nivel + ':' + [...J.coberturaLote(m.lote, F, pf)].map((k) => k[0]).join('')); } eco.valuation = J.valuation().total; eco.calendario = J.calendario(); eco.dividaFim = J.emprestimoInfo().divida; eco.aceleradoresRestantes = { ...J.S.aceleradores }; eco.renda = J.rendaHora(); eco.tarifa = J.tarifaMorador();
  const pend = []; for (const p of window.__PROJ) { const nx = J.proximaEtapa(p); if (nx) pend.push(p.id + '.' + nx.e.id + ':' + nx.s); }
  const mods = Object.entries(J.S.modulos).map(([f, a]) => f + ':' + a.map((m, i) => m.nivel + (m.obra ? '(' + m.obra.estado + ')' : '') + J.situacaoModulo(f, i)[0]).join(','));
  const sites = [...C.sites.entries()].map(([k, s]) => k + (s.concluindo ? '*' : ''));
  window.__resultado = { voltas: log.length, cap: J.S.cap, nivel: J.S.nivel, vida: J.vida().toFixed(1), pop: J.pop, ms: Date.now() - t0, sites, draws: H.engine.stats.calls, pend: pend.slice(0, 40), mods, capEsc: J.S.capEscolhas, metas: J.capitulo()?.metas.map((m) => m.txt + ':' + J.metaFeita(m)), eco };
})();
