// Entrada básica (R1a; a R1b completa com o árbitro de gestos em 80 ms, a mira deslocada e a rolagem pela borda):
// toque, mouse e teclado sobre a câmera à CS2 (camera.js). Um dedo ou o botão esquerdo (ou o do meio) arrasta e o
// ponto do chão fica sob o dedo; ao soltar, a vista desliza com a velocidade do gesto e para. Pinça aproxima em volta
// do meio dos dedos, dois dedos giram e, arrastados na vertical, inclinam. Botão direito (ou Ctrl) gira e inclina.
// A roda aproxima na direção do cursor, suave. Teclado: WASD move, Q e E giram, R e F inclinam, + e - aproximam.
// Toque curto chama aoToque({ x, y, longo }) (a UI seleciona com R.selecionar). No modo 'ferramenta', um dedo vai para
// a ferramenta ({ fase, x, y, ponto, dedos }) e dois dedos movem a câmera sem inclinar.

const JANELA_VEL = 90; // ms de movimento usados para a velocidade de soltura
const TOQUE_LONGO = 500;

export function criarEntrada(ctx, camera) {
  const canvas = ctx.canvas;
  const dedos = new Map();
  const st = { modo: 'camera', aoFerramenta: null, aoToque: [], opcoes: { deslocY: 56, bordaPx: 48 } };
  const teclas = new Set();
  let gesto = null;
  const agora = () => performance.now();
  const ptr = (ev) => {
    const r = canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };
  const chao = (x, y) => ctx.raio(x, y);
  // no toque a mira fica acima do dedo (deslocY); no mouse, no cursor
  const ferramenta = (fase, p, n, tipo) => {
    const y = p.y - (tipo === 'touch' ? st.opcoes.deslocY : 0);
    st.aoFerramenta?.({ fase, x: p.x, y, ponto: chao(p.x, y), dedos: n });
  };
  // amostras recentes do alvo para a velocidade de soltura
  const rastro = [];
  const marcar = () => {
    const e = camera.estado();
    rastro.push({ t: agora(), x: e.x, z: e.z, g: e.guinada, i: e.inclinacao });
    while (rastro.length > 2 && rastro[0].t < agora() - JANELA_VEL * 2) rastro.shift();
  };
  const soltar = (tipo) => {
    const n = rastro.length;
    if (n < 2) return;
    const a = rastro.find((r) => r.t >= rastro[n - 1].t - JANELA_VEL) ?? rastro[0];
    const b = rastro[n - 1];
    const dt = (b.t - a.t) / 1000;
    if (dt < 0.012 || agora() - b.t > 60) return; // parou antes de soltar
    if (tipo === 'arrastar') camera.impulso({ vx: (b.x - a.x) / dt, vz: (b.z - a.z) / dt });
    else camera.impulso({ vg: (b.g - a.g) / dt, vi: (b.i - a.i) / dt });
  };
  // arrasto: o ponto do chão fica sob o dedo. A câmera do three é posta em dia na hora: vários pointermove chegam entre
  // dois quadros, e o raio de cada um precisa sair da câmera já movida
  const arrastarPara = (ancora, x, y) => {
    const p = chao(x, y);
    if (!ancora || !p) return;
    camera.mover(ancora[0] - p[0], ancora[2] - p[2]);
    camera.atualizar(agora());
    marcar();
  };

  function inicio(ev) {
    try {
      canvas.setPointerCapture?.(ev.pointerId);
    } catch (e) {
      // ponteiro que já saiu (ou sintético): segue sem captura
    }
    const p = ptr(ev);
    dedos.set(ev.pointerId, { ...p, x0: p.x, y0: p.y, botao: ev.button, tipo: ev.pointerType });
    const n = dedos.size;
    camera.parar();
    rastro.length = 0;
    if (n === 1) {
      if (st.modo === 'ferramenta' && ev.button === 0) {
        gesto = { tipo: 'ferramenta', t0: agora() };
        ferramenta('inicio', p, 1, ev.pointerType);
        return;
      }
      const girar = ev.button === 2 || ev.ctrlKey;
      gesto = { tipo: girar ? 'girar' : 'arrastar', t0: agora(), ancora: chao(p.x, p.y), px: p.x, py: p.y, moveu: false, e0: camera.estado() };
      marcar();
    } else if (n === 2) {
      if (gesto?.tipo === 'ferramenta') ferramenta('fim', p, 1, ev.pointerType);
      const [a, b] = [...dedos.values()];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      gesto = { tipo: 'dois', d0: Math.hypot(a.x - b.x, a.y - b.y), ang0: Math.atan2(b.y - a.y, b.x - a.x), mx0: mx, my0: my, e0: camera.estado(), ancora: chao(mx, my) };
    }
  }

  function move(ev) {
    const d = dedos.get(ev.pointerId);
    if (!d) return;
    const p = ptr(ev);
    d.x = p.x;
    d.y = p.y;
    if (!gesto) return;
    if (gesto.tipo === 'ferramenta') {
      ferramenta('move', p, 1, ev.pointerType);
      return;
    }
    if (gesto.tipo === 'arrastar' || gesto.tipo === 'girar') {
      if (Math.hypot(p.x - d.x0, p.y - d.y0) > 6) gesto.moveu = true;
      if (!gesto.moveu) return;
      if (gesto.tipo === 'girar') {
        const e0 = gesto.e0;
        camera.definir({ ...camera.estado(), guinada: e0.guinada + (p.x - d.x0) * 0.3, inclinacao: e0.inclinacao + (p.y - d.y0) * 0.2 });
        marcar();
        return;
      }
      arrastarPara(gesto.ancora, p.x, p.y);
      return;
    }
    if (gesto.tipo === 'dois' && dedos.size >= 2) {
      const [a, b] = [...dedos.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const e0 = gesto.e0;
      const n = { ...camera.estado(), dist: e0.dist * (gesto.d0 / Math.max(1, dist)), guinada: e0.guinada - ((ang - gesto.ang0) * 180) / Math.PI };
      // dois dedos na vertical, juntos, inclinam (não no modo ferramenta)
      if (st.modo !== 'ferramenta' && Math.abs(dist - gesto.d0) < 40) n.inclinacao = e0.inclinacao + (my - gesto.my0) * 0.25;
      camera.definir(n);
      camera.atualizar(agora());
      // o ponto do chão do meio dos dedos fica sob o meio
      arrastarPara(gesto.ancora, mx, my);
    }
  }

  function fim(ev) {
    const d = dedos.get(ev.pointerId);
    dedos.delete(ev.pointerId);
    if (!d || !gesto) return;
    const p = ptr(ev);
    if (gesto.tipo === 'ferramenta') {
      ferramenta('fim', p, 1, ev.pointerType);
      gesto = null;
      return;
    }
    const cancelado = ev.type === 'pointercancel';
    if (!cancelado && (gesto.tipo === 'arrastar' || gesto.tipo === 'girar') && dedos.size === 0) {
      if (!gesto.moveu) {
        const longo = agora() - gesto.t0 > TOQUE_LONGO;
        for (const fn of st.aoToque) fn({ x: p.x, y: p.y, longo, botao: d.botao });
      } else soltar(gesto.tipo);
    }
    if (dedos.size === 1 && gesto.tipo === 'dois') {
      // sobrou um dedo: continua arrastando a partir dele
      const [r] = [...dedos.values()];
      gesto = { tipo: 'arrastar', t0: agora(), ancora: chao(r.x, r.y), moveu: true, e0: camera.estado() };
      r.x0 = r.x;
      r.y0 = r.y;
      rastro.length = 0;
      return;
    }
    if (dedos.size === 0) gesto = null;
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
    const k = ev.key.toLowerCase();
    if ('wasdqerf+-='.includes(k) && k.length === 1) {
      teclas.add(k === '=' ? '+' : k);
      camera.parar();
    }
  }
  function teclaSobe(ev) {
    const k = ev.key.toLowerCase();
    teclas.delete(k === '=' ? '+' : k);
  }

  let tTeclas = 0;
  /** Teclas seguradas, a cada quadro (a vista anda proporcional à distância). */
  function quadro(tMs) {
    const dt = tTeclas ? Math.min(0.1, (tMs - tTeclas) / 1000) : 0;
    tTeclas = tMs;
    if (!teclas.size || !(dt > 0)) return;
    const e = camera.estado();
    const v = e.dist * 0.9 * dt;
    const g = (e.guinada * Math.PI) / 180;
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

  canvas.addEventListener('pointerdown', inicio);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', fim);
  canvas.addEventListener('pointercancel', fim);
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  canvas.addEventListener('wheel', roda, { passive: false });
  if (typeof addEventListener !== 'undefined') {
    addEventListener('keydown', teclaDesce);
    addEventListener('keyup', teclaSobe);
    addEventListener('blur', () => teclas.clear());
  }

  const api = {
    modo(m) {
      st.modo = m === 'ferramenta' ? 'ferramenta' : 'camera';
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
    opcoes(o = {}) {
      Object.assign(st.opcoes, o);
    },
    quadro,
    get estado() {
      return st.modo;
    },
  };
  ctx.entrada = api;
  return api;
}

export function registrar(api) {
  api.definirEntrada(criarEntrada);
  // as teclas seguradas andam a cada quadro
  api.registrarDominio('entrada', (ctx) => ({ nome: 'entrada', quadro: (tMs) => ctx.entrada?.quadro?.(tMs) }));
}
