// Laço do app (seção 2.8, D7): a cada quadro, sim.avancar(dt) roda os tiques da velocidade atual (pausa, 1x, 2x e 4x
// = 0, 1, 2 e 4 tiques por segundo real; até 8 por quadro; espelho.tempo.frac guarda a fração para o render
// interpolar), depois R.quadro(t), ui.quadro(t) e os ganchos do app (salvamento e diário da U2a entram por
// app.aoQuadro). Em segundo plano o jogo pausa (e o app avisa quem salva); ao voltar, retoma a velocidade de antes.
// A velocidade efetiva (tiques por segundo de verdade: cai quando uma tarefa do worker atrasa, D15) fica medida.

const TETO_DT = 250; // um quadro atrasado não vira um pulo de tempo

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

  function passo(tMs) {
    if (!rodando) return;
    pedido = requestAnimationFrame(passo);
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
    if (!oculto && antesDoFundo !== null) {
      const v = antesDoFundo;
      antesDoFundo = null;
      if (v > 0) retomar?.(v);
      tAnt = 0;
    }
  }

  return {
    iniciar() {
      if (rodando) return;
      rodando = true;
      tAnt = 0;
      document.addEventListener('visibilitychange', visibilidade);
      pedido = requestAnimationFrame(passo);
    },
    parar() {
      rodando = false;
      cancelAnimationFrame(pedido);
      document.removeEventListener('visibilitychange', visibilidade);
    },
    /** Tiques por segundo de verdade no último segundo. */
    get velocidadeEfetiva() {
      return medida.efetiva;
    },
    /** Um quadro na mão (testes e capturas com o laço parado). */
    quadro,
  };
}
