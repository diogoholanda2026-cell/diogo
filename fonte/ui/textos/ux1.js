// Textos da UX1 (colocar com giro livre, motivo do vermelho, escolha livre e obras em paralelo, D98; dona: UX1): a dica de
// cada bloqueio do fantasma (o motivo e o que fazer), os motivos curtos do botão e da cota, o giro e o alinhar à via, o
// que o catálogo diz do que está trancado e o que o Livro da Arcologia diz das obras em paralelo. Português do Brasil,
// frases curtas, sem travessão; dinheiro sempre por ui/formato.js (D87) e tempo em "min de jogo" (D42).

export function registrar(registrarTextos) {
  registrarTextos('ux1', {
    // dica do fantasma: o motivo e o que fazer (a barra e o painel do fantasma)
    'ux1.dica.aplainar': 'Terreno inclinado: aplainar por {custo} e mais {tempo} de obra',
    'ux1.dica.marco': 'Trancado: precisa do marco {marco}, {nome}',
    'ux1.dica.ladrilho.compravel': 'Fora das áreas da Holding: compre este ladrilho em Áreas',
    'ux1.dica.ladrilho.trancado': 'Fora das áreas da Holding: este ladrilho ainda não está à venda',
    'ux1.dica.gleba': 'Dentro da gleba da Arcologia: construa fora do disco da sede',
    'ux1.dica.agua.sobre': 'Em cima da água: afaste da margem',
    'ux1.dica.agua.margem': 'Precisa de água a até {m} m do fundo: chegue mais perto da margem',
    'ux1.dica.acesso.via': 'Sem via a menos de {max} m: ligue uma via perto daqui',
    'ux1.dica.acesso.livre': 'Sem via a menos de {max} m da planta: ligue uma via ou chegue mais perto de uma',
    'ux1.dica.colisao.via': 'Colide com a via: afaste {afastar} m',
    'ux1.dica.colisao.predio': 'Colide com outro prédio: afaste {afastar} m',
    'ux1.dica.colisao.predioNome': 'Colide com {nome}: afaste {afastar} m',
    'ux1.dica.declive': 'Terreno inclinado demais: {desnivel} m de desnível, e dá para aplainar até {max} m. Procure um lugar mais plano',
    'ux1.dica.recurso': 'Pouca {recurso} aqui: ligue a camada Recursos e escolha outro lugar',
    'ux1.dica.creditos': 'Faltam {faltam} no caixa',
    'ux1.dica.outro': 'Não dá para construir aqui',

    // motivos curtos (o botão de construir e a cota sobre o fantasma): a mesma chave sem "dica"
    'ux1.curto.aplainar': 'Aplainar {custo}',
    'ux1.curto.marco': 'Trancado: marco {marco}',
    'ux1.curto.ladrilho.compravel': 'Compre o ladrilho',
    'ux1.curto.ladrilho.trancado': 'Fora das áreas',
    'ux1.curto.gleba': 'Na gleba da Arcologia',
    'ux1.curto.agua.sobre': 'Sobre a água',
    'ux1.curto.agua.margem': 'Longe da água',
    'ux1.curto.acesso.via': 'Sem via perto',
    'ux1.curto.acesso.livre': 'Sem via perto',
    'ux1.curto.colisao.via': 'Colide: afaste {afastar} m',
    'ux1.curto.colisao.predio': 'Colide: afaste {afastar} m',
    'ux1.curto.colisao.predioNome': 'Colide: afaste {afastar} m',
    'ux1.curto.declive': 'Íngreme demais',
    'ux1.curto.recurso': 'Sem o recurso aqui',
    'ux1.curto.creditos': 'Faltam {faltam}',
    'ux1.curto.outro': 'Não dá para construir aqui',

    // dica da via: o motivo da recusa do traçado e o que fazer (os códigos de q.via.previa)
    'ux1.dicaVia.agua': 'Cruza água: pare a via na margem ou procure um trecho em terra',
    'ux1.dicaVia.vao': 'Vão de ponte longo demais: o máximo é 200 m',
    'ux1.dicaVia.declive': 'Declive de {p}% e esta via aceita até {max}%: contorne o morro ou use outro traçado',
    'ux1.dicaVia.declive.sem': 'Declive acima do que esta via aceita: contorne o morro ou use outro traçado',
    'ux1.dicaVia.angulo': 'Ângulo fechado com a outra via: abra para 30 graus ou mais',
    'ux1.dicaVia.curto': 'Trecho curto demais: estenda a via',
    'ux1.dicaVia.raio': 'Curva fechada demais: abra a curva ou use um tipo de via que aceite',
    'ux1.dicaVia.ladrilho': 'Fora das áreas da Holding: compre a área em Áreas',
    'ux1.dicaVia.gleba': 'Dentro da gleba da Arcologia: as vias da sede vêm com a etapa do Mirror Lake',
    'ux1.dicaVia.colisao': 'Bate em algo que não sai do lugar: desvie o traçado',
    'ux1.dicaVia.marco': 'Trancado: este tipo de via abre no marco {marco}, {nome}',
    'ux1.dicaVia.creditos': 'Faltam {faltam} no caixa para esta via',
    'ux1.dicaVia.outro': 'Não dá para traçar a via aqui',

    // recursos naturais na frase da dica (os ids da grade de recursos)
    'ux1.recurso.rocha': 'rocha',
    'ux1.recurso.areia': 'areia',
    'ux1.recurso.argila': 'argila',
    'ux1.recurso.calcario': 'calcário',
    'ux1.recurso.agua': 'água',

    // giro livre e alinhar à via (o painel do fantasma)
    'ux1.painel': 'Posição do fantasma',
    'ux1.alinhar': 'Alinhar à via',
    'ux1.alinhar.dica': 'Gruda na calçada da via mais perto e vira de frente para ela',
    'ux1.alinhar.dicaPc': 'Gruda na calçada da via mais perto e vira de frente para ela (tecla C)',
    'ux1.alinhar.desligado': 'Livre: a planta fica onde você largar, no ângulo que escolher',
    'ux1.giro': '{g}°',
    'ux1.giro.rotulo': 'Giro de {g} graus',
    'ux1.giro.menos': 'Girar 15° para a esquerda',
    'ux1.giro.mais': 'Girar 15° para a direita',
    'ux1.giro.puxador': 'Puxador de giro: arraste para girar de 15 em 15 graus',
    'ux1.giro.dicaPc': 'Q e E giram 15 graus; segure Shift no puxador para girar sem ímã',
    'ux1.giro.quarto': 'Girar 90°',

    // catálogo: o que está trancado diz qual marco falta
    'ux1.catalogo.trancado': 'Libera no marco {n}, {nome}',
    'ux1.catalogo.livre': 'Escolha livre: construa o que o marco já liberou, na ordem que quiser',

    // Livro da Arcologia: obras em paralelo
    'ux1.livro.equipes': 'Equipes de obra',
    'ux1.livro.equipes.valor': '{n} de {de} ocupadas',
    'ux1.livro.equipes.sub': 'O que não depende de outra obra anda junto; créditos, materiais e equipes limitam',
    'ux1.livro.recusa.ocupado': 'Equipes ocupadas: termine uma obra para começar esta',
    'ux1.livro.depende': 'Depende de {etapa}',
    'ux1.livro.paralelo': 'Em obra junto com {etapa}',
    'ux1.livro.livre': 'Pode começar já: não depende de outra obra',
  });
}
