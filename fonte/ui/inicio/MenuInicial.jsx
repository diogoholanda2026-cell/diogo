// Menu inicial (desenho da UI 7.6 e 8.19; D58 e D67; dona: U2a): fundo com a capa do último save (abre na hora e não
// gasta GPU), Continuar com o nome, a população, a data do calendário ("mar. 2021") e há quanto tempo foi salvo, Nova
// partida, Carregar, Configurações e Créditos, com os atalhos à vista no mouse. O corpo vem sob demanda
// (corpo/Inicio.jsx, pela entrada); aqui fica o registro da tela 'carregar' que o menu do jogo abre (salvar num
// espaço, carregar, exportar, importar e apagar).
import { sobDemanda } from '../telas/corpo/sobDemanda.jsx';

export function registrar(ui) {
  ui.registrarTela('carregar', sobDemanda(() => import('./corpo/Carregar.jsx'), { id: 'carregar', glifo: 'carregar', titulo: 'u2.carregar.titulo' }));
}
