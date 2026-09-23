/* =========================================================
   07 · interface: HUD, menu de construção, fichas, painéis
   ========================================================= */
let uiDirty = true;
const H = { cred: $('#hCred'), gems: $('#hGems'), keys: $('#hKeys'), pop: $('#hPop'), joy: $('#hJoy'), joyW: $('#hJoyW'), lvl: $('#hLvl'), medal: $('#lvl'), xp: $('#hXp'),
  pow: $('#hPow'), powBar: $('#hPowBar'), mPow: $('#mPow'), wat: $('#hWat'), watBar: $('#hWatBar'), mWat: $('#mWat'), rec: $('#hRec'), recBar: $('#hRecBar'), mRec: $('#mRec'),
  gEye: $('#gEye'), gTxt: $('#gTxt'), gBar: $('#gBar'), goal: $('#goal'), store: $('#hStore'), sideCargo: $('#sCargo'), sideMarket: $('#sMarket'), sideStore: $('#sStore'), sideGoals: $('#sGoals'), sideTax: $('#sTax') };
const ich = (k, n, have) => `<span class="mc${have != null && have < n ? ' short' : ''}" style="--c:${ITEMS[k].color}">${icon(ITEMS[k].ic)}${n != null ? n : ''}</span>`;
const itemIcon = (k, cls = 'it') => `<span class="${cls}" style="--c:${ITEMS[k].color}">${icon(ITEMS[k].ic)}</span>`;

function updateHUD() {
  H.cred.textContent = fmt(S.credits); H.gems.textContent = fmt(S.gems); H.keys.textContent = fmt(S.keys);
  H.pop.textContent = fmt(D.pop);
  H.joy.textContent = Math.round(D.joy * 100) + '%';
  H.joyW.classList.toggle('low', D.joy < 0.45); H.joyW.classList.toggle('high', D.joy >= 0.75);
  H.lvl.textContent = S.level;
  const f = S.level >= MAXL ? 1 : (S.xp - NEED[S.level]) / (NEED[S.level + 1] - NEED[S.level]);
  H.medal.style.setProperty('--xp', clamp(f, 0, 1).toFixed(3));
  H.xp.textContent = S.level >= MAXL ? 'máx' : `${fmt(S.xp - NEED[S.level])}/${fmt(NEED[S.level + 1] - NEED[S.level])}`;
  const fk = n => n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace('.', ',') + 'k' : fmt(n);
  H.pow.textContent = `${fk(D.pD)}/${fk(D.pS)}`; H.powBar.style.width = (D.pS ? clamp(D.pD / D.pS, 0, 1) * 100 : (D.pD ? 100 : 0)) + '%'; H.mPow.classList.toggle('bad', D.effP < 0.999);
  H.wat.textContent = `${fk(D.wD)}/${fk(D.wS)}`; H.watBar.style.width = (D.wS ? clamp(D.wD / D.wS, 0, 1) * 100 : (D.wD ? 100 : 0)) + '%'; H.mWat.classList.toggle('bad', D.effW < 0.999);
  H.rec.textContent = D.needR ? `${fk(D.rD)}/${fk(D.rS)}` : '—'; H.recBar.style.width = (D.needR && D.rS ? clamp(D.rD / D.rS, 0, 1) * 100 : (D.needR && D.rD ? 100 : 0)) + '%'; H.mRec.classList.toggle('bad', D.effR < 0.999);
  H.store.textContent = `${D.used}/${D.cap}`; H.store.classList.toggle('full', D.used >= D.cap);
  H.sideStore.querySelector('span').textContent = `Armazém ${D.used}/${D.cap}`;
  const g = GOALS[S.goal];
  if (g) {
    const v = Math.min(g.v(), g.n);
    H.gEye.textContent = `Meta ${S.goal + 1} · §${fmt(g.r)}`;
    H.gTxt.textContent = g.t + (g.n > 1 ? ` (${fmt(v)}/${fmt(g.n)})` : '');
    H.gBar.style.width = (v / g.n * 100) + '%';
  } else { H.gEye.textContent = 'Todas as metas cumpridas'; H.gTxt.textContent = 'Continue expandindo a Arcologia de Held.'; H.gBar.style.width = '100%'; }
  // selos laterais
  H.sideCargo.classList.toggle('dot', !!(S.cargo.order && S.cargo.order.every(l => l.ok)));
  H.sideCargo.hidden = !cargoActive();
  H.sideMarket.hidden = !marketActive();
  H.sideStore.classList.toggle('dot', D.ready > 0);
  H.sideTax.hidden = S.taxAcc < 20; H.sideTax.querySelector('b').textContent = '§' + fmt(S.taxAcc);
}
function banner(msg) { const b = $('#banner'); b.textContent = msg; b.hidden = !msg; }
function toast(html, kind) {
  if (quiet) return;
  const box = $('#toasts'); while (box.children.length > 2) box.firstChild.remove();
  const t = el('div', 'toast' + (kind ? ' ' + kind : ''), html); box.append(t);
  H.goal.classList.add('hush');
  setTimeout(() => { t.classList.add('out'); setTimeout(() => { t.remove(); if (!box.children.length) H.goal.classList.remove('hush'); }, 320); }, 2800);
}

