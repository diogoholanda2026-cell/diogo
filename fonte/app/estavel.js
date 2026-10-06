// Estabilidade do app (TOQ1, D99): a perda e a volta do contexto WebGL e a retomada depois da recarga.
// O Android perde o contexto da página quando falta memória de vídeo ou depois de um tempo em segundo plano. O three
// refaz sozinho o que está na memória do processador, mas o que só existe na placa (o cubo do céu, a luz do ambiente,
// a textura do terreno pintada na placa, a sombra) volta vazio: medido no Chromium de teste com WEBGL_lose_context, o
// jogo voltava a desenhar com o chão chapado e escuro. Então a volta do contexto recarrega a página pelo caminho que
// já existe (?menu=continuar: o diário e o último save devolvem a partida ao tique de menos de 1 s atrás) e leva na
// sessão (sessionStorage) o que o save não tem: a câmera de agora e a velocidade do tempo. A recarga tem guarda: no
// máximo 2 em 60 s (um contexto que não se firma não prende o jogador num laço de recargas) e, se a volta não vem em 8
// s, recarrega do mesmo jeito. Sem ouvir nada do render: só o canvas, as ações do app e o armazenamento da sessão.

export const CHAVE_RETOMADA = 'heldopolis.retomada';
export const CHAVE_RECARGAS = 'heldopolis.recargas';
export const RETOMADA = Object.freeze({ validadeMs: 5 * 60 * 1000, esperaVoltaMs: 8000, maxRecargas: 2, janelaMs: 60 * 1000 });

/** O armazenamento da sessão, ou um que não guarda nada (janela privada, página de teste): toda leitura tolera falha. */
export function armazenamentoSessao() {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch (e) {
    // bloqueado
  }
  return { getItem: () => null, setItem() {}, removeItem() {} };
}

/** Guarda o que a página nova precisa para voltar de onde esta parou. */
export function guardarRetomada(storage, { camera = null, velocidade = 0 } = {}, agora = Date.now()) {
  try {
    storage.setItem(CHAVE_RETOMADA, JSON.stringify({ v: 1, camera, velocidade, t: agora }));
    return true;
  } catch (e) {
    return false;
  }
}

/** A retomada guardada, se for deste minuto e estiver inteira; senão null. Não apaga. */
export function lerRetomada(storage, agora = Date.now()) {
  try {
    const d = JSON.parse(storage.getItem(CHAVE_RETOMADA) ?? 'null');
    if (!d || d.v !== 1 || !Number.isFinite(d.t) || agora - d.t > RETOMADA.validadeMs || agora < d.t - 1000) return null;
    const c = d.camera;
    const camera = c && ['x', 'z', 'dist', 'guinada', 'inclinacao'].every((k) => Number.isFinite(c[k])) ? { x: c.x, z: c.z, dist: c.dist, guinada: c.guinada, inclinacao: c.inclinacao } : null;
    return { camera, velocidade: [0, 1, 2, 4].includes(d.velocidade) ? d.velocidade : 0, t: d.t };
  } catch (e) {
    return null;
  }
}

export function limparRetomada(storage) {
  try {
    storage.removeItem(CHAVE_RETOMADA);
  } catch (e) {
    // sem armazenamento
  }
}

/** Pode recarregar agora? Conta a recarga e nega depois de 2 em 60 s (o laço de recargas de um contexto que não firma). */
export function podeRecarregar(storage, agora = Date.now()) {
  let lista = [];
  try {
    const l = JSON.parse(storage.getItem(CHAVE_RECARGAS) ?? '[]');
    if (Array.isArray(l)) lista = l.filter((t) => Number.isFinite(t) && agora - t < RETOMADA.janelaMs);
  } catch (e) {
    lista = [];
  }
  if (lista.length >= RETOMADA.maxRecargas) return false;
  lista.push(agora);
  try {
    storage.setItem(CHAVE_RECARGAS, JSON.stringify(lista));
  } catch (e) {
    // sem armazenamento: recarrega mesmo assim (a guarda fica só no que a sessão deixa)
  }
  return true;
}

/**
 * O endereço da recarga: o mesmo, com ?menu=continuar (a recarga é da partida de agora, mesmo se a página abriu com
 * ?menu=nova). As cenas e o ?menu=0 (sem menu inicial e sem save) ficam como estão.
 */
export function enderecoDaRetomada(href) {
  const u = new URL(href);
  if (!u.searchParams.has('cena') && u.searchParams.get('menu') !== '0') u.searchParams.set('menu', 'continuar');
  return u.toString();
}

/**
 * Liga a perda e a volta do contexto do canvas.
 * @param {{ canvas: EventTarget, estado: () => { camera: object|null, velocidade: number }, pausar?: () => number,
 *           avisar?: (fase: 'perdeu'|'voltou'|'seguiu') => void, recarregar?: (url: string) => void, href?: () => string,
 *           storage?: object, agora?: () => number, agendar?: Function, cancelar?: Function }} op
 * @returns {{ perdido: () => boolean, desligar: () => void }}
 */
export function ligarContexto({
  canvas, estado, pausar = null, avisar = () => {}, recarregar = (url) => location.replace(url), href = () => location.href,
  storage = armazenamentoSessao(), agora = () => Date.now(), agendar = setTimeout, cancelar = clearTimeout,
}) {
  let perdido = false;
  let espera = null;
  let antes = null; // a velocidade do tempo de antes de pausar: é a que a página nova retoma
  const ir = () => {
    cancelar(espera);
    espera = null;
    if (!podeRecarregar(storage, agora())) {
      avisar('seguiu'); // sem mais recargas: o jogo segue como o three o deixou
      return;
    }
    let e = { camera: null, velocidade: 0 };
    try {
      e = estado();
    } catch (er) {
      // sem estado: recarrega sem a retomada
    }
    guardarRetomada(storage, { ...e, velocidade: antes ?? e.velocidade }, agora());
    recarregar(enderecoDaRetomada(href()));
  };
  const aoPerder = () => {
    if (perdido) return;
    perdido = true;
    try {
      antes = pausar?.() ?? null;
    } catch (e) {
      // sem simulação
    }
    avisar('perdeu');
    espera = agendar(ir, RETOMADA.esperaVoltaMs);
  };
  const aoVoltar = () => {
    if (!perdido) return;
    perdido = false;
    avisar('voltou');
    ir();
  };
  canvas.addEventListener('webglcontextlost', aoPerder);
  canvas.addEventListener('webglcontextrestored', aoVoltar);
  return {
    perdido: () => perdido,
    desligar() {
      cancelar(espera);
      canvas.removeEventListener('webglcontextlost', aoPerder);
      canvas.removeEventListener('webglcontextrestored', aoVoltar);
    },
  };
}
