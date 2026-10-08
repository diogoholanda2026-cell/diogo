// Textos do envio dos materiais da Arcologia (D109; dona: X1b): o seletor Automático ou Manual por etapa, a lista dos
// itens com o que precisa, o que já foi enviado, o que falta e o estoque, a quantidade e os botões de enviar.
// Português do Brasil, sem travessão; registrar(registrarTextos) vem de ui/textos.js.
export function registrar(registrarTextos) {
  registrarTextos('arc2', {
    'arc2.envio': 'Envio dos materiais',
    'arc2.envio.auto': 'Automático',
    'arc2.envio.manual': 'Manual',
    'arc2.envio.auto.nota': 'A Holding manda do armazém tudo o que falta e cabe no estoque.',
    'arc2.envio.manual.nota': 'Nada sai do armazém sozinho: você manda item a item. A obra só anda com o que já chegou.',
    'arc2.envio.trocado.auto': 'Envio automático ligado: a Holding manda o que falta.',
    'arc2.envio.trocado.manual': 'Envio manual ligado: a Holding não manda mais sozinha.',
    'arc2.item.situacao': 'Enviado {pedido} de {precisa} · falta {falta} · estoque {estoque}',
    'arc2.item.completo': 'Enviado {pedido} de {precisa}',
    'arc2.item.quantidade': 'Quantidade de {item}',
    'arc2.enviar': 'Enviar',
    'arc2.enviar.n': 'Enviar {n}',
    'arc2.enviarTudo': 'Enviar tudo que couber',
    'arc2.enviado': '{n} de {item} a caminho.',
    'arc2.enviadoTudo': 'Materiais a caminho do canteiro.',
    'arc2.semEstoque': 'Sem estoque no armazém',
  });
}
