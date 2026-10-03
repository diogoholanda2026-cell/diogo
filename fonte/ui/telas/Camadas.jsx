// Camadas (desenho da UI 8.12; D29; X3a): o botão Camadas do trilho abre um popover (não uma tela: o mundo continua à
// vista e no toque) com as camadas e o filtro dos avisos; a camada ligada deixa o mundo neutro e pinta o dado
// (render/sobreposicoes/camadas.js), com a legenda embaixo ao centro. A camada liga pelo popover ou por quem escreve
// loja.camada (a folha, a faixa de alerta, a ferramenta de colocar). Aqui fica só o registro: o corpo (popover,
// legenda, rampas e a ponte com o render) vem sob demanda, na primeira vez que precisa (A1).
import { signal, effect } from '@preact/signals';
import { registrarItemTrilho } from '../hud/Trilho.jsx';

/** O popover está aberto? */
export const popoverAberto = signal(false);
const corpo = signal(null);
let pedido = null;

/** Busca o corpo (uma vez) e liga a ponte com o render. */
function carregar(ui) {
  pedido ??= import('./corpo/Camadas.jsx').then(
    (m) => {
      m.ligar(ui);
      corpo.value = m;
      return m;
    },
    (e) => {
      console.error('interface: as camadas não carregaram', e);
      pedido = null;
      return null;
    },
  );
  return pedido;
}

function Popover({ ui }) {
  if (!popoverAberto.value) return null;
  const M = corpo.value;
  if (!M) {
    carregar(ui);
    return null;
  }
  return <M.PopoverCamadas ui={ui} aberto={popoverAberto} />;
}

function Legenda({ ui }) {
  const id = ui.loja.camada.value;
  const M = corpo.value;
  if (!id || !M) return null;
  return <M.LegendaCamada ui={ui} />;
}

/** Abre ou fecha o popover (o botão do trilho e a tecla I do PC, desenho da UI 9.5). */
function alternar(ui) {
  popoverAberto.value = !popoverAberto.value;
  if (popoverAberto.value) carregar(ui);
}

let soltarTecla = null;

export function registrar(ui) {
  registrarItemTrilho({
    id: 'camadas',
    glifo: 'camadas',
    rotulo: 'trilho.camadas',
    ordem: 10,
    aoTocar: () => alternar(ui),
    ligado: () => popoverAberto.value || !!ui.loja.camada.value,
  });
  // tecla I: fora de campo de texto, sem modificador e sem tela de gestão aberta (o trilho some sob ela)
  soltarTecla?.();
  const tecla = (ev) => {
    if (ev.code !== 'KeyI' || ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey || ev.defaultPrevented) return;
    const alvo = ev.target;
    if (alvo && (/^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName) || alvo.isContentEditable)) return;
    if (ui.loja.tela.peek()) return;
    ev.preventDefault();
    alternar(ui);
  };
  if (typeof addEventListener === 'function') {
    addEventListener('keydown', tecla);
    soltarTecla = () => removeEventListener('keydown', tecla);
  }
  ui.registrarHud('sobre', Popover, { ordem: 55, nome: 'x3-camadas' });
  ui.registrarHud('mundo', Legenda, { ordem: 80, nome: 'x3-legenda' });
  // a camada pode ligar por outro caminho antes de o popover abrir
  effect(() => {
    if (ui.loja.camada.value) carregar(ui);
  });
  ui.aoQuadro((tMs) => corpo.peek()?.quadro(ui, tMs));
}
