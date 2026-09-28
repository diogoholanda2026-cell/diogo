// Entrada à CS2 no mouse e melhor no polegar (D40, desenho do render 10.2, ui.md 9.1 e 15.3). O render é dono do
// árbitro de gestos; a interface pede o modo e recebe os eventos da ferramenta.
//
// Toque, modo câmera: um dedo arrasta com o ponto do chão preso sob ele (no céu da vista rasante, pela escala da
// tela) e, ao soltar, a vista desliza e para; dois dedos movem, aproximam em volta do meio e giram, ou, arrastados
// juntos na vertical, inclinam; toque curto seleciona (aoToque) e toque longo (450 ms) abre o menu de contexto.
// Toque, modo ferramenta: um dedo usa a ferramenta, com o ponto que conta 56 px acima do dedo (deslocY, de 0 a 72) para
// o dedo nunca esconder a mira; dois dedos movem, aproximam e giram a câmera, sem inclinar; perto da borda da área
// livre (bordaPx) durante o arrasto a câmera anda sozinha, com velocidade que cresce para dentro da faixa, e a
// ferramenta recebe o ponto novo a cada quadro.
// Árbitro: nos primeiros 80 ms (ou até o dedo andar 8 px) um dedo ainda não é gesto; se o segundo dedo chega nesse
// tempo, o gesto é de dois dedos e a ferramenta nem começa (a pinça não risca uma via). Com dois dedos, o modo
// (inclinar ou livre) se decide nos primeiros 80 ms depois de eles começarem a andar e não troca no meio; a pinça só
// entra depois de 12 px de mudança na distância e o giro depois de 6 graus, sem salto. Um segundo dedo que chega com a
// ferramenta em curso a cancela (fase 'fim' com cancelado: true) e vira câmera.
// Mouse: com ferramenta, o botão esquerdo usa a ferramenta e o cursor parado manda 'move' com dedos 0 (a prévia segue
// o cursor, como no CS2); botão do meio arrasta; direito (ou Ctrl) gira e inclina, e o clique direito curto abre o
// menu; a roda aproxima no cursor; borda da janela move a vista se ligada (bordaMouse). Teclado: WASD e setas movem,
// Q e E giram, R e F inclinam, + e - aproximam.
// Evento da ferramenta: { fase: 'inicio' | 'move' | 'fim', x, y, ponto, dedos, tipo: 'toque' | 'mouse' | 'caneta',
// dedoX, dedoY, cancelado? } (x, y é a mira em px CSS; ponto o chão sob ela, R.raio).

/** Limiares do árbitro (ui.md 9.1). */
export const GESTOS = Object.freeze({
  decidirMs: 80, toqueMs: 250, toquePx: 8, longoMs: 450, pincaPx: 12, giroGraus: 6, andarPx: 4, mousePx: 3,
});

/** Rolagem pela borda: velocidade máxima em px de tela por segundo, no fundo da faixa. */
export const BORDA = Object.freeze({ pxPorS: 900 });

