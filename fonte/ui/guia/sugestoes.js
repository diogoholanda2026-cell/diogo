// Traçados sugeridos (desenho da UI 10.3; D36 e D90; dona: U2a): o mapa novo da SEDE3 (q.sugestoes) sugere a primeira
// avenida, do nó de entrada ao portão norte da sede, as primeiras quadras fora do disco, a captação e a usina na rua
// principal da Vila e os primeiros prédios da Holding. Enquanto o objetivo de cada uma está aberto, o mundo mostra o
// fantasma tracejado (champanhe) e, com a ferramenta certa aberta, o botão "Usar sugestão" constrói por ela.
// O fantasma é desenhado na camada do mundo da interface (SVG, pontos por R.projetar a cada quadro): a prévia de via
// do render é da ferramenta da X2, que a limpa a cada movimento da mira.
import { Sugestoes } from './Guia.jsx';
import { usarEstiloGuia } from './estilo.js';

export { SUGESTAO_DO_OBJETIVO, ferramentaServe, sugestoesAbertas, caixaDaQuadra, comandosDaSugestao, usarSugestao, listaDoMapa, sugestoesAgora } from './regras.js';

export function registrar(ui) {
  usarEstiloGuia();
  ui.registrarHud('mundo', Sugestoes, { ordem: 30, nome: 'sugestoes' });
}
