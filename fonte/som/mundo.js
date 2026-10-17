// Sons do mundo pela altura da câmera (desenho da UI 11; producao.md 2.5; dona: U2b): vento, cidade, gaivotas e água,
// todos sintetizados em Web Audio (ruído filtrado e osciladores), sem arquivo de áudio. Perto do chão a cidade e a água
// aparecem; lá em cima o vento toma conta e a cidade some, como no ambiente por zoom do Cities: Skylines. O canal é
// o Ambiente do mixer (volume nas Configurações). Nada soa antes do primeiro gesto (o contexto só nasce no "Clique para
// entrar") e a simulação nunca é tocada: só se lê a câmera, o relevo e a hora.
//   mistura({ altura, costa, noite, populacao })  a conta pura dos quatro volumes (testes sem áudio)
//   criarMundo(ctx, destino)                      o grafo de áudio e quem o atualiza (testes com contexto falso)
import { canal } from './som.js';
import { alturaEm } from '../comum/altura.js';

/** Alturas (m acima do chão) onde o mundo está "perto" e "longe": entre as duas a mistura muda em escala logarítmica. */
export const ALTURA_PERTO = 60;
export const ALTURA_LONGE = 3000;
/** Moradores de que a cidade pede o zumbido inteiro. */
export const POPULACAO_CHEIA = 3000;
/** Raio (m) em que se procura a água em volta do ponto olhado, e o nível do mar acima do qual o chão é seco. */
export const RAIO_COSTA = 220;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const suave = (t) => t * t * (3 - 2 * t);

/** 0 perto do chão e 1 lá em cima (logarítmico entre ALTURA_PERTO e ALTURA_LONGE). */
export function fracaoDeAltura(altura) {
  const a = Math.max(ALTURA_PERTO, Number.isFinite(altura) ? altura : ALTURA_PERTO);
  return clamp01(Math.log(a / ALTURA_PERTO) / Math.log(ALTURA_LONGE / ALTURA_PERTO));
}

/**
 * Os quatro volumes (0 a 1) pela situação da câmera.
 * @param {{ altura: number, costa: number, noite: number, populacao: number }} s
 *   altura da câmera sobre o chão (m); costa de 0 a 1 (fração de água em volta do ponto olhado); noite de 0 a 1;
 *   populacao em moradores
 */
export function mistura({ altura = 500, costa = 0, noite = 0, populacao = 0 } = {}) {
  const t = fracaoDeAltura(altura);
  const alto = suave(t);
  const perto = 1 - alto;
  const pop = clamp01(populacao / POPULACAO_CHEIA);
  const agua = clamp01(costa);
  const n = clamp01(noite);
  return {
    // o vento sempre existe e cresce com a altura
    vento: 0.1 + 0.75 * alto,
    // a cidade: o canteiro da Holding no começo, o zumbido inteiro com a população; some de longe; mais baixa à noite
    cidade: (0.08 + 0.92 * pop) * perto ** 1.2 * (1 - 0.35 * n),
    // gaivotas: só de dia, perto da água e não muito alto
    gaivotas: agua * (1 - n) * perto ** 0.8 * (t < 0.85 ? 1 : 0),
    // água: ondas na costa, mais fracas com a altura
    agua: agua * (1 - 0.75 * alto) * 0.85,
  };
}

/**
 * Fração de água em volta de um ponto (0 a 1): o próprio ponto e oito pontos a RAIO_COSTA, contando os que estão no
 * nível do mar ou abaixo dele.
 * @param {{ n: number, passo: number, origem: number[], altura: Float32Array } | null} terreno  espelho.terreno
 */
export function fracaoDeAgua(terreno, x, z, nivelMar = 0) {
  if (!terreno?.altura) return 0;
  let agua = 0;
  let total = 0;
  for (let k = -1; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const px = k < 0 ? x : x + Math.cos(a) * RAIO_COSTA;
    const pz = k < 0 ? z : z + Math.sin(a) * RAIO_COSTA;
    if (alturaEm(terreno, px, pz) <= nivelMar + 0.3) agua++;
    total++;
  }
  // um ponto de água em nove já dá a brisa da costa; metade em água é a praia cheia
  return clamp01((agua / total) * 2);
}

/** Altura da câmera sobre o chão pela órbita (distância x seno da inclinação). */
export const alturaDaCamera = (cam) => Math.max(2, (cam?.dist ?? 500) * Math.sin(((cam?.inclinacao ?? 35) * Math.PI) / 180));

// ------------------------------------------------------------------------------------------------ grafo de áudio

