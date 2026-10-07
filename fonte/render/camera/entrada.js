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
// Árbitro: nos primeiros 80 ms (ou até o dedo andar 10 px) um dedo ainda não é gesto; se o segundo dedo chega nesse
// tempo, o gesto é de dois dedos e a ferramenta nem começa (a pinça não risca uma via). Com dois dedos, o modo
// (inclinar ou livre) se decide nos primeiros 80 ms depois de eles começarem a andar e não troca no meio; a pinça só
// entra depois de 18 px (ou 10% do vão) de mudança na distância e o giro depois de 8 graus (e 14 px de arco), sem
// salto (limiares em gesto.js). Um segundo dedo que chega com a ferramenta em curso a cancela (fase 'fim' com
// cancelado: true) e vira câmera.
// Quadro (TOQ1, D99): o pointermove só guarda a posição do dedo (e, pelos eventos coalescidos, o rastro para a
// velocidade de soltura, no tempo do hardware); a câmera anda UMA vez por quadro, em quadro(): um raio, o teto de
// deslocamento do quadro (o ponto preso não anda mais que 1,6 vez o que o dedo andou) e a câmera posta em dia ali, e
// não dentro do evento. A soltura mede a velocidade do dedo por mínimos quadrados nos últimos 100 ms de hardware (nunca
// pelo tempo do quadro), com teto, e passa ao chão sob o dedo; a câmera guarda o teto e a parada limpa. A sensibilidade
// do arrasto, da pinça e do giro e a inércia vêm das Configurações (opcoes: sensArrasto, sensPinca, sensGiro, inercia).
// Mouse: com ferramenta, o botão esquerdo usa a ferramenta e o cursor parado manda 'move' com dedos 0 (a prévia segue
// o cursor, como no CS2); botão do meio arrasta; direito (ou Ctrl) gira e inclina, e o clique direito curto abre o
// menu; a roda aproxima no cursor; borda da janela move a vista se ligada (bordaMouse). Teclado: WASD e setas movem,
// Q e E giram, R e F inclinam, + e - aproximam.
// Estável: ao perder o foco, a aba ir para o fundo ou a página sair, os dedos e a ferramenta em curso se cancelam (um
// pointerup perdido deixaria um dedo fantasma e o próximo toque viraria pinça); um toque primário com dedos velhos
// ainda guardados os limpa; um toque nos 12 px de baixo é do gesto do sistema e não começa nada.
// Evento da ferramenta: { fase: 'inicio' | 'move' | 'fim', x, y, ponto, dedos, tipo: 'toque' | 'mouse' | 'caneta',
// dedoX, dedoY, cancelado? } (x, y é a mira em px CSS; ponto o chão sob ela, R.raio).
// Segurar e arrastar (MOV1, D94): um ouvinte do toque longo que abre uma ferramenta (modo 'ferramenta') leva o dedo que
// ainda segura junto: o gesto vira o da ferramenta (fase 'inicio' no dedo) e o arrasto move o fantasma, sem a câmera.
// Quem registra o ouvinte com prioridade maior fala primeiro e, devolvendo true, fica com o toque (o menu de contexto, que
// ouve o mesmo toque longo, não abre por cima).
// Giro de dois dedos sobre o fantasma (D98, MOV1): com opcoes({ giroFerramenta: { x, z, raio } }) (o lugar da planta no chão)
// e um ouvinte de aoGiroDeFerramenta, dois dedos que começam sobre ela e giram não giram a câmera: o ouvinte recebe
// { delta, fim } com o ângulo acumulado dos dedos NO CHÃO, em radianos, na convenção da rotação do prédio (a frente é
// (sen rot, cos rot)); a pinça e o arrasto do par seguem mexendo na câmera.
// ?toque=1: registro por quadro do gesto em window.__toque (toque-log.js).
import { GESTOS, SOLTURA, Rastro, limiarPinca, limiarGiro, ehPinca, ehGiro, pontoDaPinca, pontoDoGiro, limitarVetor, tetoDoQuadro, aplicarTeto, metrosPorPxEm, opcoesDoToque } from './gesto.js';
import { criarLogToque, mostrarPainel } from './toque-log.js';
import { projetarNaTela } from './raio.js';

