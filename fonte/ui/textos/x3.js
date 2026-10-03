// Textos da X3 (camadas, marcadores e rótulos; dona: X3a, depois X3b). Português do Brasil, frases curtas, sem
// travessão. Os nomes das camadas e das legendas são de quem dá o dado ('camada.*' da S2a e da S1a, 'zona.*',
// 'recurso.*'); os nomes próprios da sede seguem em inglês (D88, D89), vindos de data/arcologia-plano.js.

export function registrar(registrarTextos) {
  registrarTextos('x3', {
    // popover das camadas (trilho)
    'x3.camadas.titulo': 'Camadas',
    'x3.camadas.grade': 'Escolher a camada',
    'x3.camadas.ligada': '{nome}: ligada',
    'x3.camadas.indisponivel': 'Esta camada ainda não tem dados.',
    'x3.camadas.avisos': 'Avisos sobre os prédios',
    'x3.filtro.todos': 'Todos',
    'x3.filtro.importantes': 'Graves e atenção',
    'x3.filtro.nenhum': 'Nenhum',

    // legenda (embaixo ao centro)
    'x3.legenda.rotulo': 'Legenda: {nome}',
    'x3.legenda.fechar': 'Desligar a camada',
    'x3.legenda.obrasParadas': '{n} obras paradas por falta de material',
    'x3.legenda.obraParada': '1 obra parada por falta de material',
    'x3.legenda.semObrasParadas': 'Nenhuma obra parada por falta de material',
    'x3.legenda.proxima': 'Próxima',
    'x3.legenda.sintetica': 'Dados de prova da cidade sintética',
    // faixas da Contribuição na legenda do Bem-estar (C1d; D11, D68, D87)
    'x3.legenda.faixas': 'Contribuição por morador em cada faixa de bem-estar',
    'x3.legenda.faixa': 'Bem-estar de {de} a {ate}: Contribuição de {valor} por morador',
  });
}