/** Ruído branco ou marrom reproduzível (sem sorteio) em laço de `seg` segundos. */
function bufferDeRuido(ctx, tipo, seg, semente) {
  const n = Math.floor(ctx.sampleRate * seg);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let s = semente;
  let marrom = 0;
  for (let i = 0; i < n; i++) {
    s = (s * 16807) % 2147483647;
    const b = (s / 2147483647) * 2 - 1;
    if (tipo === 'marrom') {
      marrom = (marrom + 0.02 * b) / 1.02;
      d[i] = marrom * 3.5;
    } else d[i] = b;
  }
  // as pontas se encontram: o laço não estala (cruzamento linear nos últimos 2%)
  const f = Math.max(1, Math.floor(n * 0.02));
  for (let i = 0; i < f; i++) {
    const w = i / f;
    d[n - f + i] = d[n - f + i] * (1 - w) + d[i] * w;
  }
  return buf;
}

function fonteDeRuido(ctx, buf, taxa = 1, inicio = 0) {
  const s = ctx.createBufferSource();
  s.buffer = buf;
  s.loop = true;
  s.playbackRate.value = taxa;
  s.start(0, inicio);
  return s;
}

function lfo(ctx, freq, profundidade, destino) {
  const o = ctx.createOscillator();
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = profundidade;
  o.connect(g);
  g.connect(destino);
  o.start();
  return o;
}

/**
 * Monta o grafo (vento, cidade, água) no destino e devolve quem o atualiza. As gaivotas são notas agendadas.
 * @returns {{ atualizar(m: object, agora?: number): void, gaivota(t0?: number): void, parar(): void, nos: number }}
 */
export function criarMundo(ctx, destino) {
  const mestre = ctx.createGain();
  mestre.gain.value = 1;
  mestre.connect(destino);
  const branco = bufferDeRuido(ctx, 'branco', 7, 4242);
  const marrom = bufferDeRuido(ctx, 'marrom', 9, 9091);
  const fontes = [];
  const osciladores = [];
  const camada = (nome) => {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(mestre);
    return g;
  };
  const gVento = camada('vento');
  const gCidade = camada('cidade');
  const gAgua = camada('agua');
  const gGaivota = camada('gaivotas');

  // vento: ruído marrom numa faixa que abre e fecha devagar, e rajadas no volume
  {
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 420;
    f.Q.value = 0.55;
    const rajada = ctx.createGain();
    rajada.gain.value = 0.7;
    fontes.push(fonteDeRuido(ctx, marrom, 1, 1.3));
    fontes[fontes.length - 1].connect(f);
    f.connect(rajada);
    rajada.connect(gVento);
    osciladores.push(lfo(ctx, 0.067, 260, f.frequency), lfo(ctx, 0.11, 0.25, rajada.gain));
  }
  // cidade: o rumor grave do tráfego e das máquinas, mais um fio de ar de 900 Hz que respira, e dois zumbidos de rede
  {
    const baixo = ctx.createBiquadFilter();
    baixo.type = 'lowpass';
    baixo.frequency.value = 230;
    fontes.push(fonteDeRuido(ctx, marrom, 0.8, 4.1));
    fontes[fontes.length - 1].connect(baixo);
    const gb = ctx.createGain();
    gb.gain.value = 0.8;
    baixo.connect(gb);
    gb.connect(gCidade);
    const fio = ctx.createBiquadFilter();
    fio.type = 'bandpass';
    fio.frequency.value = 900;
    fio.Q.value = 0.4;
    const gf = ctx.createGain();
    gf.gain.value = 0.05;
    fontes.push(fonteDeRuido(ctx, branco, 1, 2.2));
    fontes[fontes.length - 1].connect(fio);
    fio.connect(gf);
    gf.connect(gCidade);
    osciladores.push(lfo(ctx, 0.05, 0.03, gf.gain));
    for (const f of [62, 93.5]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.035;
      o.connect(g);
      g.connect(gCidade);
      o.start();
      osciladores.push(o);
    }
  }
  // água: marolas (ruído abafado cujo volume sobe e desce a cada uns 8 s) e a espuma de ar agudo
  {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1300;
    const onda = ctx.createGain();
    onda.gain.value = 0.55;
    fontes.push(fonteDeRuido(ctx, branco, 0.9, 0.7));
    fontes[fontes.length - 1].connect(f);
    f.connect(onda);
    onda.connect(gAgua);
    osciladores.push(lfo(ctx, 0.125, 0.4, onda.gain));
    const e = ctx.createBiquadFilter();
    e.type = 'highpass';
    e.frequency.value = 3200;
    const ge = ctx.createGain();
    ge.gain.value = 0.05;
    fontes.push(fonteDeRuido(ctx, branco, 1.1, 3.3));
    fontes[fontes.length - 1].connect(e);
    e.connect(ge);
    ge.connect(gAgua);
    osciladores.push(lfo(ctx, 0.125, 0.04, ge.gain));
  }
  let nos = fontes.length + osciladores.length;

  /** Um grito de gaivota: duas harmônicas que sobem e descem, com um tremor. */
  function gaivota(t0 = 0, f0 = 1900) {
    const t = ctx.currentTime + t0;
    for (const [mult, vol] of [[1, 0.5], [2, 0.18]]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      const g = ctx.createGain();
      o.frequency.setValueAtTime(f0 * mult, t);
      o.frequency.linearRampToValueAtTime(f0 * 1.42 * mult, t + 0.12);
      o.frequency.linearRampToValueAtTime(f0 * 0.85 * mult, t + 0.42);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.46);
      o.connect(g);
      g.connect(gGaivota);
      o.start(t);
      o.stop(t + 0.5);
      nos++;
    }
  }

  return {
    get nos() {
      return nos;
    },
    atualizar(m, constante = 0.6) {
      const t = ctx.currentTime;
      const teto = { vento: 0.55, cidade: 0.5, agua: 0.5, gaivotas: 0.22 };
      gVento.gain.setTargetAtTime(m.vento * teto.vento, t, constante);
      gCidade.gain.setTargetAtTime(m.cidade * teto.cidade, t, constante);
      gAgua.gain.setTargetAtTime(m.agua * teto.agua, t, constante);
      gGaivota.gain.setTargetAtTime(m.gaivotas * teto.gaivotas * 4, t, constante);
    },
    gaivota,
    parar() {
      for (const f of fontes) {
        try {
          f.stop();
        } catch (e) {
          // já parou
        }
      }
      for (const o of osciladores) {
        try {
          o.stop();
        } catch (e) {
          // já parou
        }
      }
      mestre.disconnect();
    },
  };
}