/* ---------------- modais ---------------- */
const mq = []; let mOpen = false;
function queueModal(fn) { mq.push(fn); if (!mOpen) nextModal(); }
function nextModal() {
  const fn = mq.shift(); const m = $('#modal');
  if (!fn) { m.hidden = true; mOpen = false; return; }
  mOpen = true; $('#mCard').innerHTML = fn(); m.hidden = false;
  const b = $('#mCard').querySelector('[data-close]'); if (b) setTimeout(() => b.focus(), 50);
}
$('#modal').addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target === $('#modal')) nextModal(); });
function levelModal(L, reward) {
  const un = Object.values(TYPES).filter(t => t.unlock === L && t.catalog !== false);
  const its = Object.keys(ITEMS).filter(k => ITEMS[k].raw && ITEMS[k].unlock === L);
  const land = LAND_REQ.findIndex(r => r && r.lvl === L);
  return `<small>Cidade subiu de nível</small><h2>Nível ${L}</h2>
    <p>Recompensa: <b style="color:var(--brass-hi)">+§${fmt(reward.c)}</b> · <b style="color:var(--violet)">+${reward.gems} cristais</b>${reward.pecas ? ` · +${reward.pecas} peça` : ''}</p>
    ${un.length || its.length || land > 0 ? `<div class="unl">${un.map(t => `<div><img src="${ASSETS[t.res ? RES_STAGES[0].img : t.img]}" alt=""><span><b>${t.name}</b><br><small>${CAT_NAME[t.cat]} · ${statLine(t)}</small></span></div>`).join('')}
    ${its.map(k => `<div><span class="unl-ic">${itemIcon(k)}</span><span><b>${ITEMS[k].name}</b><br><small>Nova matéria-prima nas fábricas</small></span></div>`).join('')}
    ${land > 0 ? `<div><span class="unl-ic">${icon('city')}</span><span><b>Novo terreno</b><br><small>Expansão para ${LAND[land]}×${LAND[land]} disponível na Sede</small></span></div>` : ''}</div>` : ''}
    <button class="btn brass" data-close>Continuar</button>`;
}
function winModal() {
  return `<small>Obra-prima concluída</small><h2 class="m">A Arcologia de Held está completa</h2>
    <p>Campus, biblioteca, acelerador, santuário e bioma agora funcionam como um só complexo. A cidade continua: ainda há metas, terreno e níveis pela frente.</p>
    <button class="btn brass" data-close>Continuar construindo</button>`;
}
function welcomeModal() {
  return `<small>Bem-vindo</small><h2 class="m">Arcologia de Held</h2>
    <p>Sua maquete viva começa com duas moradias, uma fábrica, energia e água. Construa <b>Zonas Residenciais</b> ao lado das ruas, produza itens nas <b>fábricas</b> e <b>lojas</b> e entregue-os para <b>melhorar</b> as moradias.</p>
    <p>Toque numa construção para ver o que ela precisa. Siga a meta no canto superior esquerdo.</p>
    <button class="btn brass" data-close>Começar</button>`;
}

/* ---------------- folha inferior ---------------- */
const sheet = $('#sheet'), sBody = $('#sBody');
let sheetKind = null, sheetRefresh = null;
function openSheet(kind, eye, title, build) {
  closeBuildMenu();
  sheetKind = kind; $('#sEye').textContent = eye; $('#sTitle').textContent = title;
  const keepScroll = sheet.dataset.kind === kind ? sBody.scrollTop : 0;
  sheet.dataset.kind = kind; sheet.hidden = false;
  sBody.innerHTML = ''; sheetRefresh = build(sBody) || null;
  sBody.scrollTop = keepScroll;
  requestAnimationFrame(() => sheet.classList.add('open'));
}
function closeSheet(keepSel) {
  if (!keepSel) sel = null;
  if (!sheetKind) return;
  sheetKind = null; sheetRefresh = null; sheet.classList.remove('open'); sheet.dataset.kind = '';
  setTimeout(() => { if (!sheetKind) sheet.hidden = true; }, 240);
}
$('#sClose').addEventListener('click', () => closeSheet());

