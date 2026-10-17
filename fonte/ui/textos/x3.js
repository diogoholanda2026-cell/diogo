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

    // o que a escala mede, por extenso, e a palavra curta da marca do meio (X3b; `camada.<id>.unidade`, `<chave>.curto`)
    'camada.valor.unidade': 'Pontos de 0 a 1.000 em cada quadrado de {passo} m',
    'camada.esgoto.unidade': 'Cada prédio pela cor do tratamento; oferta e demanda em m³/h',
    'camada.transito.unidade': 'Fluxo dividido pela capacidade da via: 1 é a via cheia',
    'camada.ar.unidade': 'Índice de 0 a 255 em cada quadrado de {passo} m',
    'camada.ar.aviso.curto': 'Ar pesado',
    'camada.ruido.aviso.curto': 'Incomoda',
    'camada.ruido.unidade': 'Índice de 0 a 255 em cada quadrado de {passo} m',
    'camada.nivel.unidade': 'Nível de 1 a 5 de cada prédio de zona',
    'camada.empregos.semEmprego.curto': 'Sem emprego',
    'camada.empregos.semGente.curto': 'Vagas abertas',
    'camada.empregos.unidade': 'Fração das vagas abertas no trabalho; menos a fração sem emprego na moradia',

    // aba Problemas da tela Cidade (X3b)
    'cid.aba.problemas': 'Problemas',
    'x3.prob.titulo': 'Problemas da cidade: {n}',
    'x3.prob.lista': 'Problemas, do mais grave ao menos grave',
    'x3.prob.vazio': 'Nenhum problema agora. A cidade está em ordem.',
    'x3.prob.escolhido': 'Problema escolhido',
    'x3.prob.ver': 'Ver na camada',
    'x3.prob.proximo': 'Próximo',
    'x3.prob.semAlvo': 'Este problema não tem um lugar no mapa.',
    'x3.prob.so1': 'Só há um problema.',
    'x3.prob.dica': 'Liga a camada do problema e leva a câmera até ele. Setas e N passam ao próximo.',
    'x3.prob.dicaVarios': 'São {n} lugares. Cada toque em "Ver na camada" leva ao seguinte.',
    'x3.prob.camada': 'Camada {nome}',
    'x3.prob.grav.grave': 'Grave',
    'x3.prob.grav.atencao': 'Atenção',
    'x3.prob.grav.info': 'Informação',
    'x3.prob.plural.grave': 'graves',
    'x3.prob.plural.atencao': 'de atenção',
    'x3.prob.plural.info': 'de informação',
    'x3.prob.abandonado': 'Prédios abandonados: {n}',
    'x3.prob.quaseAbandonado': 'Prédios à beira do abandono: {n}',
    'x3.prob.pertoAbandono': 'Prédios perto do abandono: {n}',
    'x3.prob.arRuido': 'Prédios no ar ou no barulho pesado: {n}',
    'x3.prob.semAgua': 'Prédios sem água: {n}',
    'x3.prob.semEnergia': 'Prédios sem energia: {n}',
    'x3.prob.racionado': 'Prédios com energia racionada: {n}',
    'x3.prob.semAcesso': 'Prédios sem acesso à rua ou à rede: {n}',
    'x3.prob.semEsgoto': 'Prédios sem esgoto: {n}',
    'x3.prob.semMaterial': 'Prédios parados por falta de material: {n}',
    'x3.prob.semTrabalhadores': 'Prédios sem trabalhadores: {n}',
    'x3.prob.poucosClientes': 'Prédios com poucos clientes: {n}',
    'x3.prob.semEmprego': 'Prédios com moradores sem emprego: {n}',
    'x3.prob.bemEstarBaixo': 'Prédios com bem-estar muito baixo: {n}',
    'x3.prob.generico.grave': 'Prédios com problema grave: {n}',
    'x3.prob.generico.atencao': 'Prédios que pedem atenção: {n}',
    'x3.prob.generico.info': 'Prédios com um aviso: {n}',
  });
}
