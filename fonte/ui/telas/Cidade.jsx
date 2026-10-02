// Tela Cidade (desenho da UI 8.13; D11, D50): visão geral, demanda com fatores, bem-estar com a margem até o degrau e
// os serviços. Registro no principal, corpo sob demanda (corpo/Cidade.jsx). População, bem-estar e demanda abrem.
import { sobDemanda } from './corpo/sobDemanda.jsx';

export function registrar(ui) {
  ui.registrarTela('cidade', sobDemanda(() => import('./corpo/Cidade.jsx'), { id: 'cidade', glifo: 'populacao', titulo: 'cid.titulo' }));
}
