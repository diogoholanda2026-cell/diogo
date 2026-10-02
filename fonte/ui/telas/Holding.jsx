// Tela Holding (desenho da UI 8.13; D25, D48, D55, D57): a identidade do jogador. O registro fica no pacote principal e
// o corpo vem sob demanda (corpo/Holding.jsx): visão geral, produção com lotes e a sugestão, Mercado (o Depósito) e os
// imóveis da Holding. O H da barra de cima abre.
import { sobDemanda } from './corpo/sobDemanda.jsx';

export function registrar(ui) {
  ui.registrarTela('holding', sobDemanda(() => import('./corpo/Holding.jsx'), { id: 'holding', glifo: 'holding', titulo: 'hold.titulo' }));
}
