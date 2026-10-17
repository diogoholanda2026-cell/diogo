// Textos da parcela ZON2 (D112 e D113): Distrito Industrial, Zona de Utilidades, rede de longo alcance e modo de crescimento
// da zona (Automático ou Manual por lote). Português do Brasil, sem travessão. registrar(registrarTextos) vem de ui/textos.js.
export function registrar(registrarTextos) {
  registrarTextos('zon2', {
    // recusas dos comandos (código -> frase)
    'codigo.distrito': 'Indústria só pode ser pintada dentro do Distrito Industrial.',
    'codigo.utilidades': 'Água, energia e internet ficam na Zona de Utilidades, longe da cidade.',
    'codigo.modo': 'Esta zona está no modo Automático. Mude para Manual para pedir um lote.',
    // áreas do mapa
    'zon2.distrito.nome': 'Distrito Industrial',
    'zon2.distrito.dica': 'Área reservada à indústria, longe do centro e a sotavento, para a fumaça não chegar aos bairros.',
    'zon2.distrito.fora': '{n} células ficaram de fora: só o Distrito Industrial aceita indústria.',
    'zon2.distrito.semCelulas': 'Nada aqui é do Distrito Industrial. Pinte dentro da área destacada.',
    'zon2.utilidades.nome': 'Zona de Utilidades',
    'zon2.utilidades.dica': 'Captação e tratamento de água, ETE, usinas, subestação e data center ficam aqui, afastados do perímetro urbano.',
    'zon2.utilidades.tipos': 'Só podem ser colocados aqui: {lista}.',
    'zon2.vento': 'Vento predominante: do {de} para o {para}.',
    'zon2.lugar.distrito': 'Distrito Industrial',
    'zon2.lugar.utilidades': 'Zona de Utilidades',
    // rede de longo alcance
    'zon2.rede.titulo': 'Rede de longo alcance',
    'zon2.rede.linha': 'Linha de {metros} m até a rede da cidade: {custo} ({porMetro} por metro).',
    'zon2.rede.agua': 'Adutora',
    'zon2.rede.energia': 'Linha de transmissão',
    'zon2.rede.esgoto': 'Emissário',
    'zon2.rede.semAlcance': 'A rede da cidade está longe demais ({metros} m). Construa vias com canos e cabos mais perto.',
    'zon2.rede.semRede': 'Ainda não há via com canos e cabos para receber a linha.',
    // modo de crescimento
    'zon2.modo.titulo': 'Crescimento da zona',
    'zon2.modo.automatico': 'Automático',
    'zon2.modo.automatico.dica': 'A demanda faz as construções nascerem sozinhas.',
    'zon2.modo.manual': 'Manual por lote',
    'zon2.modo.manual.dica': 'Nada nasce até você pedir um lote. A demanda só acumula.',
    'zon2.modo.trocou': '{zona}: modo {modo}.',
    'zon2.modo.cancelou': '{n} construções do lote foram canceladas.',
    'zon2.lote.titulo': 'Lote de construções',
    'zon2.lote.pergunta': 'Quantas construções começar? (de 1 a 1000)',
    'zon2.lote.comecar': 'Começar lote',
    'zon2.lote.cancelar': 'Cancelar o que falta',
    'zon2.lote.pedido': 'Faltam {n} construções do lote',
    'zon2.lote.nenhum': 'Nenhum lote em andamento',
    'zon2.lote.espera': 'A demanda pede {n} construções',
    'zon2.lote.semFrente': 'Sem lote livre pintado para este lote: pinte mais zona.',
    'zon2.lote.maximo': 'O lote não pode passar de 1000 construções.',
    'zon2.lote.pedidoOk': 'Lote de {n} construções pedido em {zona}.',
    'zon2.lote.canceladoOk': 'Lote de {zona} cancelado: {n} construções a menos.',
    'zon2.crescimento.resumo': '{construidos} prontas, {emObra} em obra, {frentes} frentes livres',
  });
}
