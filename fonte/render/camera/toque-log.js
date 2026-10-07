// Registro do gesto (?toque=1, TOQ1/D99): por quadro, os eventos de ponteiro que chegaram, o dt, o deslocamento da
// câmera, o custo do raio e o salto. O salto é o quanto a imagem andou de verdade: um ponto do chão de referência (o
// que estava sob o dedo ao começar; no deslize, o mesmo) é projetado na tela a cada quadro, e a diferença para o quadro
// anterior, em px, é o que o jogador vê pular; num arrasto perfeito ele é igual ao que o dedo andou no quadro.
// Sem three: quem cria passa as funções (a entrada, e a sonda de ferramentas/ no Chromium de teste).
// window.__toque = { quadros, eventos, resumo(), limpar() } com ?toque=1, e um painel pequeno no canto com a tabela do
// último gesto ao vivo (para o vídeo do dono no celular, onde não há console).

const mediana = (l) => {
  if (!l.length) return 0;
  const o = [...l].sort((a, b) => a - b);
  const m = o.length >> 1;
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};
const r1 = (v) => Math.round(v * 10) / 10;

/**
 * @param {{ projetar: (p: number[]) => ({ x: number, y: number, visivel?: boolean } | null),
 *           estado: () => { x: number, z: number, dist: number, guinada: number }, max?: number }} op
 */
export function criarLogToque({ projetar, estado, max = 6000 }) {
  const quadros = [];
  const eventos = [];
  const c = { raios: 0, raioMs: 0, atualizar: 0, atualizarMs: 0, moves: 0, coalescidos: 0 };
  let ref = null;
  let ant = null; // quadro anterior: { t, px, py, e, dedo }
  let ultimaSolta = null; // { t, vx, vz, pxs }

  const api = {
    quadros,
    eventos,
    /** Um custo medido de dentro da entrada: 'raio' ou 'atualizar' (ms). */
    custo(nome, ms) {
      c[nome === 'raio' ? 'raios' : 'atualizar']++;
      c[nome === 'raio' ? 'raioMs' : 'atualizarMs'] += ms;
    },
    /** Um evento de ponteiro entregue: tipo, tempo do hardware, posição e quantos coalescidos vieram juntos. */
    evento(tipo, t, x, y, co = 1) {
      if (tipo === 'move') {
        c.moves++;
        c.coalescidos += co;
      }
      eventos.push({ tipo, t: r1(t), x: Math.round(x), y: Math.round(y), co, quadro: quadros.length });
      if (eventos.length > max) eventos.shift();
    },
    /** O ponto do chão que serve de régua do salto (a entrada põe sob o dedo ao começar o gesto). */
    referencia(p) {
      ref = p ? [p[0], p[1], p[2]] : null;
      ant = null;
    },
    /** A soltura que a câmera recebeu (m/s no mundo e px/s medidos no centro). */
    solta(t, vx, vz, pxs) {
      ultimaSolta = { t: r1(t), vx: Math.round(vx), vz: Math.round(vz), pxs: Math.round(pxs) };
    },
    /** Fecha o quadro: fase 'arrastar' | 'dois' | 'espera' | 'ferramenta' | 'deslize' | 'parado'. */
    quadro(t, { fase, dedo = null, pr = null }) {
      if (fase === 'parado') {
        ant = null;
        return;
      }
      const e = estado();
      const p = ref ? projetar(ref) : null;
      let dt = 0;
      let salto = 0;
      let dedoPx = 0;
      let camM = 0;
      let zoom = 0;
      let giro = 0;
      if (ant) {
        dt = t - ant.t;
        if (p && ant.p) salto = Math.hypot(p.x - ant.p.x, p.y - ant.p.y);
        if (dedo && ant.dedo) dedoPx = Math.hypot(dedo[0] - ant.dedo[0], dedo[1] - ant.dedo[1]);
        camM = Math.hypot(e.x - ant.e.x, e.z - ant.e.z);
        zoom = e.dist / ant.e.dist - 1;
        giro = ((e.guinada - ant.e.guinada + 540) % 360) - 180;
      }
      quadros.push({
        t: r1(t), dt: r1(dt), fase, moves: c.moves, coalescidos: c.coalescidos, dedoPx: r1(dedoPx), saltoPx: r1(salto), camM: r1(camM),
        zoomPct: r1(zoom * 100), giroGraus: r1(giro), raios: c.raios, raioMs: +c.raioMs.toFixed(3), atualizarMs: +c.atualizarMs.toFixed(3), pr,
      });
      if (quadros.length > max) quadros.shift();
      ant = { t, p, e, dedo };
    },
    limpar() {
      quadros.length = 0;
      eventos.length = 0;
      Object.assign(c, { raios: 0, raioMs: 0, atualizar: 0, atualizarMs: 0, moves: 0, coalescidos: 0 });
      ant = null;
      ultimaSolta = null;
    },
    /**
     * Tabela do gesto: maior salto por quadro, quadros com mais de 50 ms durante o arrasto, distância percorrida depois
     * de soltar e o custo do raio.
     */
    resumo() {
      const dedoFase = (f) => f.fase === 'arrastar' || f.fase === 'dois' || f.fase === 'espera';
      const arr = quadros.filter((f) => dedoFase(f) && f.dt > 0);
      const des = quadros.filter((f) => f.fase === 'deslize');
      let maior = null;
      let excesso = 0;
      for (const f of arr) {
        if (!maior || f.saltoPx > maior.saltoPx) maior = f;
        excesso = Math.max(excesso, f.saltoPx - f.dedoPx);
      }
      const dts = arr.map((f) => f.dt);
      const nArr = Math.max(1, arr.length);
      const ult = quadros[quadros.length - 1];
      return {
        quadrosArrasto: arr.length,
        dtMedioMs: r1(dts.reduce((a, b) => a + b, 0) / nArr),
        dtMedianoMs: r1(mediana(dts)),
        quadrosMais50ms: dts.filter((d) => d > 50).length,
        maiorSaltoPx: maior ? maior.saltoPx : 0,
        maiorSaltoComDedoPx: maior ? maior.dedoPx : 0,
        excessoPx: r1(excesso),
        deslizePx: Math.round(des.reduce((a, f) => a + f.saltoPx, 0)),
        deslizeM: Math.round(des.reduce((a, f) => a + f.camM, 0)),
        deslizeMs: des.length ? Math.round(des[des.length - 1].t - des[0].t + des[0].dt) : 0,
        maiorSaltoDeslizePx: Math.max(0, ...des.map((f) => f.saltoPx)),
        eventosMove: c.moves,
        coalescidosPorMove: c.moves ? r1(c.coalescidos / c.moves) : 0,
        raiosPorQuadro: ult && quadros.length ? r1(ult.raios / Math.max(1, quadros.length)) : 0,
        raioMsTotal: ult ? +ult.raioMs.toFixed(2) : 0,
        raioMsPorQuadro: ult && quadros.length ? +(ult.raioMs / quadros.length).toFixed(3) : 0,
        atualizarMsPorQuadro: ult && quadros.length ? +(ult.atualizarMs / quadros.length).toFixed(3) : 0,
        solta: ultimaSolta,
      };
    },
  };
  return api;
}

