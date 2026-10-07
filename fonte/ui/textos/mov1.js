// Textos da MOV1 (mover e girar construções prontas, D94; dona: MOV1): o botão Mover da folha, o que impede de mover, a
// barra e a dica do fantasma, o painel "o que muda" (alcance antes e depois, a via a que se liga, o que deixa de cobrir) e o
// aviso de depois de mover. Português do Brasil, frases curtas, sem travessão; dinheiro sempre por ui/formato.js (D87) e
// tempo em "min de jogo" (D42). O texto do código de recusa 'fixo' também mora aqui até o integrador listá-lo no contrato.

export function registrar(registrarTextos) {
  registrarTextos('mov1', {
    // botão da folha e dicas
    'mov1.mover': 'Mover',
    'mov1.mover.dica': 'Muda de lugar ou de direção por {custo}, com uma obra curta',
    'mov1.mover.dicaToque': 'Segure o prédio selecionado e arraste para movê-lo',
    'mov1.mover.emObra': 'Em obra: espere terminar para mover',
    'mov1.mover.fecharAntes': 'Feche a ferramenta aberta antes de mover',

    // o que impede de mover (dados.fixo da recusa): a dica de cada um
    'mov1.fixo.zona': 'Prédio de zona não muda de lugar: a zona se refaz sozinha. Demola e zoneie onde quiser',
    'mov1.fixo.arcologia': 'A Arcologia fica onde está',
    'mov1.fixo.obra': 'Em obra: espere terminar para mover de novo',
    'codigo.fixo': 'Esta construção não muda de lugar.',

    // barra da ferramenta
    'mov1.barra.nome': 'Mover {nome}',
    'mov1.ferramenta': 'Mover',

    // dica do fantasma (o motivo e o que fazer, no mesmo formato da ux1) e o motivo curto do botão e da cota
    'mov1.dica.nada': 'Arraste o prédio para o novo lugar, ou gire para mudar a direção dele',
    'mov1.curto.nada': 'Escolha o novo lugar',
    'mov1.dica.obra': 'Em obra: espere terminar para mover de novo',
    'mov1.curto.obra': 'Em obra',
    'mov1.dica.fixo.zona': 'Prédio de zona não muda de lugar: a zona se refaz sozinha',
    'mov1.curto.fixo.zona': 'Prédio de zona',
    'mov1.dica.fixo.arcologia': 'A Arcologia fica onde está',
    'mov1.curto.fixo.arcologia': 'Arcologia fixa',
    'mov1.dica.fixo.obra': 'Em obra: espere terminar para mover de novo',
    'mov1.curto.fixo.obra': 'Em obra',

    // painel "o que muda"
    'mov1.painel': 'O que muda ao mover',
    'mov1.painel.titulo': 'Mover {nome}',
    'mov1.painel.parado': 'Arraste para escolher o lugar. Gire pelo puxador, por Q e E ou com dois dedos',
    'mov1.linha.custo': 'Mover custa {custo}, {pct} do valor',
    'mov1.linha.demolir1': 'Derruba 1 prédio de zona no lugar novo: {custo}',
    'mov1.linha.demolirN': 'Derruba {n} prédios de zona no lugar novo: {custo}',
    'mov1.linha.obra': 'Fica fora de serviço por {tempo} de jogo',
    'mov1.linha.cobertura': 'Atende {antes} moradores hoje e {depois} depois ({categoria})',
    'mov1.linha.deixam': '{n} moradores deixam de ser atendidos',
    'mov1.linha.passam': '{n} moradores passam a ser atendidos',
    'mov1.linha.via': 'Liga à {nome}',
    'mov1.linha.viaDe': 'Liga à {nome}, hoje na {antes}',
    'mov1.linha.viaSemNome': 'Liga a outra via',
    'mov1.linha.semVia': 'Sem via por perto: fica sem acesso',
    'mov1.linha.semRede': 'A via nova não leva canos nem cabos: não liga na rede até melhorar a via',
    'mov1.linha.rede': 'A via nova leva canos e cabos: liga na rede',
    'mov1.linha.armazem': 'Fica a {depois} m do armazém (hoje a {antes} m): produtividade {efeito}',
    'mov1.linha.armazemIgual': 'Fica a {depois} m do armazém (hoje a {antes} m)',
    'mov1.linha.desfazer': 'Dá para desfazer até a obra começar, em {tempo} de jogo',

    // depois de mover
    'mov1.movido': '{nome} em obra por {tempo} de jogo',
    'mov1.desfeito': '{nome} voltou para onde estava',
    'mov1.desfazer.tarde': 'A obra já começou: não dá mais para desfazer',
  });
}
