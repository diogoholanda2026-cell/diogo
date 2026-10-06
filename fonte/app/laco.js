// Laço do app (seção 2.8, D7): a cada quadro, sim.avancar(dt) roda os tiques da velocidade atual (pausa, 1x, 2x e 4x
// = 0, 1, 2 e 4 tiques por segundo real; até 8 por quadro; espelho.tempo.frac guarda a fração para o render
// interpolar), depois R.quadro(t), ui.quadro(t) e os ganchos do app (salvamento e diário da U2a entram por
// app.aoQuadro). Em segundo plano o jogo pausa (e o app avisa quem salva); ao voltar, retoma a velocidade de antes e o
// relógio do quadro recomeça (nenhum quadro leva o tempo que a aba passou no fundo); pageshow (a página volta do cache
// de voltar e avançar) faz o mesmo. No celular o quadro roda no máximo a 60 por segundo (TOQ1, D99: LIMITE_HZ_CELULAR).
// A velocidade efetiva (tiques por segundo de verdade: cai quando uma tarefa do worker atrasa, D15) fica medida.

const TETO_DT = 250; // um quadro atrasado não vira um pulo de tempo
/**
 * No celular (perfis Média e Leve) o quadro inteiro (simulação, domínios do render, interface e ganchos) roda no máximo 60
 * vezes por segundo: numa tela de 90 ou 120 Hz o Poco X7 fazia todo esse trabalho a cada atualização da tela, o dobro do
 * que a imagem pede (a Média desenha a 30 qps). O PC (e Alta e Ultra) segue a cada atualização.
 */
export const LIMITE_HZ_CELULAR = 60;

/**
 * @param {{ obterSim: () => object, R: object, ui: object, aoQuadro?: Function[], aoSegundoPlano?: (oculto) => void,
 *           pausar?: () => number, retomar?: (v: number) => void }} op
 *   pausar() devolve a velocidade de antes; retomar(v) volta a ela (o controle usa as ações da UI)
 */
export function criarLaco({ obterSim, R, ui, aoQuadro = [], aoSegundoPlano = null, pausar = null, retomar = null }) {
  let rodando = false;
  let tAnt = 0;
  let pedido = 0;
  let antesDoFundo = null;
  const medida = { tiques: 0, desde: 0, efetiva: 0 };

  // o ritmo do limite de 60 por segundo no celular: a média fica no limite, sem acumular atraso (o mesmo ritmo do teto
  // de qps do render, motor/quadro.js)
  let proximo = -Infinity;
  function pular(tMs) {
    let id = null;
    try {
      id = R?.perfil?.().id;
    } catch (e) {
      id = null;
    }
    if (id !== 'media' && id !== 'leve') return false;
    const I = 1000 / LIMITE_HZ_CELULAR;
    if (tMs < proximo - 1) return true;
    const p = Math.min(proximo + I, tMs + I);
    proximo = p < tMs ? tMs + I : p;
    return false;
  }

  function passo(tMs) {
    if (!rodando) return;
    pedido = requestAnimationFrame(passo);
    if (pular(tMs)) return;
    quadro(tMs);
  }

  function quadro(tMs) {
    const dt = tAnt ? Math.min(TETO_DT, Math.max(0, tMs - tAnt)) : 16.7;
    tAnt = tMs;
    const sim = obterSim();
    try {
      const n = sim?.avancar?.(dt) ?? 0;
      medida.tiques += n;
    } catch (e) {
      console.error('laço: a simulação falhou', e);
    }
    if (medida.desde < 0) medida.desde = tMs;
    if (tMs - medida.desde >= 1000) {
      medida.efetiva = (medida.tiques * 1000) / Math.max(1, tMs - medida.desde);
      medida.tiques = 0;
      medida.desde = tMs;
    }
    try {
      R?.quadro(tMs);
    } catch (e) {
      console.error('laço: o render falhou', e);
    }
    try {
      ui?.quadro(tMs);
    } catch (e) {
      console.error('laço: a interface falhou', e);
    }
    for (const fn of aoQuadro) {
      try {
        fn(tMs, dt);
      } catch (e) {
        console.error('laço: gancho falhou', e);
      }
    }
  }

  function visibilidade() {
    const oculto = document.visibilityState === 'hidden';
    if (oculto && pausar && antesDoFundo === null) antesDoFundo = pausar();
    try {
      aoSegundoPlano?.(oculto);
    } catch (e) {
      console.error('laço: segundo plano', e);
    }
    if (!oculto) {
      tAnt = 0;
      proximo = -Infinity;
      medida.desde = -1; // a medida da velocidade efetiva recomeça no primeiro quadro
      medida.tiques = 0;
    }
    if (!oculto && antesDoFundo !== null) {
      const v = antesDoFundo;
      antesDoFundo = null;
      if (v > 0) retomar?.(v);
    }
  }
  const voltouDoCache = (ev) => {
    if (ev.persisted) visibilidade();
  };

  return {
    iniciar() {
      if (rodando) return;
      rodando = true;
      tAnt = 0;
      document.addEventListener('visibilitychange', visibilidade);
      if (typeof addEventListener !== 'undefined') addEventListener('pageshow', voltouDoCache);
      pedido = requestAnimationFrame(passo);
    },
    parar() {
      rodando = false;
      cancelAnimationFrame(pedido);
      document.removeEventListener('visibilitychange', visibilidade);
      if (typeof removeEventListener !== 'undefined') removeEventListener('pageshow', voltouDoCache);
    },
    /** Tiques por segundo de verdade no último segundo. */
    get velocidadeEfetiva() {
      return medida.efetiva;
    },
    /** Um quadro na mão (testes e capturas com o laço parado). */
    quadro,
  };
}