const n1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

/** As linhas do painel (a tabela do último gesto). */
export function linhasDoPainel(r, pr = null) {
  return [
    'toque (?toque=1)',
    `quadros no gesto   ${r.quadrosArrasto}   dt médio ${n1(r.dtMedioMs)} ms`,
    `quadros acima de 50 ms   ${r.quadrosMais50ms}`,
    `maior salto   ${n1(r.maiorSaltoPx)} px (dedo ${n1(r.maiorSaltoComDedoPx)})`,
    `salto além do dedo   ${n1(r.excessoPx)} px`,
    `deslize depois de soltar   ${r.deslizePx} px em ${r.deslizeMs} ms`,
    `raios por quadro   ${n1(r.raiosPorQuadro)}   ${n1(r.raioMsPorQuadro)} ms`,
    ...(pr ? [`resolução   ${n1(pr)}`] : []),
  ];
}

/** Painel na tela com a tabela ao vivo (duas vezes por segundo). Devolve quem o tira. */
export function mostrarPainel(log, doc = typeof document !== 'undefined' ? document : null) {
  if (!doc?.body) return () => {};
  const el = doc.createElement('pre');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:fixed;left:8px;top:8px;z-index:96;margin:0;padding:6px 8px;border-radius:6px;background:rgba(0,0,0,.72);color:#bff;font:11px/1.35 ui-monospace,Menlo,monospace;pointer-events:none;white-space:pre';
  doc.body.appendChild(el);
  const id = setInterval(() => {
    const ult = log.quadros[log.quadros.length - 1];
    el.textContent = linhasDoPainel(log.resumo(), ult?.pr).join('\n');
  }, 500);
  return () => {
    clearInterval(id);
    el.remove();
  };
}