/* ---------------- menu de construção (faixa inferior) ---------------- */
let buildOpen = false, buildRefresh = null, catTab = 'res';
const bmenu = $('#bmenu');
function statLine(t) {
  if (t.res) return `+${RES_STAGES[0].pop} hab. no 1º estágio · evolui até ${RES_STAGES[RES_MAX - 1].pop}`;
  if (t.cat === 'fab') return `${t.slots} vagas · matérias-primas${t.boost ? ' · +25% velocidade' : ''}`;
  if (t.cat === 'loja') return `${t.slots} vagas · ${Object.keys(ITEMS).filter(k => ITEMS[k].loja === t.id).map(k => ITEMS[k].short).join(', ')}`;
  if (t.power) return `+${fmt(t.power)} MW de energia`;
  if (t.water) return `+${fmt(t.water)} m³/h de água`;
  if (t.waste) return `+${fmt(t.waste)} t/dia de reciclagem`;
  if (t.cargo) return 'Encomendas: chaves e peças de expansão';
  if (t.market) return 'Abre o Mercado Global';
  if (t.transit) return `+${t.transit} de capacidade nas ruas · raio ${t.radius}`;
  const parts = [];
  if (t.pop) parts.push(`+${fmt(t.pop)} hab.`);
  if (t.cov && t.cov !== 'par') parts.push(`Cobre um raio de ${t.radius} quadrados`);
  if (t.joy) parts.push(`+${Math.round(t.joy * 100)}% felicidade${t.cov === 'par' ? ` · raio ${t.radius}` : ''}`);
  if (t.taxBoost) parts.push(`+${Math.round(t.taxBoost * 100)}% impostos`);
  if (t.prodBoost) parts.push(`+${Math.round(t.prodBoost * 100)}% produção`);
  if (t.tourism) parts.push(`+§${t.tourism}/h turismo`);
  if (t.storage) parts.push(`+${t.storage} no armazém`);
  return parts.join(' · ');
}
function openBuildMenu(tab) {
  closeSheet();
  if (tab) catTab = tab;
  buildOpen = true; bmenu.hidden = false; $('#goal').hidden = true; $('#side').hidden = true;
  requestAnimationFrame(() => bmenu.classList.add('open'));
  const tabs = $('#bTabs'); tabs.innerHTML = '';
  for (const c of CATS) {
    const b = el('button', 'btab' + (c.id === catTab ? ' on' : ''), `${icon(c.ic)}<span>${c.name}</span>`);
    b.onclick = () => { catTab = c.id; openBuildMenu(); }; tabs.append(b);
  }
  requestAnimationFrame(() => { const on = tabs.querySelector('.on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' }); });
  const strip = $('#bCards'); strip.innerHTML = ''; const cards = [];
  if (catTab === 'tra') {
    const card = el('button', 'bcard road');
    card.innerHTML = `<span class="thumb"><span class="rd">${icon('road')}</span></span><span class="c-name">Ruas</span><span class="c-stat">Traçar, subir de nível ou remover</span><span class="c-cost">${coin(ROAD_COST[1])} <small>/ quadrado</small></span>`;
    card.onclick = () => startRoads(); strip.append(card);
  }
  for (const t of Object.values(TYPES)) {
    if (t.cat !== catTab || t.catalog === false) continue;
    const card = el('button', 'bcard');
    card.innerHTML = `<span class="thumb"><img src="${ASSETS[t.res ? RES_STAGES[0].img : t.img]}" alt="" loading="lazy"><i class="fp">${t.w}×${t.h}</i><i class="cnt" hidden></i></span>
      <span class="c-name">${t.name}</span><span class="c-stat">${statLine(t)}</span>
      <span class="c-cost">${coin(t.cost)}${t.keys ? key(t.keys) : ''}${t.items ? Object.keys(t.items).map(k => ich(k, t.items[k])).join('') : ''}</span>`;
    if (S.level < t.unlock) { card.classList.add('locked'); card.append(el('span', 'lock', `${icon('lock', 'f')}Nível ${t.unlock}`)); }
    card.onclick = () => {
      if (S.level < t.unlock) return toast(`Libera no nível ${t.unlock} da cidade.`, 'bad');
      if (t.unique && cnt(t.id)) return toast('Esta obra é única e já foi construída.', 'bad');
      startPlace(t.id);
    };
    strip.append(card); cards.push([card, t]);
  }
  buildRefresh = () => {
    for (const [card, t] of cards) {
      card.classList.toggle('poor', S.level >= t.unlock && !canPay(t.cost, t.keys, t.items));
      const c = card.querySelector('.cnt'); const n = cnt(t.id); c.hidden = !n; c.textContent = '×' + n;
    }
  };
  buildRefresh();
}
function closeBuildMenu() {
  if (!buildOpen) return;
  buildOpen = false; buildRefresh = null; bmenu.classList.remove('open');
  setTimeout(() => { if (!buildOpen) bmenu.hidden = true; }, 220);
  if (mode === 'normal') { $('#goal').hidden = false; $('#side').hidden = false; }
}
$('#bClose').addEventListener('click', closeBuildMenu);

