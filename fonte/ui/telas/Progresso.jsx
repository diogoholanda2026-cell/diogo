// Tela Progresso (desenho da UI 8.13; D51, D55): os marcos 0 a 7 com o requisito do marco 7 (a Blade Tower pronta),
// as áreas (ladrilhos e licenças) e o caminho para o Livro da Arcologia (X1b). Registro no principal, corpo sob
// demanda (corpo/Progresso.jsx). O anel do marco abre.
import { sobDemanda } from './corpo/sobDemanda.jsx';

export function registrar(ui) {
  ui.registrarTela('progresso', sobDemanda(() => import('./corpo/Progresso.jsx'), { id: 'progresso', glifo: 'marco', titulo: 'prog.titulo' }));
}
