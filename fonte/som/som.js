// Mixer do som (desenho da UI 11; dona: U2a): tudo procedural em Web Audio, sem arquivo de áudio. Mestre (com
// compressor) e quatro canais: Música, Ambiente, Mundo (efeitos do mundo) e Interface, cada um com o volume das
// preferências (heldopolis.prefs: som, musica, ambiente, efeitos, interface). O contexto só nasce no "Clique para
// entrar" (o navegador exige um gesto); em segundo plano o mestre silencia (prefs.silenciarFundo, ligado por padrão).
// Também aqui: a vibração (desenho da UI 9.6), que respeita prefs.vibrar e só existe no Android.
// API para quem toca: canal(nome) devolve o nó de ganho (ou null antes do gesto), tom() e ruido() desenham uma nota.

export const CANAIS = Object.freeze(['musica', 'ambiente', 'mundo', 'interface']);
/** Preferência de volume de cada canal (0 a 1) e o padrão. */
export const VOLUME_PADRAO = Object.freeze({ som: 0.8, musica: 0.35, ambiente: 0.6, efeitos: 0.8, interface: 0.7 });
const PREF_DO_CANAL = { musica: 'musica', ambiente: 'ambiente', mundo: 'efeitos', interface: 'interface' };

let ctx = null;
let mestre = null;
let comp = null;
const ganhos = {};
let ruidoBuf = null;
let prefsAtuais = { ...VOLUME_PADRAO, vibrar: true, silenciarFundo: true };
let fundo = false;

const clamp01 = (v, p) => (Number.isFinite(+v) ? Math.min(1, Math.max(0, +v)) : p);

/** Volume final de um canal pelas preferências. */
export function volumeDoCanal(prefs, canal) {
  const chave = PREF_DO_CANAL[canal];
  return clamp01(prefs?.[chave], VOLUME_PADRAO[chave]);
}

/** O contexto já nasceu e está tocando? */
export const ativo = () => !!ctx && ctx.state === 'running';

/** Cria (ou retoma) o contexto de áudio: chame dentro de um gesto do jogador. */
export function liberar() {
  if (typeof window === 'undefined') return false;
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    ctx = new AC({ latencyHint: 'interactive' });
  } catch (e) {
    return false;
  }
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 3;
  mestre = ctx.createGain();
  mestre.connect(comp);
  comp.connect(ctx.destination);
  for (const c of CANAIS) {
    ganhos[c] = ctx.createGain();
    ganhos[c].connect(mestre);
  }
  aplicar();
  return true;
}

/** Aplica os volumes (mestre e canais) com uma rampa curta. */
function aplicar() {
  if (!ctx) return;
  const agora = ctx.currentTime;
  const geral = fundo && prefsAtuais.silenciarFundo !== false ? 0 : clamp01(prefsAtuais.som, VOLUME_PADRAO.som);
  mestre.gain.setTargetAtTime(geral, agora, 0.05);
  for (const c of CANAIS) ganhos[c].gain.setTargetAtTime(volumeDoCanal(prefsAtuais, c), agora, 0.05);
}

/** Novas preferências (volumes, vibração, silenciar em segundo plano). */
export function definirPrefs(p = {}) {
  prefsAtuais = { ...prefsAtuais, ...p };
  aplicar();
}

/** O nó de ganho de um canal (null antes do gesto, com o contexto parado ou com o canal no zero). */
export function canal(nome) {
  if (!ativo() || volumeDoCanal(prefsAtuais, nome) <= 0) return null;
  return ganhos[nome] ?? null;
}

/** Segundo plano: silencia (e volta) o mestre. */
export function segundoPlano(oculto) {
  fundo = !!oculto;
  aplicar();
}

function ruido() {
  if (ruidoBuf) return ruidoBuf;
  ruidoBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = ruidoBuf.getChannelData(0);
  let s = 22222;
  for (let i = 0; i < d.length; i++) {
    s = (s * 16807) % 2147483647; // ruído reproduzível, sem sorteio
    d[i] = (s / 2147483647) * 2 - 1;
  }
  return ruidoBuf;
}

/**
 * Uma nota: oscilador com envelope de ataque e queda exponencial.
 * @param {{ f: number, t0?: number, dur?: number, tipo?: string, vol?: number, ataque?: number, ate?: number }} n
 *   t0 em segundos a partir de agora; ate: frequência no fim (glissando)
 */
export function tom(dest, { f, t0 = 0, dur = 0.12, tipo = 'sine', vol = 0.2, ataque = 0.005, ate = null }) {
  if (!dest || !ctx) return;
  const t = ctx.currentTime + t0;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(f, t);
  if (ate) o.frequency.exponentialRampToValueAtTime(ate, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Ruído filtrado curto (cliques, estalos, pincel). */
export function ruidoFiltrado(dest, { t0 = 0, dur = 0.05, freq = 2000, q = 1, vol = 0.1, filtro = 'bandpass' }) {
  if (!dest || !ctx) return;
  const t = ctx.currentTime + t0;
  const s = ctx.createBufferSource();
  s.buffer = ruido();
  const f = ctx.createBiquadFilter();
  f.type = filtro;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(dest);
  s.start(t, (t * 7.3) % 0.5);
  s.stop(t + dur + 0.02);
}

/** Vibração (Android): encaixe 8 ms, confirmar 15, toque longo 10, erro [30, 40, 30], marco [20, 60, 20]. */
export function vibrar(padrao) {
  if (prefsAtuais.vibrar === false || typeof navigator === 'undefined' || !navigator.vibrate) return false;
  try {
    return navigator.vibrate(padrao);
  } catch (e) {
    return false;
  }
}

/** registrar(app) vem de app/controle.js: lê as preferências e silencia em segundo plano. */
export function registrar(app) {
  definirPrefs(app?.prefs ?? {});
  app?.aoSegundoPlano?.((oculto) => segundoPlano(oculto));
}