/* ---------------- ficha da construção ---------------- */
function statusOf(b) {
  const t = TYPES[b.t];
  if (b.b > 0 && !b.up) return ['warn', `${icon('crane')}<span>Em obras — pronta em ${dur(b.b)}.</span>`];
  if (!b._con) return ['bad', `${icon('road')}<span>Sem ligação com a rodovia. Trace uma rua encostada nesta construção e ligada à rodovia da esquerda.</span>`];
  const needsP = t.res || t.useP, needsW = t.res || t.useW, needsR = t.res || t.useR;
  if (needsP && D.effP < 0.999) return ['bad', `${icon('bolt', 'f')}<span>Falta energia na cidade (${Math.round(D.effP * 100)}% atendida). Construa mais geração.</span>`];
  if (needsW && D.effW < 0.999) return ['bad', `${icon('drop', 'f')}<span>Falta água na cidade (${Math.round(D.effW * 100)}% atendida). Construa reservatórios.</span>`];
  if (needsR && D.effR < 0.999) return ['bad', `${icon('recycle')}<span>A reciclagem não dá conta (${Math.round(D.effR * 100)}%). Construa estações de reciclagem.</span>`];
  if (b._jam) return ['warn', `${icon('car')}<span>Trânsito pesado na rua ao lado. Suba o nível da rua (Ruas → Subir nível) ou construa uma Estação Transit.</span>`];
  if (b.up) return ['warn', `${icon('crane')}<span>Melhorando para ${RES_STAGES[b.up - 1].name} — pronta em ${dur(b.b)}.</span>`];
  return ['', `${icon('check')}<span>Funcionando normalmente.</span>`];
}
function openInfo(b, tab) {
  if (!b) return; sel = b; const t = TYPES[b.t];
  const stage = t.res ? RES_STAGES[b.lvl - 1] : null;
  openSheet('info', (t.tag ? t.tag + ' · ' : '') + CAT_NAME[t.cat], stage ? stage.name : t.name, body => {
    const img = t.full ? ASSETS[t.full] : ASSETS[stage ? stage.img : t.img];
    body.append(el('figure', 'hero' + (t.res || t.slots ? ' low' : ''), `<img src="${img}" alt="Maquete: ${t.name}">${t.full ? `<figcaption>${t.tag || 'Maquete'}</figcaption>` : stage ? `<figcaption>Estágio ${b.lvl} de ${RES_MAX}</figcaption>` : ''}`));
    if (t.res) body.append(el('div', 'pips', Array.from({ length: RES_MAX }, (_, i) => `<i class="${i < b.lvl ? 'on' : ''}"></i>`).join('')));
    const st = el('div', 'status'); body.append(st);
    let upBox = null, reqBox = null, prodBox = null, taxBox = null, landB = null, storeB = null, cargoB = null;
    if (t.res) {
      upBox = el('div', 'box up'); body.append(upBox);
      reqBox = el('div', 'box req-box'); body.append(reqBox);
    }
    if (t.slots) { prodBox = el('div', 'box prod'); body.append(prodBox); }
    if (b.t === 'sede') { taxBox = el('div', 'box'); body.append(taxBox); }
    const kv = el('dl', 'kv'); body.append(kv);
    body.append(el('p', 'desc', stage ? stage.desc : t.desc));
    if (b.t === 'sede') {
      landB = landBox(); storeB = storeBox(); body.append(landB, storeB);
      if (tab === 'land') setTimeout(() => landB.scrollIntoView({ behavior: 'smooth', block: 'center' }), 260);
    }
    if (t.cargo) { cargoB = el('div', 'box'); body.append(cargoB); cargoB.append(el('h3', null, 'Encomendas')); const bt = el('button', 'btn brass', 'Abrir o Terminal de Cargas'); bt.onclick = openCargo; cargoB.append(bt); }
    if (t.market) { const mb = el('div', 'box'); mb.append(el('h3', null, 'Mercado Global')); const bt = el('button', 'btn brass', 'Abrir o Mercado'); bt.onclick = openMarket; mb.append(bt); body.append(mb); }
    const acts = el('div', 'row');
    if (!t.noMove) { const mv = el('button', 'btn', 'Mover'); mv.onclick = () => startPlace(b.t, b); acts.append(mv); }
    if (!t.noDemolish) {
      const dm = el('button', 'btn danger', 'Demolir'); let armed = 0;
      dm.onclick = () => {
        if (!armed) { armed = setTimeout(() => { armed = 0; dm.classList.remove('armed'); dm.textContent = 'Demolir'; }, 3000); dm.classList.add('armed'); dm.textContent = `Confirmar (+§${fmt((t.cost || 0) / 2)})`; return; }
        clearTimeout(armed); S.bld = S.bld.filter(x => x !== b); S.credits += (t.cost || 0) / 2; recalc(); markDirty(); closeSheet(); toast(`${t.name} demolida.`);
      };
      acts.append(dm);
    }
    body.append(acts);
    const refresh = () => {
      if (!S.bld.includes(b)) return closeSheet();
      const [cls, msg] = statusOf(b); st.className = 'status ' + cls; st.innerHTML = msg;
      const rows = [];
      if (t.res) {
        const c = b._cov || { seg: false, sau: false, edu: false, par: 0 };
        rows.push(['População', fmt(popOf(b))], ['Felicidade', Math.round((b._joy || 0) * 100) + '%'], ['Impostos', '§' + fmtR(b._inc || 0) + '/h']);
        rows.push(['Serviços', `<span class="svc"><i class="${D.effP >= 0.999 ? 'ok' : ''}">${icon('bolt', 'f')}</i><i class="${D.effW >= 0.999 ? 'ok' : ''}">${icon('drop', 'f')}</i><i class="${D.effR >= 0.999 ? 'ok' : ''}">${icon('recycle')}</i><i class="${c.seg ? 'ok' : ''}">${icon('shield')}</i><i class="${c.sau ? 'ok' : ''}">${icon('health')}</i><i class="${c.edu ? 'ok' : ''}">${icon('book')}</i><i class="${c.par > 0 ? 'ok' : ''}">${icon('tree')}</i></span>`]);
      }
      if (t.pop) rows.push(['Moradores', '+' + fmt(t.pop)]);
      if (t.power) rows.push(['Gera energia', fmt(t.power) + ' MW']);
      if (t.water) rows.push(['Fornece água', fmt(t.water) + ' m³/h']);
      if (t.waste) rows.push(['Recicla', fmt(t.waste) + ' t/dia']);
      if (t.slots) rows.push(['Vagas na fila', t.slots], ['Velocidade', Math.round(prodRate(b) * 100) + '%']);
      if (t.cov && t.cov !== 'par') rows.push([{ seg: 'Segurança', sau: 'Saúde', edu: 'Educação' }[t.cov], 'raio ' + t.radius]);
      if (t.joy) rows.push(['Felicidade', '+' + Math.round(t.joy * 100) + '%'], ['Alcance', t.radius + ' quadrados']);
      if (t.transit) rows.push(['Capacidade extra', '+' + t.transit + ' nas ruas'], ['Alcance', t.radius + ' quadrados']);
      if (t.tourism) rows.push(['Turismo', '§' + fmtR(t.tourism * D.taxMul) + '/h']);
      if (b.t === 'sede') rows.push(['Impostos/hora', '§' + fmtR(D.taxH)], ['Bônus de impostos', '+' + Math.round((D.taxMul - 1) * 100) + '%'], ['Terreno', LAND[S.land] + '×' + LAND[S.land]], ['Armazém', D.used + '/' + D.cap]);
      if (!t.res && (t.useP || t.useW || t.useR)) rows.push(['Consumo', `${t.useP || 0} MW · ${t.useW || 0} m³/h · ${t.useR || 0} t`]);
      rows.push(['Tamanho', t.w + '×' + t.h]);
      kv.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
      if (upBox) renderUpgradeBox(b, upBox);
      if (reqBox) renderReqBox(b, reqBox);
      if (prodBox) renderProdBox(b, prodBox);
      if (taxBox) {
        taxBox.innerHTML = `<h3>Impostos acumulados</h3><p>A Sede guarda até ${TAX_CAP_H} h de arrecadação (§${fmt(taxCap())}). Toque para coletar.</p>
          <div class="row"><button class="btn brass" data-tax ${S.taxAcc < 1 ? 'disabled' : ''}>Coletar §${fmt(S.taxAcc)}</button></div>`;
        taxBox.querySelector('[data-tax]').onclick = collectTax;
      }
      if (landB && landB._upd) landB._upd(); if (storeB && storeB._upd) storeB._upd();
    };
    refresh(); return refresh;
  });
}
function renderUpgradeBox(b, box) {
  const t = TYPES[b.t];
  if (b.up) { box.innerHTML = `<h3>Melhorando para ${RES_STAGES[b.up - 1].name}</h3><p>Pronta em ${dur(b.b)}.</p><div class="row"><button class="btn aur sm" data-gem>Terminar agora (${gem(gemsForTime(b.b))})</button></div>`;
    box.querySelector('[data-gem]').onclick = () => { const g = gemsForTime(b.b); if (S.gems < g) return toast('Faltam cristais.', 'bad'); S.gems -= g; b.b = 0.01; markDirty(); }; return; }
  if (!b.need) { box.innerHTML = `<h3>Estágio máximo</h3><p>Esta moradia chegou ao auge: ${RES_STAGES[RES_MAX - 1].name}.</p>`; return; }
  const next = RES_STAGES[b.lvl]; const val = needValue(b.need); const miss = missingOf(b.need); const g = gemsForNeed(b.need);
  if (!box._built) {
    box._built = true;
    box.innerHTML = `<h3>Melhorar para ${next.name}</h3><p>População sobe de ${fmt(RES_STAGES[b.lvl - 1].pop)} para ${fmt(next.pop)} habitantes. Recompensa: <b>§${fmt(Math.round(val * 1.6) + 40)}</b> e ${Math.round(val / 9) + 4} XP.</p>
      <div class="need"></div><div class="row"><button class="btn brass" data-up>Melhorar</button><button class="btn aur" data-buy hidden></button></div>`;
    box.querySelector('[data-up]').onclick = () => startUpgrade(b, false);
    box.querySelector('[data-buy]').onclick = () => startUpgrade(b, true);
  }
  box.querySelector('.need').innerHTML = b.need.map(([k, n]) => { const have = S.items[k] || 0; return `<span class="ni${have < n ? ' short' : ' ok'}" style="--c:${ITEMS[k].color}">${icon(ITEMS[k].ic)}<b>${Math.min(have, n)}/${n}</b><small>${ITEMS[k].short}</small></span>`; }).join('');
  const ok = hasNeed(b.need) && b._con;
  box.querySelector('[data-up]').disabled = !ok;
  const bb = box.querySelector('[data-buy]'); bb.hidden = !Object.keys(miss).length; bb.innerHTML = `Comprar o que falta e melhorar ${gem(g)}`; bb.disabled = S.gems < g;
}
function renderReqBox(b, box) {
  if (!b.req) { box.hidden = true; return; }
  box.hidden = false; const r = b.req;
  box.innerHTML = `<h3>${icon('chat')} Pedido dos moradores</h3><p>Eles querem <b>${r.n}× ${ITEMS[r.k].name}</b> e pagam <b>§${fmt(r.cred)}</b> + ${r.xp} XP. Expira em ${dur(r.exp)}.</p>
    <div class="row"><span class="ni ${(S.items[r.k] || 0) >= r.n ? 'ok' : 'short'}" style="--c:${ITEMS[r.k].color}">${icon(ITEMS[r.k].ic)}<b>${Math.min(S.items[r.k] || 0, r.n)}/${r.n}</b><small>${ITEMS[r.k].short}</small></span><button class="btn brass" data-give ${(S.items[r.k] || 0) >= r.n ? '' : 'disabled'}>Entregar</button></div>`;
  box.querySelector('[data-give]').onclick = () => fulfillReq(b);
}
function renderProdBox(b, box) {
  const t = TYPES[b.t]; const list = producible(b);
  if (!box._built) {
    box._built = true;
    box.innerHTML = `<h3>${t.cat === 'fab' ? 'Linha de produção' : 'Balcão de produção'}</h3><div class="queue"></div><div class="ready"></div><p class="hint"></p><div class="menu"></div>`;
  }
  const q = box.querySelector('.queue'); q.innerHTML = '';
  for (let i = 0; i < t.slots; i++) {
    const it = b.q[i];
    if (!it) { q.append(el('span', 'slot empty', i === b.q.length ? '+' : '')); continue; }
    const s = el('span', 'slot', `${itemIcon(it.k)}<small>${i === 0 ? dur(it.t / prodRate(b)) : ITEMS[it.k].short}</small>`); s.style.setProperty('--c', ITEMS[it.k].color);
    if (i === 0) { const f = 1 - it.t / ITEMS[it.k].time; s.style.setProperty('--f', f.toFixed(3)); s.classList.add('cur'); s.title = 'Acelerar com cristais'; s.onclick = () => speedUp(b); }
    q.append(s);
  }
  if (b.q.length) { const sp = el('button', 'btn sm aur', `Acelerar ${gem(gemsForTime(b.q[0].t / prodRate(b)))}`); sp.onclick = () => speedUp(b); q.append(sp); }
  const rd = box.querySelector('.ready');
  if (b.done.length) { rd.hidden = false; rd.innerHTML = `<span>Prontos: ${b.done.map(k => itemIcon(k)).join('')}</span>`; const cb = el('button', 'btn brass sm', `Coletar ${b.done.length}`); cb.onclick = () => collect(b); rd.append(cb); }
  else rd.hidden = true;
  box.querySelector('.hint').textContent = !b._on ? 'A produção só anda com a construção ligada à rua e pronta.' : b.q.length >= t.slots ? 'Fila cheia. Espere terminar para pôr mais.' : t.cat === 'fab' ? 'Toque num item para pôr na fila. As matérias-primas vão para o armazém quando você coleta.' : 'Toque num produto para fabricar. Os insumos saem do armazém na hora.';
  const menu = box.querySelector('.menu');
  if (menu.dataset.n !== String(list.length) + S.level) {
    menu.dataset.n = String(list.length) + S.level; menu.innerHTML = '';
    for (const k of list) {
      const it = ITEMS[k];
      const bt = el('button', 'pitem', `${itemIcon(k, 'it big')}<b>${it.name}</b><small>${dur(it.time)} · vale §${it.val}</small>${it.in ? `<span class="ins">${Object.keys(it.in).map(j => ich(j, it.in[j])).join('')}</span>` : ''}`);
      bt.dataset.k = k; bt.onclick = () => queueItem(b, k); menu.append(bt);
    }
  }
  for (const bt of menu.children) { const it = ITEMS[bt.dataset.k]; const okIn = !it.in || hasItems(it.in); bt.classList.toggle('poor', !okIn); bt.disabled = b.q.length >= t.slots || !okIn; if (it.in) bt.querySelector('.ins').innerHTML = Object.keys(it.in).map(j => ich(j, it.in[j], S.items[j] || 0)).join(''); }
}
function landBox() {
  const box = el('div', 'box');
  const next = S.land + 1, req = LAND_REQ[next];
  if (!req) { box.innerHTML = `<h3>Terreno completo</h3><p>A cidade já ocupa toda a mesa: ${N}×${N} quadrados.</p>`; return box; }
  box.innerHTML = `<h3>Expandir terreno para ${LAND[next]}×${LAND[next]}</h3><p>Hoje: ${LAND[S.land]}×${LAND[S.land]}. Exige cidade no nível ${req.lvl}, créditos e peças de expansão (vêm de encomendas, melhorias e metas).</p>
    <div class="req"><span data-c>${icon('coin', 'f')}§${fmt(req.c)}</span><span data-p>${icon('piece', 'f')}${req.p} peças</span><span data-l>${icon('star', 'f')}Nível ${req.lvl}</span></div>
    <button class="btn brass" data-go>Expandir</button>`;
  const go = box.querySelector('[data-go]'); go.onclick = expandLand;
  box._upd = () => { go.disabled = S.level < req.lvl || S.credits < req.c || S.pecas < req.p; box.querySelector('[data-c]').classList.toggle('short', S.credits < req.c); box.querySelector('[data-p]').classList.toggle('short', S.pecas < req.p); box.querySelector('[data-l]').classList.toggle('short', S.level < req.lvl); box.querySelector('[data-p]').innerHTML = `${icon('piece', 'f')}${S.pecas}/${req.p} peças`; };
  box._upd(); return box;
}
function storeBox() {
  const box = el('div', 'box');
  const req = storeReq(S.storeUp);
  box.innerHTML = `<h3>Ampliar o armazém (+${STORE_STEP})</h3><p>Hoje cabem ${D.cap} itens. Cada ampliação custa créditos e peças de expansão.</p>
    <div class="req"><span data-c>${icon('coin', 'f')}§${fmt(req.c)}</span><span data-p>${icon('piece', 'f')}${req.p} peças</span></div>
    <button class="btn brass" data-go>Ampliar</button>`;
  const go = box.querySelector('[data-go]'); go.onclick = () => { upgradeStore(); if (sheetKind === 'info' && sel) openInfo(sel); else if (sheetKind === 'store') openStore(); };
  box._upd = () => { go.disabled = S.credits < req.c || S.pecas < req.p; box.querySelector('[data-c]').classList.toggle('short', S.credits < req.c); box.querySelector('[data-p]').classList.toggle('short', S.pecas < req.p); box.querySelector('[data-p]').innerHTML = `${icon('piece', 'f')}${S.pecas}/${req.p} peças`; };
  box._upd(); return box;
}

