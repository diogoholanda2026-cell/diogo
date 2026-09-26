// Configurações (modal largo com cartões de opção em duas colunas, sem rolar em 986x443, com o ciclo de dia e
// noite), modo Apreciar (X fixo, placa de legenda viva, barra de vidro com Mais, seis enquadramentos, Comparar com
// cabo e noite forçada, rótulos, planta, hora do dia, passeio de câmera, fotografar em cartão com a referência), rótulos presos ao mundo como legendas de maquete (no
// máximo 6, sem cruzar o HUD nem uns aos outros; fora do Apreciar só o da obra em foco) e as ligações da economia
// nova que o Controle não conhece: toque no calendário (abre Finanças) e na pílula de moradores (popover da renda),
// ícone voando ao Almoxarifado na coleta automática, redesenho do painel nos eventos novos, aviso do ano novo e o
// modal da etapa aprovada com a recompensa (150% do custo) e os aceleradores ganhos.
import { el, fmt, clamp } from '../core/util.js';
import { img } from './icones.js';
import { ROTULOS } from '../data/rotulos.js';
import { QUALITY } from '../render/engine.js';
import { REGRAS } from '../sim/estado.js';
import { LOTES } from '../render/models/canteiro.js';
import { A, VISTA_FOTO } from '../data/planta.js';
import { PROJ } from '../data/obras.js';
import { rendaHoraDe } from './hud.js';
import { exportar, importar, apagar, persistir, gravar, gravarImportado, gravarConfig } from '../core/salvar.js';

const CORES_CONFETE = ['#ff5a5a', '#ffcf2e', '#5cc234', '#2c9cf2', '#ff8ad0', '#ff9f1a'];
const confete = () => Array.from({ length: 16 }, (_, i) => `<i style="--x:${((i * 37 + 5) % 97) + 1}%;--c:${CORES_CONFETE[i % 6]};--d:${(2.1 + (i % 5) * 0.34).toFixed(2)}s;--t:${((i % 8) * 0.17).toFixed(2)}s;--dx:${((i % 7) - 3) * 16}px"></i>`).join('');
const numEx = (n) => Math.round(n || 0).toLocaleString('pt-BR');

// hora do dia no Apreciar: Automático segue o ciclo das configurações; as outras fixam a hora (env.setHora pausa o
// ciclo e env.setCiclo o retoma). Sair do Apreciar volta ao automático.
const HORAS = [{ t: 'Automático', ic: 'ciclo' }, { t: 'Manhã', h: 7, ic: 'manha' }, { t: 'Meio-dia', h: 12, ic: 'sol' }, { t: 'Pôr do sol', h: 18, ic: 'por' }, { t: 'Noite', h: 22, ic: 'lua' }];
// enquadramentos prontos do Apreciar: o centro de cada conjunto na planta, uma distância fixa, o nome (placa e cartão da
// foto), a obra (recorte da foto de referência) e os rótulos que ficam acesos por 3 s depois do voo
const centroDe = (a) => (a?.c ? a.c : a?.poly ? a.poly.reduce((s, [x, z]) => [s[0] + x / a.poly.length, s[1] + z / a.poly.length], [0, 0]) : [0, 0]);
const ENQ = [['sede', 'Sede da Holding', 24, 'sede', ['sede']], ['ciencias', 'Faculdade de Ciências', 22, 'ciencias', ['ciencias']], ['biblio', 'Biblioteca Central', 17, 'biblioteca', ['biblioteca']], ['bioma', 'Bioma Aquático', 16, 'bioma', ['bioma']], ['praca', 'Praça Central', 21, 'praca', []], ['anel', 'Anel do Campus', 31, 'escola', ['escola', 'humanidades', 'instituto', 'engenharia']]]
  .map(([id, nome, dist, obra, rot]) => { const [x, z] = centroDe(A[id]); return { id, nome, dist, obra, rot, x, z }; });
