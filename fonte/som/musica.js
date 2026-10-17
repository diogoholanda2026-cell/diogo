// Música generativa (producao.md 2.5; dona: U2b): TRILHA PROVISÓRIA gerada por código, sem arquivo de áudio. A origem
// definitiva da música (biblioteca licenciada, compositor ou ferramenta com licença) é decisão do dono; quando ela
// existir, este módulo cede o canal Música a ela e fica de reserva.
// Ambiente de cidade de luxo, calmo: um tapete de acordes em ré lídio (maj9, m11, maj7#11, 6/9) que se encadeiam por
// uma tabela de transições sorteada (nunca a mesma ordem duas vezes, então não há laço audível), com sinos de escala
// pentatônica esparsos por cima e um eco/reverb comum. De dia o tapete é aberto e os sinos aparecem; à noite o tapete
// desce uma oitava, fecha o filtro e os sinos rareiam. O volume é o canal Música das Configurações (som.js).
//   proximoAcorde({ anterior, noite, rng })  o plano de um acorde (puro: testes sem áudio)
//   criarMusica(ctx, destino, { semente })   agenda os acordes à frente do relógio do áudio
import { canal } from './som.js';

/** Frequência de uma nota MIDI. */
export const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

/** Os acordes (notas MIDI; o primeiro número é o baixo). Ré lídio: sem dissonância áspera, sem terça menor pesada. */
export const ACORDES = Object.freeze([
  { nome: 'Dmaj9', notas: [38, 54, 57, 61, 64] },
  { nome: 'Bm11', notas: [35, 54, 57, 62, 64] },
  { nome: 'Gmaj7#11', notas: [43, 55, 59, 62, 66] },
  { nome: 'A6/9', notas: [45, 57, 61, 64, 66] },
  { nome: 'Em9', notas: [40, 55, 59, 62, 66] },
  { nome: 'F#m7', notas: [42, 57, 61, 64, 69] },
]);

/** Para onde cada acorde pode ir (índices de ACORDES); nunca a si mesmo. */
export const TRANSICOES = Object.freeze([
  [1, 2, 3, 4], // Dmaj9
  [2, 3, 0, 5], // Bm11
  [0, 3, 4, 5], // Gmaj7#11
  [0, 1, 2, 4], // A6/9
  [3, 0, 2, 5], // Em9
  [1, 4, 0, 2], // F#m7
]);

/** Escala dos sinos: pentatônica de ré (ré, mi, fá#, lá, si) em duas oitavas. */
export const SINOS = Object.freeze([74, 76, 78, 81, 83, 86, 88, 90]);

/**
 * O plano de um acorde.
 * @param {{ anterior?: number | null, noite?: number, rng: () => number }} op  noite de 0 a 1
 * @returns {{ indice: number, nome: string, dur: number, pad: { f: number, vol: number }[], corte: number, sinos: { t0: number, f: number, vol: number, dur: number }[] }}
 */
export function proximoAcorde({ anterior = null, noite = 0, rng }) {
  const opcoes = anterior == null ? [0, 3, 2] : TRANSICOES[anterior];
  const indice = opcoes[Math.floor(rng() * opcoes.length)];
  const a = ACORDES[indice];
  const dur = 15 + rng() * 9; // 15 a 24 s
  // à noite o tapete desce uma oitava e fecha o filtro
  const desce = noite > 0.5 ? 12 : 0;
  const pad = a.notas.map((m, i) => ({ f: mtof(m - (i === 0 ? 0 : desce)), vol: i === 0 ? 0.055 : 0.04 - 0.004 * i }));
  const corte = 1500 - 900 * noite + rng() * 300;
  // sinos: de dia ~1 a cada 3 s; à noite ~1 a cada 9 s; nunca dois seguidos no mesmo tom
  const media = 3 + 6 * noite;
  const sinos = [];
  let t = 1.5 + rng() * media;
  let antes = -1;
  while (t < dur - 3) {
    let k = Math.floor(rng() * SINOS.length);
    if (k === antes) k = (k + 2) % SINOS.length;
    antes = k;
    sinos.push({ t0: t, f: mtof(SINOS[k] - (noite > 0.5 ? 12 : 0)), vol: 0.018 + rng() * 0.016, dur: 3.5 + rng() * 2 });
    t += media * (0.5 + rng() * 1.1);
  }
  return { indice, nome: a.nome, dur, pad, corte, sinos };
}

/** Gerador pequeno e reproduzível (a música não é a simulação, mas os testes querem repetir). */
export function geradorMusical(semente = 1) {
  let s = Math.abs(Math.floor(semente)) % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Resposta ao impulso de um salão macio: ruído que decai (3,2 s), com as altas morrendo antes. */
function impulso(ctx, seg = 3.2) {
  const n = Math.floor(ctx.sampleRate * seg);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let s = 1234 + c * 777;
    let lp = 0;
    for (let i = 0; i < n; i++) {
      s = (s * 16807) % 2147483647;
      const b = (s / 2147483647) * 2 - 1;
      const x = i / n;
      lp += (b - lp) * (0.55 - 0.45 * x); // as altas somem com o tempo
      d[i] = lp * (1 - x) ** 2.4;
    }
  }
  return buf;
}

/**
 * Liga a música a um destino. agendar(noite) deve ser chamado com frequência (a cada quarto de segundo, por exemplo):
 * ele agenda os acordes que começam nos próximos 8 s do relógio do áudio.
 * @returns {{ agendar(noite: number): void, parar(): void, acordes: string[] }}
 */
