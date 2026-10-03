// Carga e entrada (desenho da UI 8.19 e 7.5; dona: U2a). O primeiro quadro é HTML e CSS (fonte/web/index.html) e as
// fases andam pelo main.js; quando a carga sai, fica a entrada ("Clique para entrar" ou "Toque para entrar") e depois
// o menu inicial. Também aqui: a armadilha do voltar do Android (o gesto de voltar pela borda abre o menu em vez de
// fechar o jogo) e os atalhos de entrada pela página (?menu=0 sem menu inicial nem save, como as prévias e o robô;
// ?menu=nova e ?menu=continuar entram direto).
import { inicio, abrirInicio, fecharInicio, irPara, atualizarSaves, teclas } from './estado.js';
import { usarEstilo, CSS_INICIO } from './estilo.js';
import { Inicio, buscarCorpo } from './Entrada.jsx';
import { tela } from '../loja.js';
import { mostrarRetomar } from '../hud/Retomar.jsx';
import { filaModal } from '../telas/Momento.jsx';
import { PARTIDA_PADRAO } from './NovaPartida.jsx';

/** O início vale para esta página? Só no jogo de verdade (nem na vitrine, nem nas cenas, nem com ?menu=0). */
export function temInicio(ui, busca = typeof location !== 'undefined' ? location.search : '') {
  const jogo = ui?.jogo;
  const qs = new URLSearchParams(busca);
  if (!jogo || jogo.falso || jogo.cena || (jogo.tipo && jogo.tipo !== 'partida')) return false;
  if (typeof jogo.continuar !== 'function') return false;
  return qs.get('menu') !== '0';
}

/** Entra numa partida pelo menu (continuar, nova ou um espaço) e fecha o início; devolve a resposta do app. */
export async function entrarNaPartida(ui, modo, op = {}) {
  const jogo = ui.jogo;
  const est = inicio.peek();
  inicio.value = { ...(est ?? { etapa: 'menu' }), ocupado: modo, erro: null };
  let r;
  try {
    if (modo === 'continuar') r = await jogo.continuar();
    else if (modo === 'nova') r = await jogo.novaPartida({ ...PARTIDA_PADRAO, ...op });
    else if (modo === 'carregar') r = await jogo.carregar(op.slot);
    else if (modo === 'importar') r = await jogo.importar(op.arquivo);
  } catch (e) {
    console.error('entrar na partida', e);
    r = { ok: false, codigo: 'erro' };
  }
  if (r?.ok) {
    fecharInicio();
    ui.R?.estado?.('livre');
    armarVoltar(ui);
    // o 'carregado' sai na simulação nova antes de ela chegar à interface: o "Onde você parou" abre por aqui
    if (modo === 'continuar' || modo === 'carregar' || modo === 'importar') setTimeout(() => mostrarRetomar(ui), 400);
  } else if (inicio.peek()) {
    inicio.value = { ...inicio.peek(), ocupado: null, erro: r?.codigo ?? 'erro' };
  }
  return r;
}

// ------------------------------------------------------------------------------------------------ voltar do Android

let armado = false;
let ouvindo = false;

/** Empilha um estado no histórico: o voltar do Android cai no popstate em vez de sair do jogo. */
export function armarVoltar(ui) {
  if (typeof history === 'undefined' || armado) return;
  try {
    history.pushState({ heldopolis: 1 }, '');
    armado = true;
  } catch (e) {
    return;
  }
  if (ouvindo) return;
  ouvindo = true;
  addEventListener('popstate', () => {
    armado = false;
    const est = inicio.peek();
    if (est) {
      // no início, voltar sobe uma etapa; do menu inicial, o voltar sai de verdade
      if (est.etapa !== 'menu' && est.etapa !== 'entrada') {
        irPara('menu');
        armarVoltar(ui);
      }
      return;
    }
    // no jogo: fecha a tela aberta (o menu fechado é o Retomar) ou abre o menu
    if (tela.peek()) ui.fecharTela();
    else ui.abrirTela('menu');
    armarVoltar(ui);
  });
}

// ------------------------------------------------------------------------------------------------ teclado

let soltarTeclas = null;

/**
 * Com o início aberto, as teclas são dele: quem está à vista trata (teclas.atual) e nada passa para os atalhos do
 * jogo por trás (Espaço, 1 a 3, V, Esc do menu...). Dentro do início a tecla segue até o elemento (as abas andam pelas
 * setas) e para na raiz; fora dele (o foco no corpo da página) para já na captura.
 */
function ligarTeclas() {
  soltarTeclas?.();
  const captura = (ev) => {
    if (!inicio.peek()) return;
    const dentro = ev.target?.closest?.('.inicio');
    if (dentro) return;
    teclas.atual?.(ev);
    ev.stopPropagation();
  };
  const bolha = (ev) => {
    if (!inicio.peek() || !ev.target?.closest?.('.inicio')) return;
    teclas.atual?.(ev);
    ev.stopPropagation();
  };
  addEventListener('keydown', captura, true);
  document.addEventListener('keydown', bolha);
  soltarTeclas = () => {
    removeEventListener('keydown', captura, true);
    document.removeEventListener('keydown', bolha);
  };
}

// ------------------------------------------------------------------------------------------------ registro

export function registrar(ui) {
  if (!temInicio(ui)) return;
  usarEstilo('inicio', CSS_INICIO);
  const jogo = ui.jogo;
  const qs = new URLSearchParams(location.search);
  const direto = qs.get('menu');
  ui.registrarHud('sobre', Inicio, { ordem: 90, nome: 'inicio' });
  ligarTeclas();
  // o corpo do menu chega enquanto a carga roda (o toque na entrada não espera a rede)
  buscarCorpo().catch(() => {});
  atualizarSaves(jogo);
  jogo.on?.('salvo', () => atualizarSaves(jogo));
  // outra partida na tela (nova, carregada ou importada): os modais da de antes não passam para ela (pendência da U1b)
  jogo.on?.('trocouSim', () => (filaModal.value = []));
  jogo.on?.('menuInicial', () => {
    atualizarSaves(jogo);
    if (tela.peek()) ui.fecharTela();
    abrirInicio('menu');
    ui.R?.estado?.('coberto');
  });
  if (direto === 'nova' || direto === 'continuar') {
    // testes e robô: entra sem o gesto (o som fica preso até o primeiro toque)
    abrirInicio('menu', { ocupado: direto });
    setTimeout(async () => {
      const r = await entrarNaPartida(ui, direto);
      if (!r?.ok && direto === 'continuar') await entrarNaPartida(ui, 'nova');
    }, 0);
    return;
  }
  abrirInicio('entrada');
}