// glifos monocromáticos da barra do Apreciar (traço na cor do texto)
const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const G = {
  foto: svg('<path d="M4 8.5h3.2L9 6h6l1.8 2.5H20v10.5H4z"/><circle cx="12" cy="13.5" r="3.6"/>'),
  comparar: svg('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M5.5 5H12v14H5.5A2.5 2.5 0 0 1 3 16.5v-9A2.5 2.5 0 0 1 5.5 5z" fill="currentColor" opacity=".35" stroke="none"/><path d="M12 3v18"/>'),
  mais: svg('<circle cx="5.5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.7" fill="currentColor" stroke="none"/>'),
  geral: svg('<path d="M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2z"/><path d="M9 4.5v13M15 6.5v13"/>'),
  enq: svg('<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/><circle cx="12" cy="12" r="2.6"/>'),
  rotulos: svg('<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3-8.7 8.7z"/><circle cx="8" cy="8" r="1.6"/>'),
  planta: svg('<path d="M12 3.5 3 8.5l9 5 9-5z"/><path d="m3 12.5 9 5 9-5M3 16.5l9 5 9-5" opacity=".7"/>'),
  cabo: svg('<path d="m9 7-5 5 5 5M15 7l5 5-5 5"/>'),
};
const CICLOS = [['acelerado', 'Acelerado'], ['relogio', 'Hora do celular'], ['dia', 'Sempre dia']];
export function instalarExtras(C, o) {
  const { engine, env, rig, cfg, fotoURL, versao } = o;
  // ---------------- rótulos: legendas de maquete ----------------
  // Texto curto com linha-guia até o pé projetado. No Apreciar: no máximo 6 visíveis, os mais perto do centro da tela
  // primeiro; um rótulo some quando a caixa cruza um retângulo do HUD (hud.retangulos, como o _sob dos balões), a folha ou
  // outro rótulo já colocado. Fora do Apreciar só aparece o rótulo da obra em foco (folha de etapa ou módulo aberta), com
  // o estado EM OBRA e o capacete quando a etapa está em obra. Sem alocação por quadro: arrays fixos.
  const camadaR = el('div', 'passa rotulos'); camadaR.style.cssText = 'position:absolute;inset:0;overflow:hidden'; C.ui.insertBefore(camadaR, C.ui.firstChild);
  const rot = ROTULOS.map((r) => { const d = el('div', 'rotulo3d', `<span>${r.curto || r.txt}</span><small>${img('grua')}EM OBRA</small><i></i>`); camadaR.appendChild(d); return { ...r, el: d, tx: '', vis: null, w: 0, h: 0, sx: 0, sy: 0, d2: 0, obraOn: false }; });
  const v = new (engine.camera.position.constructor)();
  const MAX_ROT = 6, GUIA = 18; const ordem = new Array(rot.length); const caixas = new Float32Array(MAX_ROT * 4); let nCaixas = 0; let tFolha = -1e9; const rFixos = new Float32Array(20); let nFixos = 0;
  const cruza = (x0, y0, x1, y1, R, n) => { for (let i = 0; i < n; i += 4) if (x0 < R[i + 2] && x1 > R[i] && y0 < R[i + 3] && y1 > R[i + 1]) return true; return false; };
  const verRot = (r, on) => { if (r.vis !== on) { r.vis = on; r.el.style.display = on ? '' : 'none'; } };
  C.atualizarRotulos = () => {
    if (C.modoApreciar) atualizarPlaca();
    const ap = C.modoApreciar && cfg.rotulos !== false; const at = C.paineis.atual; const foco = !ap && at && (at.tipo === 'etapa' || at.tipo === 'modulo') ? (at.tipo === 'etapa' ? at.arg.split('.')[0] : at.arg[0]) : null;
    const on = ap || !!foco; if (camadaR._on !== on) { camadaR._on = on; camadaR.style.display = on ? '' : 'none'; } if (!on) return;
    const t = performance.now(); const R = C.hud.retangulos(t); const W = engine.vw, H = engine.vh; let n = 0; const so = ap && C._enq && t < C._enqAte ? C._enq.rot : null;
    // folha, fala do conselheiro, barra, placa e X do Apreciar (fora de hud.retangulos, que só cobre o HUD visível): relidos a cada 0,5 s
    if (t - tFolha > 500) { tFolha = t; nFixos = 0; for (const e of [C.paineis.el, C.hud.fala, barra && !barra.classList.contains('oculta') ? barra : null, placa, xis]) { if (!e || e.classList.contains('oculto')) continue; const b = e.getBoundingClientRect(); if (!b.width) continue; rFixos[nFixos] = b.left; rFixos[nFixos + 1] = b.top; rFixos[nFixos + 2] = b.right; rFixos[nFixos + 3] = b.bottom; nFixos += 4; } }
    for (const r of rot) {
      // depois de um enquadramento, por 3 s, só os rótulos daquela estrutura
      const quer = ap ? !!(!r.se || C.J.feita(r.se)) && (!so || so.includes(r.obra)) : r.obra === foco; if (!quer) { verRot(r, false); continue; }
      v.set(...r.pos).project(engine.camera); if (v.z > 1) { verRot(r, false); continue; }
      r.sx = (v.x * 0.5 + 0.5) * W; r.sy = (-v.y * 0.5 + 0.5) * H; r.d2 = (r.sx - W / 2) ** 2 + (r.sy - H / 2) ** 2; ordem[n++] = r;
      if (!r.w || r.el.style.display === 'none') { if (r.el.style.display === 'none') r.el.style.display = ''; r.w = r.el.offsetWidth || 120; r.h = r.el.offsetHeight || 24; }
      // estado EM OBRA da obra em foco (a etapa em obra da folha aberta)
      const obra = !!foco && at.tipo === 'etapa' && C.J.etapa(at.arg).estado === 'obra'; if (obra !== r.obraOn) { r.obraOn = obra; r.el.classList.toggle('obra', obra); r.w = 0; }
    }
    if (n > 1) { const O = ordem; for (let i = 1; i < n; i++) { const x = O[i]; let j = i - 1; while (j >= 0 && O[j].d2 > x.d2) { O[j + 1] = O[j]; j--; } O[j + 1] = x; } }
    nCaixas = 0; let vis = 0;
    for (let i = 0; i < n; i++) {
      const r = ordem[i]; if (!r.w) { r.w = r.el.offsetWidth || 120; r.h = r.el.offsetHeight || 24; }
      const x0 = r.sx - r.w / 2, y1 = r.sy - GUIA, y0 = y1 - r.h, x1 = r.sx + r.w / 2;
      const sob = vis >= MAX_ROT || x0 < 0 || x1 > W || y0 < 0 || cruza(x0, y0, x1, y1, R, R.length) || cruza(x0, y0, x1, y1, rFixos, nFixos) || cruza(x0, y0, x1, y1, caixas, nCaixas);
      if (sob) { verRot(r, false); continue; }
      verRot(r, true); caixas[nCaixas] = x0; caixas[nCaixas + 1] = y0; caixas[nCaixas + 2] = x1; caixas[nCaixas + 3] = y1; nCaixas += 4; vis++;
      const tx = `translate(${r.sx.toFixed(0)}px,${y1.toFixed(0)}px) translate(-50%,-100%)`; if (tx !== r.tx) { r.tx = tx; r.el.style.transform = tx; }
    }
    for (let i = n; i < ordem.length; i++) ordem[i] = null;
  };
  // ---------------- apreciar ----------------
  // X fixo no canto (sai do modo) e placa de legenda viva no canto de baixo à esquerda: os dois ficam quando a barra some.
  // Barra de vidro com Fotografar (latão), Comparar e Mais; a linha Mais traz Vista geral, Enquadrar (seis estruturas),
  // Rótulos, Planta e a hora do dia em segmento. Comparar: o toque alterna a divisão com o cabo arrastável (obra à
  // esquerda, referência à direita); segurar mostra a referência inteira enquanto o dedo fica. Nos dois a câmera vai à
  // vista da foto, o passeio para e a hora vai para a noite (a foto é noturna); ao sair, volta a hora escolhida.
  const foto = el('div', ''); foto.id = 'foto-ref'; foto.style.backgroundImage = `url(${fotoURL})`; C.ui.appendChild(foto);
  let barra = null, xis = null, placa = null, cabo = null, etiq = null, tBarra = 0, hora = 0, comp = false, espia = false, tEspia = 0, semClique = false, xCabo = 0, iEnq = -1, tPlaca = 0, txPlaca = '';
  const automatico = () => { hora = 0; env.setCiclo?.(cfg.ciclo || 'acelerado'); };
  const voltarHora = () => { const H = HORAS[hora]; if (H.h == null) automatico(); else env.setHora?.(H.h); engine.acordar?.(800); };
  // a barra some depois de 3,5 s sem toque e volta com um toque na cidade ou com a câmera andando
  const mostrar = () => { if (!barra) return; barra.classList.remove('oculta'); clearTimeout(tBarra); tBarra = setTimeout(() => barra?.classList.add('oculta'), 3500); };
  C.aoToqueApreciar = mostrar;
  const rigMove0 = rig.onMove; rig.onMove = (...a) => { rigMove0?.(...a); if (C.modoApreciar) mostrar(); };
  // estrutura em foco: a do último enquadramento enquanto a câmera está nela; senão o rótulo construído mais perto do alvo
  // da câmera (até 9 m), nada na vista geral. Devolve um objeto fixo ({nome, obra}): sem alocação.
  const NOMES = ROTULOS.map((r) => ({ obra: r.obra, se: r.se, x: r.pos[0], z: r.pos[2], nome: (r.curto || r.txt).replace(/\n/g, ' ') }));
  const noFoco = () => {
    const tg = rig.target; if (!tg || rig.dist > 48) return null; const E = C._enq;
    if (E && (tg.x - E.x) ** 2 + (tg.z - E.z) ** 2 < 9) return E;
    let m = null, d0 = 81; for (const r of NOMES) { if (r.se && !C.J.feita(r.se)) continue; const d = (tg.x - r.x) ** 2 + (tg.z - r.z) ** 2; if (d < d0) { d0 = d; m = r; } }
    return m;
  };
  // placa de latão: composição concluída, capítulo e a estrutura em foco; relida a cada 0,4 s, escrita só quando muda
  const atualizarPlaca = () => {
    const t = performance.now(); if (!placa || t - tPlaca < 400) return; tPlaca = t;
    const f = noFoco(); const l1 = `Arcologia de Held · ${Math.round(C.J.vida())}%`, l2 = `Capítulo ${C.J.S.cap}${f ? ' · ' + f.nome : ''}`;
    if (l1 + l2 === txPlaca) return; txPlaca = l1 + l2; placa.firstChild.textContent = l1; placa.lastChild.textContent = l2;
  };
  const estado = () => {
    if (!barra) return; const q = (x) => barra.querySelector(`[data-x="${x}"]`);
    const liga = (b, on) => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); };
    liga(q('rotulos'), cfg.rotulos !== false); liga(q('planta'), !!C._planta); liga(q('comparar'), comp);
    for (const b of barra.querySelectorAll('[data-x="hora"]')) liga(b, +b.dataset.i === hora);
    const m = barra.classList.contains('mais-on'); const bm = q('mais'); bm.classList.toggle('on', m); bm.setAttribute('aria-expanded', m ? 'true' : 'false');
  };
  // ---- Comparar ----
  const larg = () => engine.vw || innerWidth;
  const moverCabo = (x) => { xCabo = clamp(Math.round(x), 0, larg()); cabo.style.transform = `translateX(${xCabo}px)`; foto.style.clipPath = `inset(0 0 0 ${xCabo}px)`; cabo.setAttribute('aria-valuenow', Math.round((xCabo / larg()) * 100)); };
  const verFoto = (on) => { if (on) { C._enq = null; C.vistaFoto?.(true); rig.passeio?.(false); env.setHora?.(22); engine.acordar?.(1800); } else { voltarHora(); if (C.modoApreciar) rig.passeio?.(true); } };
  const comparar = (on) => {
    if (!barra || comp === on) return; comp = on; cabo.classList.toggle('oculto', !on); etiq.classList.toggle('oculto', !on);
    if (on) { moverCabo(larg() / 2); foto.style.opacity = 1; } else { foto.style.opacity = 0; foto.style.clipPath = ''; }
    if (!espia) verFoto(on); estado();
  };
  C.comparar = comparar;
  const espiar = (on) => {
    if (espia === on) return; espia = on;
    if (on) { foto.style.clipPath = ''; foto.style.opacity = 1; if (!comp) verFoto(true); C.vibra.tique(); }
    else if (comp) moverCabo(xCabo); else { foto.style.opacity = 0; verFoto(false); }
  };
  // ---- Enquadrar: as seis estruturas, uma por toque ----
  const enquadrar = () => {
    if (comp) comparar(false); iEnq = (iEnq + 1) % ENQ.length; const E = ENQ[iEnq];
    rig.pitchFix = null; C._naFoto = false; rig.flyTo({ x: E.x, z: E.z, dist: E.dist, yaw: VISTA_FOTO.yaw, tilt: 0, roll: 0 }, 1200, { cine: true });
    C._enq = E; C._enqAte = performance.now() + 3000; tPlaca = 0; engine.acordar?.(1500);
  };
  const sair = () => { clearTimeout(tBarra); clearTimeout(tEspia); for (const e of [barra, xis, placa, cabo, etiq]) e?.remove(); barra = xis = placa = cabo = etiq = null; foto.style.opacity = 0; foto.style.clipPath = ''; };
  C.apreciar = (on) => {
    C.modoApreciar = on; C.hud.visivel(!on); C.bolhas.visivel = !on; C.paineis.fechar(true); rig.passeio?.(on); C.som.ambiente?.(on); engine.acordar?.(on ? 1500 : 500);
    const forcada = comp || espia; sair(); comp = espia = false; C._enq = null; C.ui.classList.toggle('apreciando', on);
    if (forcada && on) voltarHora();
    if (!on) { rig.roll = 0; rig.pitchFix = null; if (C._planta) { C._planta = false; C.mundo.mostrarFantasma(false); } if (hora || forcada) automatico(); return; }
    xis = el('button', 'x apreciar-x'); xis.dataset.x = 'sair'; xis.setAttribute('aria-label', 'Sair do Apreciar'); C.ui.appendChild(xis);
    placa = el('div', 'placa-viva', '<b></b><span></span>'); placa.setAttribute('role', 'status'); C.ui.appendChild(placa); txPlaca = ''; tPlaca = 0; atualizarPlaca();
    etiq = el('div', 'comp-rot oculto', '<span class="obra">Obra</span><span class="ref">Referência</span>'); C.ui.appendChild(etiq);
    cabo = el('div', 'cabo oculto', `<i></i><b>${G.cabo}</b>`); cabo.dataset.x = 'cabo'; cabo.tabIndex = 0; for (const [k, v] of [['role', 'slider'], ['aria-label', 'Divisão entre a obra e a referência'], ['aria-valuemin', '0'], ['aria-valuemax', '100']]) cabo.setAttribute(k, v); C.ui.appendChild(cabo);
    const bt = (x, g, t, cls = '') => `<button class="ap-bt ${cls}" data-x="${x}">${g}<span>${t}</span></button>`;
    barra = el('div', 'apreciar', `<div class="linha2">${bt('geral', G.geral, 'Vista geral')}${bt('enq', G.enq, 'Enquadrar')}${bt('rotulos', G.rotulos, 'Rótulos', 'alterna')}${bt('planta', G.planta, 'Planta', 'alterna')}<div class="seg horas" role="group" aria-label="Hora do dia">${HORAS.map((H, i) => `<button data-x="hora" data-i="${i}" aria-label="${H.t}" title="${H.t}">${img(H.ic)}</button>`).join('')}</div></div><div class="linha1">${bt('fotografar', G.foto, 'Fotografar', 'latao')}${bt('comparar', G.comparar, 'Comparar')}${bt('mais', G.mais, 'Mais')}</div>`);
    C.ui.appendChild(barra); estado(); mostrar();
    barra.addEventListener('pointerdown', mostrar);
    const clique = (e) => { const b = e.target.closest('[data-x]'); if (!b) return; const x = b.dataset.x; if (x === 'cabo') return;
      if (x === 'comparar' && semClique) { semClique = false; return; } C.som.toque();
      if (x === 'sair') { C.apreciar(false); return; }
      if (x === 'geral') { if (comp) comparar(false); C._enq = null; if (C.vistaGeral) C.vistaGeral(true); else C.vistaFoto?.(true); }
      else if (x === 'enq') enquadrar(); else if (x === 'comparar') comparar(!comp); else if (x === 'mais') barra.classList.toggle('mais-on');
      else if (x === 'rotulos') { cfg.rotulos = cfg.rotulos === false; gravarConfig(cfg); }
      else if (x === 'hora') { hora = +b.dataset.i; if (!comp && !espia) voltarHora(); }
      else if (x === 'planta') { C._planta = !C._planta; C.mundo.mostrarFantasma(C._planta); engine.acordar?.(1200); } else if (x === 'fotografar') fotografar();
      estado(); mostrar(); };
    barra.addEventListener('click', clique); xis.addEventListener('click', clique);
    // segurar Comparar: a referência inteira enquanto o dedo fica (o clique que vem depois não alterna a divisão)
    const bc = barra.querySelector('[data-x="comparar"]'); const solta = () => { clearTimeout(tEspia); if (espia) espiar(false); };
    bc.addEventListener('pointerdown', () => { semClique = false; clearTimeout(tEspia); tEspia = setTimeout(() => { semClique = true; espiar(true); }, 380); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) bc.addEventListener(ev, solta);
    bc.addEventListener('contextmenu', (e) => e.preventDefault());
    // cabo: arrasta com o dedo (captura do ponteiro); o corte da foto só muda no pointermove, sem quadro extra
    cabo.addEventListener('pointerdown', (e) => { cabo.setPointerCapture?.(e.pointerId); moverCabo(e.clientX); mostrar(); });
    cabo.addEventListener('pointermove', (e) => { if (cabo.hasPointerCapture?.(e.pointerId)) moverCabo(e.clientX); });
    cabo.addEventListener('keydown', (e) => { const d = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0; if (d) { moverCabo(xCabo + d * larg() * 0.05); e.preventDefault(); } });
  };
  // ---------------- fotografar: cartão 1200x630 com a obra e a referência lado a lado ----------------
  // Canvas 2D separado: à esquerda o quadro do jogo (desenhado agora e copiado na mesma tarefa, porque o buffer do WebGL
  // não é preservado), à direita o recorte da foto de referência da estrutura em foco (PROJETOS.foto, em px da foto de
  // 1376x768, levado à proporção do quadro) e embaixo a legenda em placa de latão. Salva como antes (compartilhar ou baixar).
  let fotoP = null;
  const carregarFoto = () => fotoP || (fotoP = new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => { fotoP = null; ok(null); }; im.src = fotoURL; }));
  const recorte = (obra, ar, FW, FH) => {
    const k = FW / 1376, f = PROJ[obra]?.foto; let [x, y, w, h] = f ? f.map((v) => v * k) : [0, 0, FW, FH]; const cx = x + w / 2, cy = y + h / 2;
    if (f) { w *= 1.25; h *= 1.25; } if (w / h < ar) w = h * ar; else h = w / ar; if (w > FW) { w = FW; h = w / ar; } if (h > FH) { h = FH; w = h * ar; }
    return [clamp(cx - w / 2, 0, FW - w), clamp(cy - h / 2, 0, FH - h), w, h];
  };
  const FONTE = '"Baloo 2", system-ui, sans-serif';
  C.cartaoFoto = async () => {
    const ref = await carregarFoto(); try { await document.fonts?.load?.(`800 36px ${FONTE}`); } catch (_) {}
    const f = C.modoApreciar ? noFoco() : null; const W = 1200, H = 630, QW = 555, QH = 430, Y = 30, ar = QW / QH;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    c.fillStyle = '#fbf8f1'; c.fillRect(0, 0, W, H); c.fillStyle = '#6b4a2e'; c.fillRect(0, H - 6, W, 6);
    const quadro = (x, rot, pinta) => {
      c.save(); c.beginPath(); c.roundRect(x, Y, QW, QH, 14); c.fillStyle = '#16264a'; c.fill(); c.clip(); pinta(x); c.restore();
      c.strokeStyle = 'rgba(20,40,70,.16)'; c.lineWidth = 2; c.beginPath(); c.roundRect(x, Y, QW, QH, 14); c.stroke();
      c.font = `800 16px ${FONTE}`; if ('letterSpacing' in c) c.letterSpacing = '2px'; const tw = c.measureText(rot).width;
      c.fillStyle = 'rgba(22,38,74,.82)'; c.beginPath(); c.roundRect(x + 14, Y + 14, tw + 26, 32, 16); c.fill(); c.fillStyle = '#fff'; c.fillText(rot, x + 27, Y + 36); if ('letterSpacing' in c) c.letterSpacing = '0px';
    };
    const gl = engine.renderer.domElement; try { engine.render(performance.now()); } catch (_) {}
    quadro(30, 'OBRA', (x) => { const gw = gl.width || 1, gh = gl.height || 1; let sw = gw, sh = gw / ar; if (sh > gh) { sh = gh; sw = gh * ar; } c.drawImage(gl, (gw - sw) / 2, (gh - sh) / 2, sw, sh, x, Y, QW, QH); });
    quadro(W - 30 - QW, 'REFERÊNCIA', (x) => { if (!ref) return; const [sx, sy, sw, sh] = recorte(f?.obra, ar, ref.naturalWidth, ref.naturalHeight); c.drawImage(ref, sx, sy, sw, sh, x, Y, QW, QH); });
    // legenda: placa de latão com parafusos, o nome da estrutura e a linha da composição
    const py = Y + QH + 20, ph = H - 6 - 20 - py; const g = c.createLinearGradient(0, py, 0, py + ph); g.addColorStop(0, '#f3dc98'); g.addColorStop(0.5, '#d9b765'); g.addColorStop(1, '#b08a38');
    c.fillStyle = g; c.beginPath(); c.roundRect(30, py, W - 60, ph, 12); c.fill(); c.strokeStyle = 'rgba(120,88,24,.7)'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = 'rgba(255,248,220,.6)'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(36, py + 6, W - 72, ph - 12, 8); c.stroke();
    for (const [x, y] of [[48, py + 18], [W - 48, py + 18], [48, py + ph - 18], [W - 48, py + ph - 18]]) { const r = c.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, 6); r.addColorStop(0, '#fff6d8'); r.addColorStop(1, '#8a6a24'); c.fillStyle = r; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); }
    const nome = f ? f.nome : 'Arcologia de Held', sub = `${f ? 'Arcologia de Held · ' : ''}Capítulo ${C.J.S.cap} · ${Math.round(C.J.vida())}% da composição`;
    c.fillStyle = '#3d2a08'; c.font = `800 38px ${FONTE}`; c.fillText(nome, 72, py + ph / 2 + 2);
    c.fillStyle = '#5a4214'; c.font = `700 19px ${FONTE}`; if ('letterSpacing' in c) c.letterSpacing = '1.5px'; c.fillText(sub.toUpperCase(), 72, py + ph / 2 + 30);
    const data = new Date().toLocaleDateString('pt-BR'); c.textAlign = 'right'; c.fillText(data, W - 72, py + ph / 2 + 30); c.textAlign = 'left'; if ('letterSpacing' in c) c.letterSpacing = '0px';
    cv._nome = nome; return cv;
  };
  const fotografar = async () => {
    let cv = null; try { cv = await C.cartaoFoto(); } catch (e) { console.error(e); }
    if (!cv) { C.hud.brinde('Não foi possível fotografar'); return; }
    cv.toBlob((b) => {
      if (!b) { C.hud.brinde('Não foi possível fotografar'); return; } const nome = `arcologia-de-held-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`;
      const f = typeof File !== 'undefined' ? new File([b], nome, { type: 'image/jpeg' }) : null; C.som.foto?.(); C.vibra.tique();
      if (f && navigator.canShare?.({ files: [f] })) { navigator.share({ files: [f], title: 'Arcologia de Held' }).catch(() => {}); C.hud.brinde(`Foto: ${cv._nome}`, 'foto'); }
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); C.hud.brinde(`Foto salva: ${cv._nome}`, 'foto'); }
      C.ultimaFoto = { w: cv.width, h: cv.height, bytes: b.size, tipo: b.type, nome: cv._nome };
    }, 'image/jpeg', 0.9);
  };
  C.fotografar = fotografar;
  // ---------------- configurações ----------------
  C.config = () => {
    const seg = (nome, ops, atual) => `<div class="seg" data-cfg="${nome}">${ops.map(([v, t]) => `<button data-v="${v}" class="${String(atual) === String(v) ? 'on' : ''}" aria-pressed="${String(atual) === String(v)}">${t}</button>`).join('')}</div>`;
    const op = (rotulo, controle) => `<div class="op"><label>${rotulo}</label>${controle}</div>`;
    const sec = (t) => `<h3 class="cfg-sec">${t}</h3>`;
    // seções: Vídeo, Som e toque, Jogo, Salvamento, Acessibilidade; Recomeçar isolado no fim
    const html = `<header class="mh"><div class="tt"><h1>Configurações</h1></div><div class="linha">${o.instalar ? `<button class="botao ouro" data-y="instalar">Instalar como app</button>` : ''}<small class="versao">${engine.gpu ? 'GPU: ' + engine.gpu + '<br>' : ''}versão ${versao}</small><button class="x" data-fecha aria-label="Fechar"></button></div></header><div class="mc"><div class="cfg">
      ${sec('Vídeo')}
      ${op('Qualidade gráfica<small>Automática ajusta a resolução</small>', seg('qualidade', [['auto', 'Auto'], ...Object.values(QUALITY).map((q) => [q.id, q.label])], cfg.qualidade || 'auto'))}
      ${op('Quadros por segundo<small>120 exige Chrome 156+</small>', seg('fps', [[30, '30'], [60, '60'], [120, '120']], cfg.fps || 60))}
      ${op('Tela cheia', `<button class="botao sec" data-y="tela">${img('tela')} Alternar</button>`)}
      ${sec('Som e toque')}
      ${op('Efeitos sonoros', seg('efeitos', [[1, 'Sim'], [0, 'Não']], cfg.efeitos === false ? 0 : 1))}
      ${op('Música ambiente', seg('musica', [[1, 'Sim'], [0, 'Não']], cfg.musica === false ? 0 : 1))}
      ${op('Vibração', seg('vibra', [[1, 'Sim'], [0, 'Não']], cfg.vibra === false ? 0 : 1))}
      ${sec('Jogo')}
      ${op('Ciclo de dia e noite<small>Acelerado: 1 min = 1 h</small>', seg('ciclo', CICLOS, cfg.ciclo || 'acelerado'))}
      ${op('Ritmo da obra<small>Acelera cronômetros: modo de teste</small>', seg('ritmo', [[1, '1×'], [2, '2×'], [4, '4×']], C.S.ritmo || 1))}
      ${sec('Salvamento')}
      ${op('Salvamento<small id="persist">Verificando…</small>', '<div class="linha"><button class="botao sec" data-y="exportar">Exportar</button><button class="botao sec" data-y="importar">Importar</button></div>')}
      ${sec('Acessibilidade')}
      ${op('Tamanho da interface<small>Grande aumenta textos e botões</small>', seg('escala', [['normal', 'Normal'], ['grande', 'Grande']], cfg.escala || 'normal'))}
      ${op('Reduzir movimento<small>Sem animações ociosas</small>', seg('menosMov', [[0, 'Não'], [1, 'Sim']], cfg.menosMov ? 1 : 0))}
      ${op('Alto contraste<small>Contornos e fios mais fortes</small>', seg('contraste', [[0, 'Não'], [1, 'Sim']], cfg.contraste ? 1 : 0))}
      ${sec('Recomeçar')}
      ${op('Recomeçar do zero<small>Apaga o progresso deste aparelho</small>', '<button class="botao perigo" data-y="reset">Recomeçar</button>')}
      </div></div>`;
    C.modal(html, (m, fechar) => {
      persistir().then((ok) => { const s = m.querySelector('#persist'); if (s) s.textContent = ok ? 'Protegido: o Chrome não apaga o jogo' : 'Comum: instale o app para proteger'; });
      let tReset = 0;
      m.addEventListener('click', async (e) => {
        const sb = e.target.closest('.seg button'); if (sb) { const nome = sb.parentElement.dataset.cfg, val = sb.dataset.v; C.som.toque();
          if (nome === 'qualidade') { cfg.qualidade = val; engine.setQuality(val === 'auto' ? o.qualidadeAuto : val); }
          else if (nome === 'fps') { cfg.fps = +val; engine.fpsCap = +val; }
          else if (nome === 'ritmo') { C.S.ritmo = +val; C.hud.brinde('Ritmo ' + val + '× para as próximas produções e obras'); }
          else if (nome === 'ciclo') { cfg.ciclo = val; delete cfg.luz; env.setCiclo?.(val); engine.acordar?.(800); } // (a luz antiga de exposição não vale mais)
          else if (nome === 'efeitos') { cfg.efeitos = val === '1'; C.som.setEfeitos(cfg.efeitos); }
          else if (nome === 'musica') { cfg.musica = val === '1'; C.som.setMusica(cfg.musica); }
          else if (nome === 'vibra') { cfg.vibra = val === '1'; C.vibra.on = cfg.vibra; }
          else if (nome === 'escala') { cfg.escala = val; o.aplicarAcess?.(cfg); }
          else if (nome === 'menosMov') { cfg.menosMov = val === '1'; o.aplicarAcess?.(cfg); }
          else if (nome === 'contraste') { cfg.contraste = val === '1'; o.aplicarAcess?.(cfg); }
          gravarConfig(cfg); for (const b of sb.parentElement.children) { b.classList.toggle('on', b === sb); b.setAttribute('aria-pressed', b === sb ? 'true' : 'false'); } return; }
        const b = e.target.closest('[data-y]'); if (!b) return; const y = b.dataset.y; C.som.toque();
        if (y === 'tela') o.telaCheia(true); else if (y === 'exportar') { await gravar(C.S); exportar(C.S); }
        else if (y === 'importar') { try { const S = await importar(); await gravarImportado(S); location.reload(); } catch (err) { C.hud.brinde('Arquivo inválido'); } } // os avisos da migração aparecem num brinde depois de recarregar
        else if (y === 'reset') { // dois toques: o primeiro arma por 3 s
          if (!b.classList.contains('arm')) { b.classList.add('arm'); b.textContent = 'Toque de novo para apagar'; C.vibra.erro(); clearTimeout(tReset); tReset = setTimeout(() => { b.classList.remove('arm'); b.textContent = 'Recomeçar'; }, 3000); return; }
          clearTimeout(tReset); C.naoSalvar = true; await apagar(); location.reload(); }
        else if (y === 'instalar') { o.instalar?.(); fechar(); }
      });
    }, { cls: 'larga config' });
  };
  instalarEconomia(C);
}