const JANELA_VEL = 90; // ms de movimento usados para a velocidade de soltura
const TECLAS = { arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd' };
const RAD = Math.PI / 180;

export function criarEntrada(ctx, camera) {
  const canvas = ctx.canvas;
  const dedos = new Map();
  const st = { modo: 'camera', aoFerramenta: null, aoToque: [], opcoes: { deslocY: 56, bordaPx: 48, bordaMouse: false, area: null } };
  const teclas = new Set();
  let gesto = null;
  let pairar = null; // mouse parado sobre o canvas: { x, y, novo }
  const relogio = () => (typeof performance !== 'undefined' ? performance.now() : 0);
  const tempo = (ev) => (ev && Number.isFinite(ev.timeStamp) && ev.timeStamp > 0 ? ev.timeStamp : relogio());
  const ptr = (ev) => {
    const r = canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };
  const chao = (x, y) => ctx.raio(x, y);
  const tipoDe = (ev) => (ev.pointerType === 'touch' ? 'toque' : ev.pointerType === 'pen' ? 'caneta' : 'mouse');
  const telaH = () => ctx.tela?.h || canvas.clientHeight || 1;
  const telaW = () => ctx.tela?.w || canvas.clientWidth || 1;

  // ---------------------------------------------------------------------------------------------- ferramenta

  /** A mira: acima do dedo no toque (deslocY), no cursor no mouse e na caneta; nunca fora da tela. */
  const mira = (p, tipo) => ({ x: p.x, y: Math.max(0, p.y - (tipo === 'toque' ? st.opcoes.deslocY : 0)) });
  const ferramenta = (fase, p, n, tipo, extra = null) => {
    const m = mira(p, tipo);
    st.aoFerramenta?.({ fase, x: m.x, y: m.y, ponto: chao(m.x, m.y), dedos: n, tipo, dedoX: p.x, dedoY: p.y, ...(extra ?? {}) });
  };

  // ---------------------------------------------------------------------------------------------- câmera

  // amostras recentes do alvo para a velocidade de soltura
  const rastro = [];
  const marcar = (t) => {
    const e = camera.estado();
    rastro.push({ t, x: e.x, z: e.z, g: e.guinada, i: e.inclinacao });
    while (rastro.length > 2 && rastro[0].t < t - JANELA_VEL * 2) rastro.shift();
  };
  const soltar = (tipo, t) => {
    const n = rastro.length;
    if (n < 2) return;
    const a = rastro.find((r) => r.t >= rastro[n - 1].t - JANELA_VEL) ?? rastro[0];
    const b = rastro[n - 1];
    const dt = (b.t - a.t) / 1000;
    if (dt < 0.012 || t - b.t > 60) return; // parou antes de soltar
    if (tipo === 'arrastar') camera.impulso({ vx: (b.x - a.x) / dt, vz: (b.z - a.z) / dt });
    else camera.impulso({ vg: (b.g - a.g) / dt, vi: (b.i - a.i) / dt });
  };
  // arrasto: o ponto do chão fica sob o dedo; a câmera do three é posta em dia na hora (vários pointermove chegam
  // entre dois quadros, e o raio de cada um precisa sair da câmera já movida)
  const arrastarPara = (ancora, x, y, t) => {
    const p = ancora ? chao(x, y) : null;
    if (!p) return false;
    camera.mover(ancora[0] - p[0], ancora[2] - p[2]);
    camera.atualizar(t);
    marcar(t);
    return true;
  };
  /** Metros no chão por px de tela na distância do alvo (a vertical esticada pela inclinação). */
  const escala = () => {
    const e = camera.estado();
    const s = (2 * e.dist * Math.tan(((ctx.camera?.fov ?? 40) * RAD) / 2)) / telaH();
    return { s, k: s / Math.max(0.25, Math.sin(e.inclinacao * RAD)), g: e.guinada * RAD };
  };
  // o mundo anda dx, dy px de tela (arrasto no céu, rolagem pela borda): direita no chão (cos g, sin g), frente
  // (sin g, -cos g)
  const moverTela = (dx, dy, t) => {
    if (!dx && !dy) return;
    const { s, k, g } = escala();
    camera.mover(-dx * s * Math.cos(g) + dy * k * Math.sin(g), -dx * s * Math.sin(g) - dy * k * Math.cos(g));
    camera.atualizar(t);
    marcar(t);
  };

  // ---------------------------------------------------------------------------------------------- gestos

  function comecarArrasto(d, t, { desde = null } = {}) {
    const o = desde ?? d;
    gesto = { tipo: 'arrastar', id: d.id, t0: d.t0, ancora: chao(o.x, o.y), ux: o.x, uy: o.y, moveu: false };
    marcar(t);
    if (desde && (desde.x !== d.x || desde.y !== d.y)) moverArrasto(d, t);
  }

  function moverArrasto(d, t) {
    if (Math.hypot(d.x - d.x0, d.y - d.y0) > (d.tipo === 'mouse' ? GESTOS.mousePx : GESTOS.toquePx)) gesto.moveu = true;
    if (!gesto.moveu) return;
    if (!arrastarPara(gesto.ancora, d.x, d.y, t)) {
      moverTela(d.x - gesto.ux, d.y - gesto.uy, t);
      gesto.ancora = chao(d.x, d.y); // o chão que aparecer sob o dedo vira a âncora (sem salto na volta)
    }
    gesto.ux = d.x;
    gesto.uy = d.y;
  }

  /** O dedo em espera vira gesto: ferramenta (a partir do ponto em que tocou) ou arrasto da câmera. */
  function decidirUm(d, t) {
    if (st.modo === 'ferramenta') {
      gesto = { tipo: 'ferramenta', id: d.id, t0: d.t0, dispositivo: d.tipo };
      ferramenta('inicio', { x: d.x0, y: d.y0 }, 1, d.tipo);
      if (d.x !== d.x0 || d.y !== d.y0) ferramenta('move', d, 1, d.tipo);
    } else comecarArrasto(d, t, { desde: { x: d.x0, y: d.y0 } });
  }

  function comecarDois(t) {
    const [a, b] = [...dedos.values()];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    rastro.length = 0;
    marcar(t);
    gesto = {
      tipo: 'dois', modo: null, t0: t, tMove: null, e0: camera.estado(), ancora: chao(mx, my),
      p0: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }], d0: Math.hypot(a.x - b.x, a.y - b.y), ang0: Math.atan2(b.y - a.y, b.x - a.x),
      pinca: null, giro: null,
    };
  }

  /** Decide o modo de dois dedos pelo movimento de cada um desde o começo. */
  function decidirDois(g, a, b, t) {
    const d1 = { x: a.x - g.p0[0].x, y: a.y - g.p0[0].y };
    const d2 = { x: b.x - g.p0[1].x, y: b.y - g.p0[1].y };
    const anda = Math.max(Math.hypot(d1.x, d1.y), Math.hypot(d2.x, d2.y));
    if (anda < GESTOS.andarPx) return null;
    g.tMove ??= t;
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const dAng = Math.abs(normalizar(Math.atan2(b.y - a.y, b.x - a.x) - g.ang0)) / RAD;
    const vertical = d1.y * d2.y > 0 && Math.abs(d1.y) > 1.5 * Math.abs(d1.x) && Math.abs(d2.y) > 1.5 * Math.abs(d2.x);
    const passou = t - g.tMove >= GESTOS.decidirMs;
    if (st.modo !== 'ferramenta' && vertical && Math.abs(dist - g.d0) < GESTOS.pincaPx && dAng < GESTOS.giroGraus) {
      if (passou || Math.min(Math.abs(d1.y), Math.abs(d2.y)) >= GESTOS.toquePx) return 'inclinar';
      return null;
    }
    if (passou || Math.abs(dist - g.d0) > GESTOS.pincaPx || dAng > GESTOS.giroGraus || anda > GESTOS.toquePx) return 'livre';
    return null;
  }

  function moverDois(t) {
    const g = gesto;
    const [a, b] = [...dedos.values()];
    if (!g.modo) g.modo = decidirDois(g, a, b, t);
    if (!g.modo) return;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const e0 = g.e0;
    if (g.modo === 'inclinar') {
      const my0 = (g.p0[0].y + g.p0[1].y) / 2;
      camera.definir({ ...camera.estado(), inclinacao: e0.inclinacao + (my - my0) * 0.25 });
      camera.atualizar(t);
      marcar(t);
      return;
    }
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    // a pinça e o giro entram só depois do limiar, a partir do ponto em que entraram (sem salto)
    if (g.pinca === null && Math.abs(dist - g.d0) > GESTOS.pincaPx) g.pinca = dist;
    if (g.giro === null && Math.abs(normalizar(ang - g.ang0)) / RAD > GESTOS.giroGraus) g.giro = ang;
    const n = { ...camera.estado() };
    n.dist = g.pinca === null ? e0.dist : e0.dist * (g.pinca / Math.max(1, dist));
    n.guinada = g.giro === null ? e0.guinada : e0.guinada - normalizar(ang - g.giro) / RAD;
    camera.definir(n);
    camera.atualizar(t);
    // o ponto do chão do meio dos dedos fica sob o meio
    if (!arrastarPara(g.ancora, mx, my, t)) marcar(t);
  }

  // ---------------------------------------------------------------------------------------------- eventos

  function inicio(ev) {
    try {
      canvas.setPointerCapture?.(ev.pointerId);
    } catch (e) {
      // ponteiro que já saiu (ou sintético): segue sem captura
    }
    const t = tempo(ev);
    const p = ptr(ev);
    const tipo = tipoDe(ev);
    const d = { id: ev.pointerId, ...p, x0: p.x, y0: p.y, t0: t, botao: ev.button, tipo };
    dedos.set(ev.pointerId, d);
    pairar = null;
    camera.parar();
    const n = dedos.size;
    if (n === 1) {
      rastro.length = 0;
      if (tipo === 'mouse') {
        if (ev.button === 2 || ev.ctrlKey) {
          gesto = { tipo: 'girar', id: d.id, t0: t, e0: camera.estado(), moveu: false };
          marcar(t);
        } else if (ev.button === 0 && st.modo === 'ferramenta') {
          gesto = { tipo: 'ferramenta', id: d.id, t0: t, dispositivo: tipo };
          ferramenta('inicio', p, 1, tipo);
        } else comecarArrasto(d, t);
        return;
      }
      // toque e caneta: o árbitro espera 80 ms ou 8 px antes de decidir
      gesto = { tipo: 'espera', id: d.id, t0: t };
      return;
    }
    if (n === 2) {
      if (gesto?.tipo === 'ferramenta') {
        const f = dedos.get(gesto.id) ?? d;
        ferramenta('fim', f, 1, f.tipo, { cancelado: true });
      }
      if (gesto?.tipo === 'girar' || [...dedos.values()].some((x) => x.tipo === 'mouse')) return;
      comecarDois(t);
    }
  }

  function move(ev) {
    const t = tempo(ev);
    const p = ptr(ev);
    const d = dedos.get(ev.pointerId);
    if (!d) {
      // mouse sem botão sobre o canvas: a ferramenta segue o cursor (um evento por quadro, em quadro())
      if (ev.pointerType === 'mouse') pairar = { x: p.x, y: p.y, novo: true };
      return;
    }
    d.x = p.x;
    d.y = p.y;
    if (!gesto) return;
    if (gesto.tipo === 'espera') {
      if (Math.hypot(p.x - d.x0, p.y - d.y0) > GESTOS.toquePx) decidirUm(d, t);
      return;
    }
    if (gesto.tipo === 'ferramenta') {
      if (d.id === gesto.id) ferramenta('move', d, 1, d.tipo);
      return;
    }
    if (gesto.tipo === 'arrastar') {
      if (d.id === gesto.id) moverArrasto(d, t);
      return;
    }
    if (gesto.tipo === 'girar') {
      if (Math.hypot(p.x - d.x0, p.y - d.y0) > GESTOS.mousePx) gesto.moveu = true;
      if (!gesto.moveu) return;
      const e0 = gesto.e0;
      camera.definir({ ...camera.estado(), guinada: e0.guinada + (p.x - d.x0) * 0.3, inclinacao: e0.inclinacao + (p.y - d.y0) * 0.2 });
      marcar(t);
      return;
    }
    if (gesto.tipo === 'dois' && dedos.size >= 2) moverDois(t);
  }

  function fim(ev) {
    const t = tempo(ev);
    const d = dedos.get(ev.pointerId);
    dedos.delete(ev.pointerId);
    if (!d || !gesto) {
      if (!dedos.size) gesto = null;
      return;
    }
    const p = ptr(ev);
    d.x = p.x;
    d.y = p.y;
    const cancelado = ev.type === 'pointercancel';
    const g = gesto;
    if (g.tipo === 'espera') {
      // soltou antes de decidir: um toque (a ferramenta recebe o toque inteiro: início e fim no mesmo ponto)
      gesto = null;
      if (cancelado) return;
      if (st.modo === 'ferramenta') {
        ferramenta('inicio', d, 1, d.tipo);
        ferramenta('fim', d, 1, d.tipo);
      } else for (const fn of st.aoToque) fn({ x: p.x, y: p.y, longo: false, botao: d.botao });
      return;
    }
    if (g.tipo === 'ferramenta') {
      if (d.id === g.id) {
        ferramenta('fim', d, 1, d.tipo, cancelado ? { cancelado: true } : null);
        gesto = dedos.size ? { tipo: 'nada' } : null;
      }
      return;
    }
    if ((g.tipo === 'arrastar' || g.tipo === 'girar') && d.id === g.id) {
      if (!cancelado && !dedos.size) {
        if (!g.moveu && t - g.t0 <= GESTOS.longoMs) for (const fn of st.aoToque) fn({ x: p.x, y: p.y, longo: false, botao: d.botao });
        else if (g.moveu) soltar(g.tipo, t);
      }
      gesto = dedos.size ? { tipo: 'nada' } : null;
      return;
    }
    if (g.tipo === 'dois') {
      if (dedos.size === 1) {
        // sobrou um dedo: continua arrastando a câmera a partir dele (mesmo no modo ferramenta: o gesto era de câmera)
        const [r] = [...dedos.values()];
        r.x0 = r.x;
        r.y0 = r.y;
        rastro.length = 0;
        gesto = { tipo: 'arrastar', id: r.id, t0: t, ancora: chao(r.x, r.y), ux: r.x, uy: r.y, moveu: true };
        marcar(t);
      } else if (!dedos.size) {
        if (!cancelado && g.modo === 'livre') soltar('arrastar', t);
        gesto = null;
      }
      return;
    }
    if (!dedos.size) gesto = null;
  }

  function sair(ev) {
    if (ev.pointerType === 'mouse' && !dedos.size) pairar = null;
  }

  function roda(ev) {
    ev.preventDefault();
    const p = ptr(ev);
    const passo = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY;
    camera.zoom(Math.exp(Math.max(-300, Math.min(300, passo)) * 0.0016), chao(p.x, p.y));
  }

  const alvoTeclado = (ev) => !(ev.target && /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) && !ev.target?.isContentEditable;
  function teclaDesce(ev) {
    if (!alvoTeclado(ev) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const k0 = ev.key.toLowerCase();
    const k = TECLAS[k0] ?? k0;
    if ('wasdqerf+-='.includes(k) && k.length === 1) {
      teclas.add(k === '=' ? '+' : k);
      camera.parar();
    }
  }
  function teclaSobe(ev) {
    const k0 = ev.key.toLowerCase();
    const k = TECLAS[k0] ?? k0;
    teclas.delete(k === '=' ? '+' : k);
  }

  // ---------------------------------------------------------------------------------------------- quadro

  /** Profundidade (0 a 1) do ponto na faixa da borda da área livre e a direção para fora (px de tela). */
  function naBorda(p) {
    const A = st.opcoes.area ?? { x: 0, y: 0, w: telaW(), h: telaH() };
    const b = st.opcoes.bordaPx;
    if (!(b > 0)) return null;
    const fx = Math.max(0, (A.x + b - p.x) / b) - Math.max(0, (p.x - (A.x + A.w - b)) / b);
    const fy = Math.max(0, (A.y + b - p.y) / b) - Math.max(0, (p.y - (A.y + A.h - b)) / b);
    if (!fx && !fy) return null;
    return { fx: Math.max(-1, Math.min(1, fx)), fy: Math.max(-1, Math.min(1, fy)) };
  }

  /** Rolagem pela borda neste quadro (a vista anda para o lado da borda; devolve se andou). */
  function rolarBorda(dt, t) {
    let pontos = null;
    if (gesto?.tipo === 'ferramenta') {
      const d = dedos.get(gesto.id);
      if (d) pontos = [d, mira(d, d.tipo)];
    } else if (st.opcoes.bordaMouse && pairar && !dedos.size && (typeof document === 'undefined' || document.hasFocus?.() !== false)) {
      pontos = [pairar];
    }
    if (!pontos) return false;
    let fx = 0;
    let fy = 0;
    for (const p of pontos) {
      const b = naBorda(p);
      if (!b) continue;
      if (Math.abs(b.fx) > Math.abs(fx)) fx = b.fx;
      if (Math.abs(b.fy) > Math.abs(fy)) fy = b.fy;
    }
    if (!fx && !fy) return false;
    // a borda puxa o mundo para dentro: a vista anda na direção da borda, mais rápido no fundo da faixa
    const v = BORDA.pxPorS * dt;
    moverTela(fx * Math.abs(fx) * v, fy * Math.abs(fy) * v, t);
    return true;
  }

  let tAnt = 0;
  /** A cada quadro: o árbitro no tempo (decidir em 80 ms, toque longo), a borda, o cursor parado e as teclas. */
  function quadro(tMs) {
    const dt = tAnt ? Math.min(0.1, Math.max(0, (tMs - tAnt) / 1000)) : 0;
    tAnt = tMs;
    if (gesto?.tipo === 'espera') {
      const d = dedos.get(gesto.id);
      if (d && st.modo !== 'ferramenta' && tMs - gesto.t0 >= GESTOS.longoMs) {
        for (const fn of st.aoToque) fn({ x: d.x, y: d.y, longo: true, botao: d.botao });
        gesto = { tipo: 'nada' };
      } else if (d && tMs - gesto.t0 >= GESTOS.decidirMs && st.modo === 'ferramenta') decidirUm(d, tMs);
    } else if (gesto?.tipo === 'arrastar' && !gesto.moveu && st.modo !== 'ferramenta') {
      const d = dedos.get(gesto.id);
      if (d && d.tipo !== 'mouse' && tMs - gesto.t0 >= GESTOS.longoMs) {
        for (const fn of st.aoToque) fn({ x: d.x, y: d.y, longo: true, botao: d.botao });
        gesto = { tipo: 'nada' };
      }
    }
    if (dt > 0 && rolarBorda(dt, tMs) && gesto?.tipo === 'ferramenta') {
      const d = dedos.get(gesto.id);
      if (d) ferramenta('move', d, 1, d.tipo);
    }
    if (pairar?.novo && st.modo === 'ferramenta' && !dedos.size) {
      pairar.novo = false;
      ferramenta('move', pairar, 0, 'mouse');
    }
    if (!teclas.size || !(dt > 0)) return;
    const e = camera.estado();
    const v = e.dist * 0.9 * dt;
    const g = e.guinada * RAD;
    const fx = Math.sin(g);
    const fz = -Math.cos(g);
    let dx = 0;
    let dz = 0;
    if (teclas.has('w')) { dx += fx * v; dz += fz * v; }
    if (teclas.has('s')) { dx -= fx * v; dz -= fz * v; }
    if (teclas.has('d')) { dx -= fz * v; dz += fx * v; }
    if (teclas.has('a')) { dx += fz * v; dz -= fx * v; }
    if (dx || dz) camera.mover(dx, dz);
    const gi = (teclas.has('e') ? 70 : 0) - (teclas.has('q') ? 70 : 0);
    const inc = (teclas.has('f') ? 40 : 0) - (teclas.has('r') ? 40 : 0);
    if (gi || inc) camera.girar(gi * dt, inc * dt);
    if (teclas.has('+')) camera.zoom(Math.exp(-1.6 * dt));
    if (teclas.has('-')) camera.zoom(Math.exp(1.6 * dt));
  }

  const semMenu = (ev) => ev.preventDefault();
  const perdeuFoco = () => {
    teclas.clear();
    pairar = null;
  };
  canvas.addEventListener('pointerdown', inicio);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', fim);
  canvas.addEventListener('pointercancel', fim);
  canvas.addEventListener('pointerleave', sair);
  canvas.addEventListener('contextmenu', semMenu);
  canvas.addEventListener('wheel', roda, { passive: false });
  const janela = typeof addEventListener !== 'undefined';
  if (janela) {
    addEventListener('keydown', teclaDesce);
    addEventListener('keyup', teclaSobe);
    addEventListener('blur', perdeuFoco);
  }

  const api = {
    /** 'camera' ou 'ferramenta' (a UI troca quando abre e fecha uma ferramenta; um gesto em curso termina). */
    modo(m) {
      const novo = m === 'ferramenta' ? 'ferramenta' : 'camera';
      if (novo === st.modo) return;
      if (gesto?.tipo === 'ferramenta') {
        const d = dedos.get(gesto.id);
        if (d) ferramenta('fim', d, 1, d.tipo, { cancelado: true });
        gesto = { tipo: 'nada' };
      }
      st.modo = novo;
    },
    aoFerramenta(fn) {
      st.aoFerramenta = fn;
    },
    aoToque(fn) {
      st.aoToque.push(fn);
      return () => {
        st.aoToque = st.aoToque.filter((f) => f !== fn);
      };
    },
    /** { deslocY (0 a 72 px), bordaPx, bordaMouse (rolar pela borda da janela no PC), area: { x, y, w, h } | null }. */
    opcoes(o = {}) {
      if (Number.isFinite(o.deslocY)) o = { ...o, deslocY: Math.max(0, Math.min(72, o.deslocY)) };
      Object.assign(st.opcoes, o);
    },
    quadro,
    get estado() {
      return st.modo;
    },
    /** O gesto em curso (para testes e para a UI saber se a câmera está sendo mexida). */
    get gesto() {
      return gesto?.tipo ?? null;
    },
    /** Solta os ouvintes do canvas e da janela (R.descartar: um render novo não herda as teclas do velho). */
    descartar() {
      canvas.removeEventListener('pointerdown', inicio);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', fim);
      canvas.removeEventListener('pointercancel', fim);
      canvas.removeEventListener('pointerleave', sair);
      canvas.removeEventListener('contextmenu', semMenu);
      canvas.removeEventListener('wheel', roda);
      if (janela) {
        removeEventListener('keydown', teclaDesce);
        removeEventListener('keyup', teclaSobe);
        removeEventListener('blur', perdeuFoco);
      }
      teclas.clear();
      dedos.clear();
      gesto = null;
      if (ctx.entrada === api) ctx.entrada = null;
    },
  };
  ctx.entrada = api;
  return api;
}

/** Ângulo em (-pi, pi]. */
function normalizar(a) {
  let x = a % (2 * Math.PI);
  if (x > Math.PI) x -= 2 * Math.PI;
  if (x <= -Math.PI) x += 2 * Math.PI;
  return x;
}

export function registrar(api) {
  api.definirEntrada(criarEntrada);
  // o árbitro no tempo, a borda, o cursor parado e as teclas andam a cada quadro
  api.registrarDominio('entrada', (ctx) => ({
    nome: 'entrada',
    quadro: (tMs) => ctx.entrada?.quadro?.(tMs),
    descartar: () => ctx.entrada?.descartar?.(),
  }));
}