// ------------------------------------------------------------------------------------------------ ligação com o app

/** Semente das gaivotas: um gerador pequeno para os intervalos entre os gritos (som não é simulação). */
function geradorLocal(semente) {
  let s = semente % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** registrar(app) vem de app/controle.js: lê a câmera, o relevo e a hora a cada décimo de segundo. */
export function registrar(app) {
  if (typeof window === 'undefined' || !app?.aoQuadro) return;
  let mundo = null;
  let ctxDoMundo = null;
  let ultimo = -Infinity;
  let populacao = 0;
  let tPop = -Infinity;
  let proximaGaivota = 0;
  const sorteio = geradorLocal(7331);

  app.aoQuadro((tMs) => {
    if (tMs - ultimo < 100) return;
    ultimo = tMs;
    const g = canal('ambiente');
    if (!g) return;
    if (!mundo || ctxDoMundo !== g.context) {
      mundo?.parar();
      ctxDoMundo = g.context;
      mundo = criarMundo(g.context, g);
      proximaGaivota = g.context.currentTime + 3;
    }
    const cam = app.R?.camera?.estado?.();
    if (!cam) return;
    const esp = app.sim?.espelho;
    if (tMs - tPop > 2000) {
      tPop = tMs;
      populacao = app.sim?.q?.barra?.()?.populacao ?? 0;
    }
    const hora = esp?.tempo?.hora ?? 10;
    // noite de 0 a 1: pleno entre 20 h e 4 h, com uma hora de rampa em cada ponta (19 a 20 h e 4 a 5 h)
    const noite = hora >= 19 ? clamp01(hora - 19) : hora < 5 ? clamp01(5 - hora) : 0;
    const m = mistura({
      altura: alturaDaCamera(cam),
      costa: fracaoDeAgua(esp?.terreno, cam.x, cam.z, esp?.mapa?.nivelMar ?? 0),
      noite,
      populacao,
    });
    mundo.atualizar(m);
    if (m.gaivotas > 0.05) {
      const agora = g.context.currentTime;
      if (agora >= proximaGaivota) {
        const gritos = 1 + Math.floor(sorteio() * 3);
        for (let i = 0; i < gritos; i++) mundo.gaivota(i * (0.5 + sorteio() * 0.3), 1700 + sorteio() * 500);
        proximaGaivota = agora + 5 + sorteio() * 10;
      }
    }
  });
}