// ---------------- economia nova: toques, eventos e o modal da etapa aprovada ----------------
function instalarEconomia(C) {
  const J = C.J; const abrirFinancas = () => { C.paineis.aba.escritorio = 'financas'; C.paineis.destaque = null; C.paineis.abrir('escritorio'); };
  // calendário: abre o Escritório na aba Finanças; pílula de moradores: popover da renda (faixa, tarifa, cofre, offline)
  C.hud.aoCalendario = () => { C.som.toque(); C.vibra.tique(); abrirFinancas(); };
  C.hud.aoPop = () => {
    C.som.toque(); const S = C.S; const ri = J.rendaInfo?.(); const rh = rendaHoraDe(J); const cofre = Math.floor(ri?.cofre ?? S.repasse.acum);
    const corpo = ri
      ? `<ul><li><b>${ri.tarifa}</b>por morador e por hora (bem-estar ${ri.faixa}%)</li><li><b>${fmt(cofre)}</b>no cofre, que guarda até ${ri.cofreH ?? REGRAS.cofreH} h</li></ul><small>Faixas: até 30% de bem-estar, 5 por morador; 31 a 60%, 8; 61 a 100%, 11. Com o jogo fechado, rende ${Math.round(ri.offlineFator * 100)}% por até ${ri.offlineH} h.</small>`
      : `<ul><li><b>${fmt(cofre)}</b>no cofre, que guarda até ${REGRAS.cofreH} h</li></ul><small>A Holding repassa créditos conforme os moradores e o bem-estar.</small>`;
    C.hud.info('[data-a="pop"]', `<h4>${fmt(J.pop)} moradores · +${fmt(rh)}/h</h4>${corpo}<button class="botao sec" data-i="escritorio">${img('repasse')} Abrir o Escritório</button>`, 7000, (id) => { if (id === 'escritorio') { C.som.toque(); abrirFinancas(); } });
  };
  // eventos da simulação nova
  const REDESENHA = new Set(['valuation', 'emprestimo', 'acelerou', 'pedidoFabricando', 'dia', 'ano']); let ultimaEtapa = null;
  J.on((tipo, d) => {
    if (REDESENHA.has(tipo)) C.paineis.agendar();
    if (tipo === 'coleta' && d.auto) { // lote entrou sozinho no Almoxarifado: o ícone voa do prédio até o botão
      const l = LOTES[d.predio || d.origem]; const [x, y] = C._pontoTela(null, l); const ponto = l ? [clamp(x, 40, innerWidth - 40), clamp(y, 80, innerHeight - 40)] : [innerWidth / 2, innerHeight * 0.45];
      if (!document.hidden) C.hud.voar(d.item, ponto[0], ponto[1], 'almox', (i) => { if (i === 0) C.som.coleta?.(); }, { n: d.n || 1 }); C.calcBolhas?.();
    }
    else if (tipo === 'ano') C.hud.brinde(`Ano ${d.ano} do jogo: o limite anual de empréstimo (${numEx(REGRAS.empAno ?? 50000)}) renovou`, 'calendario', 3600);
    else if (tipo === 'dia' && d.saltou > 1) C.hud.brinde(`${d.saltou} dias do jogo passaram enquanto você esteve fora`, 'calendario', 3000);
    // etapa aprovada: a simulação emite 'etapaFeita' e logo o 'aviso' com o valor da recompensa; o modal entra na
    // fila depois da festa da aprovação (2,6 s) e não repete para a mesma etapa
    else if (tipo === 'etapaFeita') ultimaEtapa = { key: d.key, p: d.p, e: d.e, t: performance.now() };
    else if (tipo === 'aviso' && ultimaEtapa && d.creditos > 0 && performance.now() - ultimaEtapa.t < 200) { const u = ultimaEtapa; ultimaEtapa = null; C._fila(() => modalAprovacao(C, u, d.creditos), 2900, 'aprov:' + u.key); }
  });
}
function modalAprovacao(C, u, creditos) {
  const A = C.S.aceleradores; const p = u.p, e = u.e; if (!p || !e) return;
  const premios = [`<div class="premio">${img('creditos')}<b>+${fmt(creditos)}</b><small>${A ? '150% do custo' : 'medição da etapa'}</small></div>`, ...(A ? [`<div class="premio">${img('acelerar')}<b>+1</b><small>acelerador de obra</small></div>`, `<div class="premio">${img('acelerar')}<b>+1</b><small>acelerador de produção</small></div>`] : [])].join('');
  C.modal(`<header class="mh"><div class="tt"><h3>Etapa aprovada</h3><h1>${p.nome}</h1></div></header><div class="mc"><div class="festa" aria-hidden="true">${confete()}</div><p><b>${e.nome}</b> passou na medição da Holding.</p><div class="premios">${premios}</div>${A ? `<p class="lib">Aceleradores: ${A.obra || 0} de obra · ${A.producao || 0} de produção · cada um adianta ${REGRAS.aceleraH ?? 1} h</p>` : ''}<button class="botao grande" data-fecha>Continuar</button></div>`, null, { cls: 'festivo aprov' });
}
