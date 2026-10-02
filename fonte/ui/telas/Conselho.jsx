// Tela Conselho (desenho da UI 8.13 e 8.14; D35, D83): decisões pendentes em cartões, o histórico das escolhas e os
// conselheiros com nome completo e cargo. Registro no principal, corpo sob demanda (corpo/Conselho.jsx). O chip do
// Conselho na barra abre.
import { sobDemanda } from './corpo/sobDemanda.jsx';

export function registrar(ui) {
  ui.registrarTela('conselho', sobDemanda(() => import('./corpo/Conselho.jsx'), { id: 'conselho', glifo: 'conselho', titulo: 'cons.titulo' }));
}
