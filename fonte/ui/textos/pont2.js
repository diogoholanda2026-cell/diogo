// Textos da PONT2 (pontes e viadutos que o jogador cria, D53 e D106; dona: PONT2): a altura do viaduto e a ponte
// automática na barra da ferramenta de via, a linha do total e o motivo do vermelho quando falta altura livre, chão para o
// pilar ou rampa. Português do Brasil, frases curtas, sem travessão; medidas em metros.

export function registrar(registrarTextos) {
  registrarTextos('pont2', {
    // barra da ferramenta de via
    'pont2.cota': 'Altura do viaduto',
    'pont2.cota.0': 'Térreo',
    'pont2.cota.6': '+6 m',
    'pont2.cota.12': '+12 m',
    'pont2.cota.18': '+18 m',
    'pont2.ponte': 'Ponte automática',

    // linha do total
    'pont2.linha.ponte': 'Ponte de {m} m',
    'pont2.linha.viaduto': 'Viaduto a {h} m do chão',

    // motivo curto no botão (vermelho)
    'pont2.motivo.altura': 'Sem altura livre',
    'pont2.motivo.pilar': 'Sem chão para o pilar',
    'pont2.motivo.rampa': 'Curto para a altura',
    'pont2.motivo.greide': 'Rampa íngreme',

    // dica do vermelho
    'pont2.dica.altura': 'Falta altura livre de 5 m sobre a outra via: suba a cota ou comece a rampa mais longe do cruzamento',
    'pont2.dica.pilar': 'Um pilar cairia em prédio ou em água funda demais: mexa o traçado alguns metros',
    'pont2.dica.rampa': 'Trecho curto para esta altura: cada rampa sobe com 6%, então alongue o traço ou escolha uma cota menor',
    'pont2.dica.greide': 'Rampa de {p}% e o limite do viaduto é 8%: escolha um traçado mais plano ou uma cota menor',
  });
}
