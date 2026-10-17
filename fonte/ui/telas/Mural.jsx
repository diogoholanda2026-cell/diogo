// Mural (desenho da UI 8.13 e 7.1; D77 a D86; dona: U2b): as notícias da cidade e das decisões, lidas de q.mural() (a
// simulação da S3a posta marcos, eventos do calendário, falas das decisões do Conselho, a Vila nova e as etapas da
// Arcologia da X1b). Registro no principal (o botão do trilho aparece quando a tela existe) e corpo sob demanda
// (corpo/Mural.jsx).
import { sobDemanda } from './corpo/sobDemanda.jsx';

export function registrar(ui) {
  ui.registrarTela('mural', sobDemanda(() => import('./corpo/Mural.jsx'), { id: 'mural', glifo: 'mural', titulo: 'u2b.mural.titulo' }));
}