/* ---------------- armazém e depósito comercial ---------------- */
let depotPick = null;
function openStore() {
  openSheet('store', `${D.used} de ${D.cap} itens`, 'Armazém', body => {
    const top = el('div', 'row wrap'); body.append(top);
    const ca = el('button', 'btn sm aur', 'Coletar tudo pronto'); ca.onclick = () => { const n = collectAll(); toast(n ? `${icon('check')} ${n} item(ns) coletados.` : 'Nada pronto para coletar.', n ? 'good' : ''); }; top.append(ca);
    const grid = el('div', 'inv'); body.append(grid);
    body.append(el('h3', 'h', 'Depósito comercial'));
    body.append(el('p', 'desc', 'Ponha itens à venda: outras cidades compram em alguns minutos e o dinheiro entra sozinho. Escolha um item acima e depois uma vaga livre.'));
    const dep = el('div', 'depot'); body.append(dep);
    body.append(storeBox());
    const refresh = () => {
      const keys = Object.keys(ITEMS).filter(k => (S.items[k] || 0) > 0 || unlockedItems().includes(k));
      grid.innerHTML = keys.map(k => `<button class="inv-it${depotPick === k ? ' on' : ''}${(S.items[k] || 0) ? '' : ' none'}" data-k="${k}" style="--c:${ITEMS[k].color}">${icon(ITEMS[k].ic)}<b>${S.items[k] || 0}</b><small>${ITEMS[k].short}</small></button>`).join('');
      grid.querySelectorAll('[data-k]').forEach(bt => bt.onclick = () => { depotPick = depotPick === bt.dataset.k ? null : bt.dataset.k; refresh(); });
      const ca2 = D.ready > 0; ca.hidden = !ca2;
      dep.innerHTML = '';
      S.depot.forEach((d, i) => {
        const s = el('div', 'dslot');
        if (d) { s.innerHTML = `${itemIcon(d.k, 'it big')}<b>${d.n}× ${ITEMS[d.k].short}</b><small>§${fmt(d.price)} · vende em ${dur(d.t)}</small>`; }
        else if (depotPick && (S.items[depotPick] || 0) > 0) {
          const n = Math.min(10, S.items[depotPick] || 0);
          s.classList.add('free'); s.innerHTML = `<b>Vender ${itemIcon(depotPick)} ${ITEMS[depotPick].short}</b><div class="row">${[1, 5, 10].filter(q => q <= n).map(q => `<button class="btn sm" data-q="${q}">${q}× por §${fmt(Math.round(ITEMS[depotPick].val * q * 1.15))}</button>`).join('')}${n > 1 && ![1, 5, 10].includes(n) ? `<button class="btn sm" data-q="${n}">${n}× por §${fmt(Math.round(ITEMS[depotPick].val * n * 1.15))}</button>` : ''}</div>`;
          s.querySelectorAll('[data-q]').forEach(bt => bt.onclick = () => { listDepot(i, depotPick, +bt.dataset.q); refresh(); });
        } else { s.classList.add('empty'); s.innerHTML = `<small>Vaga livre — escolha um item do armazém</small>`; }
        dep.append(s);
      });
    };
    refresh(); return refresh;
  });
}

