// Objetivos da primeira hora (desenho da UI 10.2 e 10.3; D58; dona: U2a): os objetivos são da simulação (q.barra) e
// a U1b mostra o cartão; aqui fica o anel de guia, um pulso champanhe no botão da categoria que resolve o objetivo
// aberto (Vias para a primeira avenida, Zonas para as quadras, Serviços para a água e a energia, Empresas para os
// prédios da Holding), enquanto nenhuma ferramenta nem tela está aberta e as dicas estão ligadas.
import { AnelGuia } from './Guia.jsx';
import { usarEstiloGuia } from './estilo.js';

export { CATEGORIA_DO_OBJETIVO, categoriaGuiada, categoriaAgora } from './regras.js';

export function registrar(ui) {
  if (!ui.jogo || ui.jogo.falso || ui.jogo.cena) return;
  usarEstiloGuia();
  ui.registrarHud('sobre', AnelGuia, { ordem: 60, nome: 'anelGuia' });
}
