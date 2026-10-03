// Configurações (desenho da UI 8.17; D66 e D70; dona: U2a): o registro da tela e o que vale desde a carga; o corpo
// vem sob demanda (inicio/corpo/Configuracoes.jsx): Vídeo (qualidade com o PC, resolução dinâmica e nitidez da PC1 e
// da PC2, "Sempre dia", painel e Teste de desempenho), Interface, Controles, Som, Jogo, Acessibilidade, Salvamento
// e Sobre. As preferências moram em 'heldopolis.prefs' (ui/prefs.js); aqui só o que precisa ser aplicado no render na
// carga (borda do mouse, resolução dinâmica e nitidez).
import { sobDemanda } from './corpo/sobDemanda.jsx';

/** O que o render faz com as preferências que não são a qualidade (o app troca a qualidade e o "Sempre dia"). */
export function aplicarNoRender(R, p = {}) {
  if (!R) return;
  if ('bordaMouse' in p) R.entrada?.opcoes?.({ bordaMouse: !!p.bordaMouse });
  // R.resolucao é o pedido ao render (pendência): sem ele, o perfil decide sozinho
  if ('resolucaoDinamica' in p || 'nitidez' in p) R.resolucao?.({ dinamica: p.resolucaoDinamica !== false, nitidez: p.nitidez ?? 'auto' });
}

export function registrar(ui) {
  ui.registrarTela('configuracoes', sobDemanda(() => import('../inicio/corpo/Configuracoes.jsx'), { id: 'configuracoes', glifo: 'ajustes', titulo: 'u2.cfg.titulo' }));
  aplicarNoRender(ui.R, ui.loja.prefs.peek() ?? {});
}
