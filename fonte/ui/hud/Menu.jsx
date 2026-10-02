// Menu do jogo (desenho da UI 7.6 e 8.19): a tela 'menu' que o botão do canto da barra abre (e o Esc, sem nada aberto;
// o voltar do Android é da U2a). Retomar, Salvar, Carregar, as telas de gestão, Configurações, Ajuda (glossário e
// atalhos) e Sair para o menu; cada item só aparece quando quem faz existe (a tela registrada ou a função do app). O
// corpo vem sob demanda (telas/corpo/Menu.jsx). Aqui ficam também os caminhos que as outras peças da U1b usam para
// abrir uma tela já numa aba e para ir até um alvo da simulação ({ x, z }, { tela: 'holding.mercado' },
// { ui: 'ferramenta.servicos' }).
import { selecao, tela, ferramenta } from '../loja.js';
import { ferramentas, categoria, sessao } from '../ferramentas/sessao.js';
import { abaEconomia } from '../telas/Economia.jsx';
import { folhaAberta } from '../selecao/Cartao.jsx';
import { sobDemanda } from '../telas/corpo/sobDemanda.jsx';

const abasPedidas = new Map();

/** Abre uma tela de gestão já numa aba (a tela pega a aba uma vez, por tomarAba). */
export function abrirTelaNaAba(ui, id, aba = null) {
  if (aba) {
    if (id === 'economia') abaEconomia.value = aba;
    else abasPedidas.set(id, aba);
  }
  return ui.abrirTela(id);
}

/** A aba que pediram para a tela (uma vez só) ou a padrão. */
export function tomarAba(id, padrao) {
  const a = abasPedidas.get(id);
  abasPedidas.delete(id);
  return a ?? padrao;
}

/** A tela da Arcologia que existir (Livro da X1b), como a barra de construção da X2 faz. */
export const telaArcologia = (ui) => (ui.telas().includes('arcologia') ? 'arcologia' : ui.telas().includes('livroArcologia') ? 'livroArcologia' : null);

/**
 * Vai até um alvo da simulação: { x, z } leva a câmera; { tela: 'id' | 'id.aba' } abre a tela; { ui:
 * 'ferramenta.<categoria>' } abre a categoria da barra de construção. Devolve false se não soube ir.
 */
export function irParaAlvo(ui, alvo) {
  if (!alvo) return false;
  if (Number.isFinite(alvo.x) && Number.isFinite(alvo.z)) {
    if (tela.peek()) ui.fecharTela();
    ui.R?.camera?.irPara?.({ x: alvo.x, z: alvo.z, dist: 420 }, 1200);
    return true;
  }
  if (typeof alvo.tela === 'string') {
    const [id, aba] = alvo.tela.split('.');
    const destino = id === 'arcologia' ? telaArcologia(ui) : id;
    return destino ? abrirTelaNaAba(ui, destino, aba ?? null) : false;
  }
  if (typeof alvo.ui === 'string' && alvo.ui.startsWith('ferramenta.')) {
    if (tela.peek()) ui.fecharTela();
    ferramentas.escolherCategoria(alvo.ui.slice('ferramenta.'.length));
    return true;
  }
  return false;
}

let soltar = null;

export function registrar(ui) {
  ui.registrarTela('menu', sobDemanda(() => import('../telas/corpo/Menu.jsx'), { id: 'menu', glifo: 'menu', titulo: 'menu.titulo' }));
  // Esc fecha a camada de cima; sem nada aberto, abre o menu (popovers e modais param o Esc antes de chegar aqui; a
  // tela aberta é o índice da interface que fecha, e a ferramenta é da X2)
  soltar?.();
  const tecla = (ev) => {
    if (ev.key !== 'Escape' || ev.defaultPrevented) return;
    const alvo = ev.target;
    if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return;
    if (tela.peek() || ferramenta.peek() || sessao.peek() || categoria.peek()) return;
    if (folhaAberta.peek()) {
      folhaAberta.value = false;
      return;
    }
    if (selecao.peek()) {
      selecao.value = null;
      ui.R?.selecionado?.(null);
      return;
    }
    // o índice da interface ouve o mesmo Esc depois deste e fecharia na hora a tela que acabou de abrir
    if (ui.abrirTela('menu')) ev.stopImmediatePropagation();
  };
  if (typeof addEventListener === 'function') addEventListener('keydown', tecla);
  soltar = () => removeEventListener('keydown', tecla);
}
