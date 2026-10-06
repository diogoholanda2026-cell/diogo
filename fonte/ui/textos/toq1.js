// Textos da parcela TOQ1 (D99): as Configurações do toque (sensibilidade do arrasto, da pinça e do giro e a inércia da
// câmera), que o corpo registra ao chegar (inicio/corpo/Toque.jsx), e os avisos da perda do contexto gráfico e da
// retomada, que o app registra na carga (app/controle.js). Português do Brasil, frases curtas, sem travessão, unidades
// da D42.
export function registrar(registrarTextos) {
  registrarTextos('toq1', {
    'toq1.titulo': 'Toque e câmera',
    'toq1.arrasto': 'Arrasto da câmera',
    'toq1.arrastoExp': 'Quanto o mapa anda para cada dedo que desliza. 100% prende o chão sob o dedo; menos anda mais devagar.',
    'toq1.pinca': 'Pinça de zoom',
    'toq1.pincaExp': 'Quanto a vista aproxima ou afasta com dois dedos. Só começa depois de um movimento claro, para um arrasto de dois dedos não virar zoom.',
    'toq1.giro': 'Giro com dois dedos',
    'toq1.giroExp': 'Quanto a vista gira quando os dois dedos giram.',
    'toq1.inercia': 'Deslize depois de soltar',
    'toq1.inerciaExp': 'A vista continua deslizando e para sozinha. Desligado, ela para onde o dedo soltou.',
    'toq1.padrao': 'Voltar ao padrão',
    'toq1.padraoBt': 'Padrão',
    'toq1.padraoExp': 'Tudo em 100%, com o deslize ligado.',
    'toq1.voltou': 'O toque voltou ao padrão.',
    'toq1.contexto.perdeu': 'Reconectando os gráficos...',
    'toq1.contexto.voltou': 'Gráficos de volta. Retomando a partida...',
    'toq1.retomou': 'Voltei ao ponto em que você estava.',
  });
}