export { GESTOS };

/** Rolagem pela borda: velocidade máxima em px de tela por segundo, no fundo da faixa. */
export const BORDA = Object.freeze({ pxPorS: 900 });

const JANELA_VEL = 90; // ms de movimento usados para a velocidade de soltura do giro do mouse
const TECLAS = { arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd' };
const RAD = Math.PI / 180;

export function criarEntrada(ctx, camera) {
  const canvas = ctx.canvas;
  const dedos = new Map();
  const st = { modo: 'camera', aoFerramenta: null, aoGiroFerramenta: null, aoToque: [], opcoes: { deslocY: 56, bordaPx: 48, bordaMouse: false, area: null, giroFerramenta: null, ...opcoesDoToque({}) } };
  const teclas = new Set();
  let gesto = null;
  let pairar = null; // mouse parado sobre o canvas: { x, y, novo }
  const relogio = () => (typeof performance !== 'undefined' ? performance.now() : 0);
  const tempo = (ev) => (ev && Number.isFinite(ev.timeStamp) && ev.timeStamp > 0 ? ev.timeStamp : relogio());
  // o retângulo do canvas é lido ao tocar e quando a janela muda: ler a cada pointermove força o layout do navegador
  let rect = null;
  const ptr = (ev) => {
    rect ??= canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  };
  const tipoDe = (ev) => (ev.pointerType === 'touch' ? 'toque' : ev.pointerType === 'pen' ? 'caneta' : 'mouse');
  const telaH = () => ctx.tela?.h || canvas.clientHeight || 1;
  const telaW = () => ctx.tela?.w || canvas.clientWidth || 1;

  // ?toque=1: o registro por quadro (window.__toque); o custo do raio e da câmera entra por aqui
  const depurar = typeof location !== 'undefined' && /[?&]toque=1(&|$)/.test(location.search || '');
  const log = depurar ? criarLogToque({ projetar: (p) => projetarNaTela(ctx.camera, telaW(), telaH(), p), estado: () => camera.estado() }) : null;
  if (log && typeof window !== 'undefined') window.__toque = log;
  const tirarPainel = log ? mostrarPainel(log) : null;
  let tUltimoFim = 0; // o fim do último gesto: o registro recomeça (a tabela é a do gesto de agora) 3 s depois
  const chao = (x, y) => {
    if (!log) return ctx.raio(x, y);
    const a = relogio();
    const p = ctx.raio(x, y);
    log.custo('raio', relogio() - a);
    return p;
  };
  const atualizar = (t) => {
    if (!log) return camera.atualizar(t);
    const a = relogio();
    camera.atualizar(t);
    log.custo('atualizar', relogio() - a);
  };

  // ---------------------------------------------------------------------------------------------- ferramenta

  /** Avisa os ouvintes do toque (os de maior prioridade primeiro); devolve true se um deles ficou com o toque. */
  const avisarToque = (ev) => {
    for (const l of st.aoToque) if (l.fn(ev) === true) return true;
    return false;
  };

  /** A mira: acima do dedo no toque (deslocY), no cursor no mouse e na caneta; nunca fora da tela. */
  const mira = (p, tipo) => ({ x: p.x, y: Math.max(0, p.y - (tipo === 'toque' ? st.opcoes.deslocY : 0)) });
  const ferramenta = (fase, p, n, tipo, extra = null) => {
    const m = mira(p, tipo);
    st.aoFerramenta?.({ fase, x: m.x, y: m.y, ponto: chao(m.x, m.y), dedos: n, tipo, dedoX: p.x, dedoY: p.y, ...(extra ?? {}) });
  };

  // ---------------------------------------------------------------------------------------------- câmera

  /** Metros no chão por px de tela na distância do alvo (a vertical esticada pela inclinação). */
  const escala = () => {
    const e = camera.estado();
    const s = (2 * e.dist * Math.tan(((ctx.camera?.fov ?? 40) * RAD) / 2)) / telaH();
    return { s, k: s / Math.max(0.25, Math.sin(e.inclinacao * RAD)), g: e.guinada * RAD };
  };
  /** O que o mundo anda (m) quando a imagem anda dx, dy px de tela: direita no chão (cos g, sin g), frente (sin g, -cos g). */
  const telaParaMundo = (dx, dy) => {
    const { s, k, g } = escala();
    return [-dx * s * Math.cos(g) + dy * k * Math.sin(g), -dx * s * Math.sin(g) - dy * k * Math.cos(g)];
  };
  // o mundo anda dx, dy px de tela (arrasto no céu, rolagem pela borda); a câmera do three só se põe em dia com t
  const moverTela = (dx, dy, t = null) => {
    if (!dx && !dy) return;
    const [mx, mz] = telaParaMundo(dx, dy);
    camera.mover(mx, mz);
    if (t !== null) atualizar(t);
  };
  /** Metros por px do chão no ponto p (0 sem a câmera do three, como nos testes sem navegador). */
  const metrosPorPx = (p) => (ctx.camera?.position ? metrosPorPxEm(ctx.camera.position, p, ctx.camera.fov ?? 40, telaH()) : 0);

  // soltura do giro do mouse (botão direito): as amostras são da câmera, no tempo dos eventos
  const rastroCam = [];
  const marcarCam = (t) => {
    const e = camera.estado();
    rastroCam.push({ t, g: e.guinada, i: e.inclinacao });
    while (rastroCam.length > 2 && rastroCam[0].t < t - JANELA_VEL * 2) rastroCam.shift();
  };
  const soltarGiro = (t) => {
    const n = rastroCam.length;
    if (n < 2 || !st.opcoes.inercia) return;
    const a = rastroCam.find((r) => r.t >= rastroCam[n - 1].t - JANELA_VEL) ?? rastroCam[0];
    const b = rastroCam[n - 1];
    const dt = (b.t - a.t) / 1000;
    if (dt < 0.012 || t - b.t > 60) return; // parou antes de soltar
    camera.impulso({ vg: (b.g - a.g) / dt, vi: (b.i - a.i) / dt });
  };

  /**
   * A soltura de um arrasto: a velocidade do dedo (px/s do hardware, ajustada em 100 ms) vira a do chão sob o dedo (dois
   * raios, no dedo e um passo adiante) e a câmera anda ao contrário. Sem raio (céu), a escala do centro.
   */
  function soltarComRastro(rastro, x, y, t, sens = 1) {
    if (!st.opcoes.inercia) return;
    const v = rastro.velocidade(t);
    if (!v) return;
    const [vx, vy] = limitarVetor(v.vx * sens, v.vy * sens, SOLTURA.maxPxS);
    const pxs = Math.hypot(vx, vy);
    if (pxs < SOLTURA.minPxS) return;
    const h = 1 / 60;
    const p0 = chao(x, y);
    const p1 = p0 ? chao(x + vx * h, y + vy * h) : null;
    let mx;
    let mz;
    if (p0 && p1) {
      mx = -(p1[0] - p0[0]) / h;
      mz = -(p1[2] - p0[2]) / h;
    } else [mx, mz] = telaParaMundo(vx, vy);
    log?.solta(t, mx, mz, pxs);
    camera.impulso({ vx: mx, vz: mz });
  }

  // ---------------------------------------------------------------------------------------------- gestos

  function comecarArrasto(d, t, { desde = null } = {}) {
    const o = desde ?? d;
    const sens = d.tipo === 'toque' ? st.opcoes.sensArrasto : 1;
    // fx, fy: o último ponto do dedo lido; vx, vy: o dedo virtual (anda sens vezes o dedo); ux, uy: onde a câmera já o pôs
    gesto = { tipo: 'arrastar', id: d.id, t0: d.t0, ancora: chao(o.x, o.y), fx: o.x, fy: o.y, vx: o.x, vy: o.y, ux: o.x, uy: o.y, sens, moveu: false, sujo: false, mpp: 0 };
    log?.referencia(gesto.ancora);
    if (desde && (desde.x !== d.x || desde.y !== d.y)) {
      gesto.moveu = Math.hypot(d.x - d.x0, d.y - d.y0) > (d.tipo === 'mouse' ? GESTOS.mousePx : GESTOS.toquePx);
      gesto.sujo = gesto.moveu;
    }
  }

  /**
   * Põe o ponto preso sob o dedo: UM raio, a correção com o teto do quadro (o que sobrar fica para o quadro seguinte) e,
   * com tFrame, a câmera do three posta em dia (sem tFrame, na soltura, o quadro seguinte a põe).
   */
  function aplicarArrasto(d, tFrame) {
    const g = gesto;
    g.sujo = false;
    if (!g.moveu) return;
    g.vx += (d.x - g.fx) * g.sens;
    g.vy += (d.y - g.fy) * g.sens;
    g.fx = d.x;
    g.fy = d.y;
    const p = g.ancora ? chao(g.vx, g.vy) : null;
    if (p) {
      let dx = g.ancora[0] - p[0];
      let dz = g.ancora[2] - p[2];
      const mpp = metrosPorPx(p);
      if (mpp > 0) {
        [dx, dz] = aplicarTeto(dx, dz, tetoDoQuadro(Math.hypot(g.vx - g.ux, g.vy - g.uy), mpp, g.mpp));
        g.mpp = mpp;
      }
      camera.mover(dx, dz);
    } else {
      moverTela(g.vx - g.ux, g.vy - g.uy);
      g.ancora = chao(g.vx, g.vy); // o chão que aparecer sob o dedo vira a âncora (sem salto na volta)
    }
    g.ux = g.vx;
    g.uy = g.vy;
    if (tFrame !== null) atualizar(tFrame);
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
    rastroCam.length = 0;
    const ancora = chao(mx, my);
    gesto = {
      tipo: 'dois', modo: null, t0: t, tMove: null, e0: camera.estado(), ancora, sujo: false,
      p0: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }], d0: Math.hypot(a.x - b.x, a.y - b.y), ang0: Math.atan2(b.y - a.y, b.x - a.x),
      pinca: null, giro: null, sobreFantasma: sobreOFantasma(ancora), azRef: null, delta: 0,
    };
    log?.referencia(gesto.ancora);
  }

  /** O meio dos dedos (ponto do chão) está sobre a planta que a ferramenta anunciou, e há quem ouça o giro? */
  function sobreOFantasma(p) {
    const f = st.opcoes.giroFerramenta;
    if (st.modo !== 'ferramenta' || !st.aoGiroFerramenta || !f || !p) return false;
    return Math.hypot(p[0] - f.x, p[2] - f.z) <= f.raio;
  }

  /** Azimute (na convenção da rotação do prédio) do vetor do dedo a para o b, no chão; sem chão, pela tela e pela guinada. */
  function azimuteDosDedos(a, b) {
    const pa = chao(a.x, a.y);
    const pb = chao(b.x, b.y);
    if (pa && pb) return Math.atan2(pb[0] - pa[0], pb[2] - pa[2]);
    return Math.PI / 2 - Math.atan2(b.y - a.y, b.x - a.x) - camera.estado().guinada * RAD;
  }

  /** O giro dos dois dedos que o fantasma recebe (o ângulo acumulado desde que passou o limiar). */
  function girarFantasma(g, a, b) {
    const az = azimuteDosDedos(a, b);
    g.azRef ??= az;
    g.delta = normalizar(az - g.azRef);
    st.aoGiroFerramenta?.({ delta: g.delta, fim: false });
  }

  /** O gesto de giro do fantasma acabou (um dedo saiu, o foco se perdeu, a ferramenta fechou): o último ângulo vale. */
  function fecharGiroFantasma(g) {
    if (g?.tipo !== 'dois' || g.azRef === null) return;
    g.azRef = null;
    st.aoGiroFerramenta?.({ delta: g.delta, fim: true });
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
    const viaja = Math.hypot((a.x + b.x) / 2 - (g.p0[0].x + g.p0[1].x) / 2, (a.y + b.y) / 2 - (g.p0[0].y + g.p0[1].y) / 2);
    if (st.modo !== 'ferramenta' && vertical && Math.abs(dist - g.d0) < limiarPinca(g.d0) && dAng < limiarGiro(g.d0)) {
      if (passou || Math.min(Math.abs(d1.y), Math.abs(d2.y)) >= GESTOS.toquePx) return 'inclinar';
      return null;
    }
    if (passou || ehPinca(dist - g.d0, g.d0, viaja) || ehGiro(dAng, g.d0, viaja) || anda > GESTOS.toquePx) return 'livre';
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
      atualizar(t);
      return;
    }
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    // a pinça e o giro entram só depois do limiar (e se não forem só um dedo atrasado). A referência é o ponto do limiar no
    // caminho dos dedos, não o ponto em que o quadro o viu: com quadros lentos (5 qps) o limiar passa no meio de um quadro
    // e a vista perderia todo o caminho até ali (o zoom saía 30% menor); assim perde só o limiar, e o que a vista anda
    // no quadro de entrada é o que os dedos andaram nele (sem salto)
    const viaja = Math.hypot(mx - (g.p0[0].x + g.p0[1].x) / 2, my - (g.p0[0].y + g.p0[1].y) / 2);
    if (g.pinca === null && ehPinca(dist - g.d0, g.d0, viaja)) g.pinca = g.d0 + pontoDaPinca(dist - g.d0, g.d0, viaja);
    const dAng = normalizar(ang - g.ang0) / RAD;
    if (g.giro === null && ehGiro(dAng, g.d0, viaja)) g.giro = g.ang0 + pontoDoGiro(dAng, g.d0, viaja) * RAD;
    const n = { ...camera.estado() };
    n.dist = g.pinca === null ? e0.dist : e0.dist * (g.pinca / Math.max(1, dist)) ** st.opcoes.sensPinca;
    // sobre o fantasma da ferramenta o giro dos dedos é do fantasma, não da câmera
    const doFantasma = g.sobreFantasma && st.aoGiroFerramenta;
    n.guinada = g.giro === null || doFantasma ? e0.guinada : e0.guinada - (normalizar(ang - g.giro) / RAD) * st.opcoes.sensGiro;
    camera.definir(n);
    atualizar(t);
    // o ponto do chão do meio dos dedos fica sob o meio (o raio sai da câmera já posta em dia)
    const p = g.ancora ? chao(mx, my) : null;
    if (p) {
      camera.mover(g.ancora[0] - p[0], g.ancora[2] - p[2]);
      atualizar(t);
    }
    if (doFantasma && g.giro !== null) girarFantasma(g, a, b);
  }

  // ---------------------------------------------------------------------------------------------- eventos

  /** Cancela tudo o que está em curso (foco perdido, aba no fundo, página saindo): nenhum dedo fantasma fica. */
  function cancelarTudo() {
    if (gesto?.tipo === 'ferramenta') {
      const d = dedos.get(gesto.id);
      if (d) ferramenta('fim', d, 1, d.tipo, { cancelado: true });
    }
    fecharGiroFantasma(gesto);
    dedos.clear();
    gesto = null;
    pairar = null;
    teclas.clear();
  }

  function inicio(ev) {
    const tipo = tipoDe(ev);
    // um toque primário (o primeiro de uma sequência) com dedos de toque ainda guardados: o pointerup deles se perdeu
    if (tipo === 'toque' && ev.isPrimary === true && [...dedos.values()].some((x) => x.tipo === 'toque')) cancelarTudo();
    rect = canvas.getBoundingClientRect();
    const p = ptr(ev);
    // o gesto do sistema embaixo (a barra de gestos do Android) não é do jogo
    if (tipo === 'toque' && p.y > telaH() - GESTOS.margemBaixoPx) return;
    try {
      canvas.setPointerCapture?.(ev.pointerId);
    } catch (e) {
      // ponteiro que já saiu (ou sintético): segue sem captura
    }
    const t = tempo(ev);
    const d = { id: ev.pointerId, ...p, x0: p.x, y0: p.y, t0: t, botao: ev.button, tipo, rastro: new Rastro() };
    d.rastro.push(t, p.x, p.y);
    dedos.set(ev.pointerId, d);
    pairar = null;
    camera.parar();
    if (log && dedos.size === 1 && t - tUltimoFim > 3000) log.limpar();
    log?.evento('down', t, p.x, p.y);
    const n = dedos.size;
    if (n === 1) {
      rastroCam.length = 0;
      if (tipo === 'mouse') {
        if (ev.button === 2 || ev.ctrlKey) {
          gesto = { tipo: 'girar', id: d.id, t0: t, e0: camera.estado(), moveu: false };
          marcarCam(t);
        } else if (ev.button === 0 && st.modo === 'ferramenta') {
          gesto = { tipo: 'ferramenta', id: d.id, t0: t, dispositivo: tipo };
          ferramenta('inicio', p, 1, tipo);
        } else comecarArrasto(d, t);
        return;
      }
      // toque e caneta: o árbitro espera 80 ms ou 10 px antes de decidir
      gesto = { tipo: 'espera', id: d.id, t0: t };
      return;
    }
    if (n === 2) {
      // com o mouse no meio (tela de toque no notebook) o segundo ponteiro não vira pinça nem corta o gesto do mouse
      if (gesto?.tipo === 'girar' || [...dedos.values()].some((x) => x.tipo === 'mouse')) return;
      if (gesto?.tipo === 'ferramenta') {
        const f = dedos.get(gesto.id) ?? d;
        ferramenta('fim', f, 1, f.tipo, { cancelado: true });
      }
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
    // o rastro do dedo no tempo do hardware: os eventos coalescidos (vários por quadro, mesmo com quadros lentos)
    const lista = typeof ev.getCoalescedEvents === 'function' ? ev.getCoalescedEvents() : null;
    if (lista && lista.length > 1) for (const c of lista) d.rastro.push(tempo(c), c.clientX - rect.left, c.clientY - rect.top);
    else d.rastro.push(t, p.x, p.y);
    log?.evento('move', t, p.x, p.y, lista?.length ?? 1);
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
      // só marca: a câmera anda no quadro (um raio por quadro, não um por evento)
      if (d.id === gesto.id) {
        if (!gesto.moveu && Math.hypot(d.x - d.x0, d.y - d.y0) > (d.tipo === 'mouse' ? GESTOS.mousePx : GESTOS.toquePx)) gesto.moveu = true;
        gesto.sujo = gesto.moveu;
      }
      return;
    }
    if (gesto.tipo === 'girar') {
      if (Math.hypot(p.x - d.x0, p.y - d.y0) > GESTOS.mousePx) gesto.moveu = true;
      if (!gesto.moveu) return;
      const e0 = gesto.e0;
      camera.definir({ ...camera.estado(), guinada: e0.guinada + (p.x - d.x0) * 0.3, inclinacao: e0.inclinacao + (p.y - d.y0) * 0.2 });
      marcarCam(t);
      return;
    }
    if (gesto.tipo === 'dois' && dedos.size >= 2) gesto.sujo = true;
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
    log?.evento('up', t, p.x, p.y);
    tUltimoFim = t;
    const cancelado = ev.type === 'pointercancel';
    const g = gesto;
    if (g.tipo === 'espera') {
      // soltou antes de decidir: um toque (a ferramenta recebe o toque inteiro: início e fim no mesmo ponto)
      gesto = null;
      if (cancelado) return;
      if (st.modo === 'ferramenta') {
        ferramenta('inicio', d, 1, d.tipo);
        ferramenta('fim', d, 1, d.tipo);
      } else avisarToque({ x: p.x, y: p.y, longo: false, botao: d.botao });
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
        if (!g.moveu && t - g.t0 <= GESTOS.longoMs) avisarToque({ x: p.x, y: p.y, longo: false, botao: d.botao });
        else if (g.moveu && g.tipo === 'arrastar') {
          // a velocidade mede-se com a câmera ainda na pose do último quadro (os raios saem dela); depois o que o
          // dedo andou e ainda não foi aplicado entra, para a vista soltar na posição final do dedo
          soltarComRastro(d.rastro, g.vx, g.vy, t, g.sens);
          if (g.sujo || d.x !== g.fx || d.y !== g.fy) aplicarArrasto(d, null);
        } else if (g.moveu) soltarGiro(t);
      }
      gesto = dedos.size ? { tipo: 'nada' } : null;
      return;
    }
    if (g.tipo === 'dois') {
      fecharGiroFantasma(g);
      if (dedos.size >= 2) {
        // saiu um de três dedos: o gesto recomeça com o par que ficou (as medidas eram do par velho: a vista pulava)
        comecarDois(t);
      } else if (dedos.size === 1) {
        // sobrou um dedo: continua arrastando a câmera a partir dele (mesmo no modo ferramenta: o gesto era de câmera)
        const [r] = [...dedos.values()];
        r.x0 = r.x;
        r.y0 = r.y;
        r.rastro.limpar();
        r.rastro.push(t, r.x, r.y);
        const sens = r.tipo === 'toque' ? st.opcoes.sensArrasto : 1;
        gesto = { tipo: 'arrastar', id: r.id, t0: t, ancora: chao(r.x, r.y), fx: r.x, fy: r.y, vx: r.x, vy: r.y, ux: r.x, uy: r.y, sens, moveu: true, sujo: false, mpp: 0 };
        log?.referencia(gesto.ancora);
      }
      // o par nunca termina de uma vez: o primeiro dedo a sair deixa o arrastar de um dedo só (acima), que solta o último
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

  /** A câmera está sendo mexida (gesto de câmera ou deslize): a resolução dinâmica baixa até a vista parar. */
  const emMovimento = () => {
    if (gesto && ((gesto.tipo === 'arrastar' && gesto.moveu) || (gesto.tipo === 'dois' && gesto.modo) || (gesto.tipo === 'girar' && gesto.moveu))) return true;
    return !!camera.movendo;
  };

  /**
   * O toque longo (450 ms parado): os ouvintes decidem. Se algum abriu uma ferramenta com o dedo ainda em cima (segurar e
   * arrastar), o dedo segue na ferramenta: o gesto vira o dela e o arrasto leva o fantasma. Senão, o gesto acaba aqui.
   */
  function toqueLongo(d, t) {
    avisarToque({ x: d.x, y: d.y, longo: true, botao: d.botao });
    if (st.modo === 'ferramenta' && dedos.size === 1 && dedos.has(d.id)) {
      gesto = { tipo: 'ferramenta', id: d.id, t0: t, dispositivo: d.tipo };
      ferramenta('inicio', d, 1, d.tipo);
    } else gesto = { tipo: 'nada' };
  }

  let tAnt = 0;
  /** A cada quadro: o gesto da câmera (um raio), o árbitro no tempo (decidir em 80 ms, toque longo), a borda, o cursor parado e as teclas. */
  function quadro(tMs) {
    const dt = tAnt ? Math.min(0.2, Math.max(0, (tMs - tAnt) / 1000)) : 0;
    tAnt = tMs;
    if (gesto?.tipo === 'arrastar' && gesto.sujo) {
      const d = dedos.get(gesto.id);
      if (d) aplicarArrasto(d, tMs);
    } else if (gesto?.tipo === 'dois' && gesto.sujo && dedos.size >= 2) {
      gesto.sujo = false;
      moverDois(tMs);
    }
    if (gesto?.tipo === 'espera') {
      const d = dedos.get(gesto.id);
      if (d && st.modo !== 'ferramenta' && tMs - gesto.t0 >= GESTOS.longoMs) toqueLongo(d, tMs);
      else if (d && tMs - gesto.t0 >= GESTOS.decidirMs && st.modo === 'ferramenta') decidirUm(d, tMs);
    } else if (gesto?.tipo === 'arrastar' && !gesto.moveu && st.modo !== 'ferramenta') {
      const d = dedos.get(gesto.id);
      if (d && d.tipo !== 'mouse' && tMs - gesto.t0 >= GESTOS.longoMs) toqueLongo(d, tMs);
    }
    if (dt > 0 && rolarBorda(dt, tMs) && gesto?.tipo === 'ferramenta') {
      const d = dedos.get(gesto.id);
      if (d) ferramenta('move', d, 1, d.tipo);
    }
    if (pairar?.novo && st.modo === 'ferramenta' && !dedos.size) {
      pairar.novo = false;
      ferramenta('move', pairar, 0, 'mouse');
    }
    if (teclas.size && dt > 0) andarComTeclas(dt);
    // a resolução dinâmica e o registro veem o estado do quadro já com a câmera nova
    const mexendo = emMovimento();
    ctx.quadro?.resolucao?.movimento?.(mexendo, tMs);
    if (log) {
      const g = gesto?.tipo;
      const fase = g && g !== 'nada' ? g : camera.movendo ? 'deslize' : 'parado';
      const d = g === 'arrastar' || g === 'ferramenta' || g === 'espera' ? dedos.get(gesto.id) : null;
      const par = g === 'dois' && dedos.size >= 2 ? [...dedos.values()] : null;
      log.quadro(tMs, { fase, dedo: d ? [d.x, d.y] : par ? [(par[0].x + par[1].x) / 2, (par[0].y + par[1].y) / 2] : null, pr: ctx.pr ?? null });
    }
  }

  function andarComTeclas(dt) {
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
  const perdeuFoco = () => cancelarTudo();
  const mudouVisibilidade = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') cancelarTudo();
  };
  const mudouTela = () => {
    rect = null;
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
    addEventListener('pagehide', perdeuFoco);
    addEventListener('resize', mudouTela);
    addEventListener('orientationchange', mudouTela);
  }
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', mudouVisibilidade);

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
      if (gesto?.tipo === 'dois') fecharGiroFantasma(gesto);
      st.modo = novo;
    },
    aoFerramenta(fn) {
      st.aoFerramenta = fn;
    },
    /** O giro de dois dedos sobre o fantasma da ferramenta: fn({ delta, fim }); devolve a função que desliga. */
    aoGiroDeFerramenta(fn) {
      st.aoGiroFerramenta = fn;
      return () => {
        if (st.aoGiroFerramenta === fn) st.aoGiroFerramenta = null;
      };
    },
    /** `prioridade` maior fala primeiro; um ouvinte que devolve true fica com o toque e os seguintes não o recebem. */
    aoToque(fn, { prioridade = 0 } = {}) {
      const l = { fn, prioridade };
      st.aoToque.push(l);
      st.aoToque.sort((a, b) => b.prioridade - a.prioridade);
      return () => {
        st.aoToque = st.aoToque.filter((x) => x !== l);
      };
    },
    /**
     * { deslocY (0 a 72 px), bordaPx, bordaMouse (rolar pela borda da janela no PC), area: { x, y, w, h } | null,
     *   sensArrasto, sensPinca, sensGiro (0,4 a 2), inercia (bool), giroFerramenta: { x, z, raio } (m, a planta do fantasma
     *   no chão) | null }.
     */
    opcoes(o = {}) {
      if (Number.isFinite(o.deslocY)) o = { ...o, deslocY: Math.max(0, Math.min(72, o.deslocY)) };
      for (const k of ['sensArrasto', 'sensPinca', 'sensGiro']) if (k in o) o = { ...o, [k]: Number.isFinite(o[k]) ? Math.max(0.4, Math.min(2, o[k])) : 1 };
      if ('inercia' in o) o = { ...o, inercia: o.inercia !== false };
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
    /** O registro do gesto (?toque=1) ou null. */
    get registro() {
      return log;
    },
    /** Cancela os dedos e a ferramenta em curso (a aba foi para o fundo, o foco saiu). */
    cancelar: cancelarTudo,
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
        removeEventListener('pagehide', perdeuFoco);
        removeEventListener('resize', mudouTela);
        removeEventListener('orientationchange', mudouTela);
      }
      if (typeof document !== 'undefined' && document.removeEventListener) document.removeEventListener('visibilitychange', mudouVisibilidade);
      teclas.clear();
      dedos.clear();
      gesto = null;
      if (ctx.entrada === api) ctx.entrada = null;
      if (log && typeof window !== 'undefined' && window.__toque === log) delete window.__toque;
      tirarPainel?.();
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