export function criarMusica(ctx, destino, { semente = 1 } = {}) {
  const rng = geradorMusical(semente);
  const barra = ctx.createGain();
  barra.gain.setValueAtTime(0, ctx.currentTime);
  barra.gain.linearRampToValueAtTime(1, ctx.currentTime + 8); // entra devagar
  barra.connect(destino);
  // eco macio (corda de 0,43 s com realimentação que perde as altas) e o salão
  const seco = ctx.createGain();
  seco.gain.value = 0.8;
  seco.connect(barra);
  const eco = ctx.createDelay(1);
  eco.delayTime.value = 0.43;
  const volta = ctx.createGain();
  volta.gain.value = 0.38;
  const tom = ctx.createBiquadFilter();
  tom.type = 'lowpass';
  tom.frequency.value = 2400;
  eco.connect(tom);
  tom.connect(volta);
  volta.connect(eco);
  const salao = ctx.createConvolver();
  salao.buffer = impulso(ctx);
  const molhado = ctx.createGain();
  molhado.gain.value = 0.5;
  const entrada = ctx.createGain();
  entrada.gain.value = 1;
  entrada.connect(eco);
  entrada.connect(salao);
  tom.connect(salao);
  salao.connect(molhado);
  molhado.connect(barra);

  const acordes = [];
  let anterior = null;
  let proximo = ctx.currentTime + 0.5; // quando o próximo acorde começa
  const vivos = new Set();
  let parou = false;

  function tocarAcorde(plano, t) {
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.setValueAtTime(plano.corte * 0.6, t);
    filtro.frequency.linearRampToValueAtTime(plano.corte, t + plano.dur * 0.5);
    filtro.frequency.linearRampToValueAtTime(plano.corte * 0.7, t + plano.dur + 4);
    filtro.Q.value = 0.4;
    const g = ctx.createGain();
    g.gain.value = 1;
    filtro.connect(g);
    g.connect(seco);
    g.connect(entrada);
    const fim = t + plano.dur + 6;
    for (const v of plano.pad) {
      // duas vozes por nota, desafinadas em 5 centésimos: o tapete respira sem tremer
      for (const [tipo, cents] of [['sine', -5], ['triangle', 5]]) {
        const o = ctx.createOscillator();
        o.type = tipo;
        o.frequency.value = v.f;
        o.detune.value = cents;
        const e = ctx.createGain();
        e.gain.setValueAtTime(0, t);
        e.gain.linearRampToValueAtTime(v.vol * (tipo === 'sine' ? 1 : 0.45), t + 4.5);
        e.gain.setValueAtTime(v.vol * (tipo === 'sine' ? 1 : 0.45), t + plano.dur);
        e.gain.linearRampToValueAtTime(0, fim);
        o.connect(e);
        e.connect(filtro);
        o.start(t);
        o.stop(fim + 0.1);
        vivos.add(o);
        o.onended = () => vivos.delete(o);
      }
    }
    for (const s of plano.sinos) {
      const ts = t + s.t0;
      for (const [mult, vol, tipo] of [[1, 1, 'sine'], [2.01, 0.25, 'sine'], [3.98, 0.06, 'sine']]) {
        const o = ctx.createOscillator();
        o.type = tipo;
        o.frequency.value = s.f * mult;
        const e = ctx.createGain();
        e.gain.setValueAtTime(0, ts);
        e.gain.linearRampToValueAtTime(s.vol * vol, ts + 0.012);
        e.gain.exponentialRampToValueAtTime(0.0001, ts + s.dur / mult ** 0.3);
        o.connect(e);
        e.connect(seco);
        e.connect(entrada);
        o.start(ts);
        o.stop(ts + s.dur + 0.1);
        vivos.add(o);
        o.onended = () => vivos.delete(o);
      }
    }
  }

  return {
    acordes,
    agendar(noite = 0) {
      if (parou) return;
      const agora = ctx.currentTime;
      // a aba ficou parada: recomeça do relógio de agora em vez de despejar os acordes atrasados
      if (proximo < agora) proximo = agora + 0.2;
      while (proximo < agora + 8) {
        const plano = proximoAcorde({ anterior, noite, rng });
        tocarAcorde(plano, proximo);
        acordes.push(plano.nome);
        if (acordes.length > 64) acordes.shift();
        anterior = plano.indice;
        proximo += plano.dur - 2.5; // os acordes se sobrepõem: um entra enquanto o outro ainda soa
      }
    },
    parar() {
      parou = true;
      for (const o of vivos) {
        try {
          o.stop();
        } catch (e) {
          // já parou
        }
      }
      vivos.clear();
      barra.disconnect();
    },
  };
}

/** registrar(app) vem de app/controle.js: começa quando o contexto existe e o canal Música tem volume. */
export function registrar(app) {
  if (typeof window === 'undefined' || !app?.aoQuadro) return;
  let musica = null;
  let ctxDaMusica = null;
  let ultimo = -Infinity;
  app.aoQuadro((tMs) => {
    if (tMs - ultimo < 250) return;
    ultimo = tMs;
    const g = canal('musica');
    if (!g) return;
    if (!musica || ctxDaMusica !== g.context) {
      musica?.parar();
      ctxDaMusica = g.context;
      musica = criarMusica(g.context, g, { semente: Math.floor(g.context.currentTime * 1000) + 91 });
    }
    const hora = app.sim?.espelho?.tempo?.hora ?? 10;
    musica.agendar(hora >= 19 ? Math.min(1, hora - 19) : hora < 5 ? Math.min(1, 5 - hora) : 0);
  });
}