/* ---------------- mercado global ---------------- */
function openMarket() {
  if (!marketActive()) return toast('Construa a Torre do Comércio Global para abrir o mercado.', 'bad');
  openSheet('market', 'Ofertas de outras cidades', 'Mercado Global', body => {
    const top = el('div', 'row'); body.append(top);
    const info = el('p', 'desc'); body.append(info);
    const grid = el('div', 'offers'); body.append(grid);
    const rf = el('button', 'btn sm aur'); top.append(rf);
    rf.onclick = () => { if (S.market.wait <= 0) { refreshMarket(); } else { if (S.gems < 2) return toast('Faltam cristais.', 'bad'); S.gems -= 2; refreshMarket(); } markDirty(); refresh(); };
    const refresh = () => {
      rf.innerHTML = S.market.wait <= 0 ? 'Novas ofertas (grátis)' : `Novas ofertas agora ${gem(2)} · grátis em ${dur(S.market.wait)}`;
      info.textContent = `Armazém: ${D.used}/${D.cap}. As ofertas mudam a cada 5 minutos.`;
      grid.innerHTML = S.market.offers.map((o, i) => `<button class="offer${o.sold ? ' sold' : ''}${S.credits < o.price || o.n > storeFree() ? ' poor' : ''}" data-i="${i}" ${o.sold ? 'disabled' : ''}>${itemIcon(o.k, 'it big')}<b>${o.n}× ${ITEMS[o.k].short}</b><small>${o.sold ? 'Comprado' : coin(o.price)}</small></button>`).join('');
      grid.querySelectorAll('[data-i]').forEach(bt => bt.onclick = () => { buyOffer(+bt.dataset.i); refresh(); });
    };
    refresh(); return refresh;
  });
}

