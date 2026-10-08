// Textos da MOV2 (mover e girar prédios de zona, prontos e em obra, D105; dona: MOV2): a dica do botão Mover na folha do
// prédio de zona, as linhas do painel "o que muda" que só a zona tem (lotes de zona liberados e ocupados, a obra que segue
// do mesmo ponto) e a recusa de zona de outro tipo. Português do Brasil, frases curtas, sem travessão; dinheiro por
// ui/formato.js (D87) e tempo em "min de jogo" (D42). Os da MOV1 (mov1.js) seguem valendo para o resto.

export function registrar(registrarTextos) {
  registrarTextos('mov2', {
    // botão da folha
    'mov2.mover.dicaZona': 'Muda de lugar ou de direção por {custo}. Moradores, empregos e nível ficam com ele',
    'mov2.mover.dicaObra': 'Muda a obra de lugar por {custo}. Ela segue do ponto em que está e o que já foi pago fica',

    // painel "o que muda"
    'mov2.linha.custoObra': 'Mover custa {custo}, {pct} do que a obra já gastou',
    'mov2.linha.custoZeroObra': 'Mover não custa nada: a obra ainda não gastou material',
    'mov2.linha.zonaObra': 'A obra segue de onde está: {pct} pronta',
    'mov2.linha.zonaPronto': 'O prédio segue em uso, com os mesmos moradores e empregos, durante a obra de {tempo}',
    'mov2.linha.zonaCelulas': 'Libera {liberam} lotes de zona no lugar de agora e ocupa {ocupam} no lugar novo',
    'mov2.linha.zonaLivre': 'Libera {liberam} lotes de zona no lugar de agora; o lugar novo é chão livre',

    // recusa: zona de outro tipo pintada embaixo
    'mov2.dica.zonaOutra': 'Aqui a zona é de outro tipo. Escolha uma zona igual, ou chão livre ao longo da rua',
    'mov2.curto.zonaOutra': 'Zona de outro tipo',
  });
}