/* ---------------- terminal de cargas ---------------- */
function openCargo() {
  if (!cargoActive()) return toast('Construa o Terminal de Cargas (Transporte) para receber encomendas.', 'bad');
  openSheet('cargo', 'Encomendas de outras cidades', 'Terminal de Cargas', body => {
    const box = el('div'); body.append(box);
    const refresh = () => {
      const o = S.cargo.order;
      if (!o) { box.innerHTML = `<div class="status warn">${icon('crane')}<span>O próximo comboio chega em ${dur(S.cargo.wait)}.</span></div><p class="desc">Cada encomenda pede alguns itens. Complete todas as caixas e despache para ganhar chaves (para parques e marcos) e peças de expansão (terreno e armazém).</p>`; return; }
      const r = S.cargo.reward;
      box.innerHTML = `<p class="desc">Recompensa ao despachar: ${key(r.keys)} chaves · ${icon('piece', 'f')} ${r.pecas} peças · ${coin(r.c)} · ${r.xp} XP</p><div class="crates"></div><div class="row"><button class="btn brass" data-go ${o.every(l => l.ok) ? '' : 'disabled'}>Despachar comboio</button></div>`;
      const cr = box.querySelector('.crates');
      o.forEach((l, i) => {
        const have = S.items[l.k] || 0;
        const c = el('div', 'crate' + (l.ok ? ' ok' : ''));
        c.innerHTML = `${itemIcon(l.k, 'it big')}<b>${l.n}× ${ITEMS[l.k].name}</b><small>${l.ok ? 'Caixa cheia' : `no armazém: ${have}`}</small>${l.ok ? icon('check') : `<button class="btn sm brass" ${have >= l.n ? '' : 'disabled'}>Encher</button>`}`;
        const bt = c.querySelector('button'); if (bt) bt.onclick = () => { fillCargo(i); refresh(); };
        cr.append(c);
      });
      box.querySelector('[data-go]').onclick = () => { dispatchCargo(); refresh(); };
    };
    refresh(); return refresh;
  });
}

/* ---------------- metas ---------------- */
function openGoals() {
  openSheet('goals', `${Math.min(S.goal, GOALS.length)} de ${GOALS.length} cumpridas`, 'Metas da arcologia', body => {
    const ul = el('ul', 'goals');
    GOALS.forEach((g, i) => {
      if (i > S.goal + 2 || i < S.goal - 3) return;
      const li = el('li', i < S.goal ? 'done' : i === S.goal ? 'cur' : 'next');
      const prog = i === S.goal && g.n > 1 ? ` <span style="color:var(--muted)">(${fmt(Math.min(g.v(), g.n))}/${fmt(g.n)})</span>` : '';
      li.innerHTML = `<span class="n">${i < S.goal ? icon('check') : i + 1}</span><p>${g.t}${prog}</p><small>§${fmt(g.r)}${g.keys ? ` · ${g.keys}${icon('key', 'f')}` : ''}${g.gems ? ` · ${g.gems}${icon('gem', 'f')}` : ''}</small>`;
      ul.append(li);
    });
    body.append(ul);
    if (GOALS.length - S.goal > 3) body.append(el('p', 'desc', `<br>Mais ${GOALS.length - S.goal - 3} metas aparecem conforme você avança.`));
  });
}

/* ---------------- cidade / ajustes ---------------- */
function openCity() {
  openSheet('city', 'Painel da cidade', 'Arcologia de Held', body => {
    const kv = el('dl', 'kv'); body.append(kv);
    const sp = el('div', 'box', `<h3>Ritmo do jogo</h3><p>Acelera obras, produção e impostos. Tudo é grátis — não existe loja nem espera paga.</p><div class="seg" role="group" aria-label="Ritmo">${[1, 2, 3].map(v => `<button data-sp="${v}" class="${S.speed === v ? 'on' : ''}">${v}×</button>`).join('')}</div>`);
    sp.querySelectorAll('[data-sp]').forEach(bt => bt.onclick = () => { S.speed = +bt.dataset.sp; markDirty(); openCity(); });
    body.append(sp);
    body.append(landBox(), storeBox());
    const sv = el('div', 'box', `<h3>Progresso salvo</h3><p data-sv></p><div class="row"><button class="btn sm" data-save>Salvar agora</button></div>`);
    sv.querySelector('[data-save]').onclick = () => { saveLocal(); cloudSave(); toast(`${icon('check')} Salvo.`, 'good'); };
    body.append(sv);
    const help = el('details', 'box', `<summary>Como jogar</summary><ol class="help">
      <li><b>Toda construção precisa encostar numa rua</b> ligada à rodovia que entra pela esquerda. Sem isso aparece um selo laranja.</li>
      <li><b>Zonas Residenciais</b> trazem habitantes. Toque numa moradia para ver os <b>itens que ela pede</b>; entregue-os para melhorar o estágio (7 estágios, cada um com uma maquete diferente).</li>
      <li><b>Fábricas</b> produzem matérias-primas (toque no item para pôr na fila; toque na bolha para coletar). <b>Lojas</b> transformam matérias-primas em produtos.</li>
      <li><b>Energia, água e reciclagem</b> têm capacidade: acompanhe as barrinhas no topo. <b>Segurança, saúde e educação</b> cobrem um raio. <b>Parques</b> dão felicidade.</li>
      <li>Ruas com muitas construções ficam <b>congestionadas</b> (selo vermelho): suba o nível da rua em Ruas → Subir nível, ou construa uma Estação Transit.</li>
      <li>Os <b>impostos</b> acumulam na Sede: toque na moeda para coletar. Venda itens no <b>Depósito comercial</b> (Armazém) e compre no <b>Mercado Global</b>.</li>
      <li>O <b>Terminal de Cargas</b> traz encomendas: complete-as para ganhar <b>chaves</b> (parques e marcos) e <b>peças de expansão</b> (terreno e armazém).</li>
      <li><b>Cristais</b> compram itens que faltam ou aceleram filas. Você ganha cristais subindo de nível e cumprindo metas.</li>
      <li>O jogo continua rendendo enquanto você está fora (até 10 horas). Dois dedos movem e aproximam o mapa.</li></ol>`);
    body.append(help);
    const rs = el('div', 'box', `<h3>Recomeçar do zero</h3><p>Apaga a cidade atual neste aparelho e na nuvem.</p><div class="row"><button class="btn sm danger" data-reset>Recomeçar cidade</button></div>`);
    let armed = 0; const rb = rs.querySelector('[data-reset]');
    rb.onclick = () => {
      if (!armed) { armed = setTimeout(() => { armed = 0; rb.classList.remove('armed'); rb.textContent = 'Recomeçar cidade'; }, 3500); rb.classList.add('armed'); rb.textContent = 'Toque de novo para apagar tudo'; return; }
      clearTimeout(armed); newGame(); const sd = D.sede; cam.x = (sd.x + 2.5) * TW; cam.y = (sd.y + 3) * TH; saveLocal(); cloudSave(); closeSheet(); toast('Nova cidade criada.', 'good');
    };
    body.append(rs);
    const refresh = () => {
      const rows = [['População', fmt(D.pop)], ['Impostos', '§' + fmtR(D.taxH) + '/h'], ['Felicidade', Math.round(D.joy * 100) + '%'],
        ['Nível', S.level + (S.level < MAXL ? ` · ${fmt(S.xp - NEED[S.level])}/${fmt(NEED[S.level + 1] - NEED[S.level])} XP` : '')],
        ['Construções', S.bld.length], ['Ruas congestionadas', D.jams], ['Terreno', LAND[S.land] + '×' + LAND[S.land]], ['Peças de expansão', S.pecas], ['Total arrecadado', '§' + fmt(S.stats.earned)], ['Tempo de jogo', dur(S.played)]];
      kv.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
      for (const bx of body.querySelectorAll('.box')) if (bx._upd) bx._upd();
      const ago = s => s < 5 ? 'agora mesmo' : 'há ' + dur(s);
      sv.querySelector('[data-sv]').textContent = cloud.ref
        ? `Na sua conta: ${cloud.last ? ago((Date.now() - cloud.last) / 1000) : 'aguardando o primeiro envio'}. Neste aparelho: ${ago((Date.now() - (lastLocal || Date.now())) / 1000)}.`
        : `Neste aparelho: ${lastLocal ? ago((Date.now() - lastLocal) / 1000) : 'ainda não'}.`;
    };
    refresh(); return refresh;
  });
}

/* ---------------- botões ---------------- */
$('#bBuild').addEventListener('click', () => { if (buildOpen) closeBuildMenu(); else openBuildMenu(); });
$('#bRoads').addEventListener('click', startRoads);
document.querySelectorAll('#side [data-act]').forEach(b => b.addEventListener('click', () => {
  const a = b.dataset.act;
  if (sheetKind === a) { closeSheet(); return; }
  if (a === 'store') openStore(); else if (a === 'goals') openGoals(); else if (a === 'market') openMarket(); else if (a === 'cargo') openCargo(); else if (a === 'tax') { collectTax(); }
}));
$('#goal').addEventListener('click', openGoals);
$('#lvl').addEventListener('click', openCity);
$('#hCity').addEventListener('click', openCity);
$('#hStoreBtn').addEventListener('click', openStore);
$('#pCancel').addEventListener('click', endPlace);
$('#pOk').addEventListener('click', confirmPlace);
$('#rDraw').addEventListener('click', () => { roadTool = 'draw'; syncRoadTool(); });
$('#rUp').addEventListener('click', () => { roadTool = 'up'; syncRoadTool(); });
$('#rErase').addEventListener('click', () => { roadTool = 'erase'; syncRoadTool(); });
$('#rDone').addEventListener('click', endRoads);
