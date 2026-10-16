// Textos da S3b (M1b): as 3 decisões novas do Ato 1 com os conselheiros, a Vila nova, os objetivos da cadeia do cimento e
// dos alimentos, e os prédios e itens novos da Holding. Português do Brasil, sem travessão, taxas em "/h" de jogo (D42).
// Nenhum valor em dinheiro nas frases (D87): o preço vem em número e a interface mostra em dólar. As chaves seguem o
// prefixo 's3.' de ui/textos/s3.js (mesma família de telas); a parcela dona é 's3b'.
export function registrar(registrarTextos) {
  registrarTextos('s3b', {
    // itens e prédios novos da Holding (a cadeia de alimentos para o comércio)
    's3.item.graos': 'Grãos',
    's3.item.alimentos': 'Alimentos',
    's3.holding.fazenda': 'Fazenda',
    's3.holding.fazenda.faz': 'colhe grãos na terra fértil da planície',
    's3.holding.agroindustria': 'Agroindústria',
    's3.holding.agroindustria.faz': 'beneficia grãos em alimentos para o comércio',

    // objetivos do M1b: a cadeia do cimento, os alimentos, os vidros e a Vila nova (Legado do Ato 1)
    's3.objetivo.holding.mina': 'Abra a Mina de calcário na encosta a noroeste (compre o ladrilho vizinho com a licença do marco)',
    's3.objetivo.holding.cimenteira': 'Abra a Cimenteira: o calcário da Mina e a argila da Olaria viram cimento',
    's3.objetivo.holding.alimentos': 'Abra a Agroindústria, com a Fazenda de grãos, para abastecer o comércio',
    's3.objetivo.holding.vidraria': 'Abra a Vidraria: areia e calcário viram o vidro das torres',
    's3.objetivo.cidade.vilaNova': 'Requalifique a Vila de Santa Cida: água e luz em 90% das casas, bem-estar {bem} e caixa para a reforma ({n} casas)',

    // decisões do M1b (com as 3 do M1a, as 6 do Ato 1)
    's3.decisao.energia.2022.titulo': 'A Crise da Energia de 2022',
    's3.decisao.energia.2022.texto': 'A Guerra de Volkara fechou os gasodutos: a energia que chega pela rodovia fica 60% mais cara por um ano e a importação sobe 10%. Lívia quer travar o preço num contrato de longo prazo. Caio prefere que a Holding monte a própria usina solar e dependa menos da rodovia.',
    's3.decisao.energia.2022.contrato': 'Contrato de energia de longo prazo',
    's3.decisao.energia.2022.contrato.ganho': 'A energia e a importação seguem nos preços de antes da crise; Influência +6',
    's3.decisao.energia.2022.contrato.custo': 'Paga agora o contrato',
    's3.decisao.energia.2022.solar': 'Usina solar da Holding',
    's3.decisao.energia.2022.solar.ganho': 'A energia que vem da rodovia fica 30% mais barata por 5 anos; Legado +6',
    's3.decisao.energia.2022.solar.custo': 'Paga agora a usina; a energia e a importação sobem por 12 meses, antes de ela entrar',
    's3.decisao.mina.licenca.titulo': 'Licença da Mina de calcário',
    's3.decisao.mina.licenca.texto': 'A Mina vai abrir na encosta da Serra do Held, de onde sai o calcário do cimento. Nara quer a lavra em bancadas, com a encosta recuperada a cada etapa. Tomé quer a lavra aberta e turnos dobrados, para o cimento não faltar à obra.',
    's3.decisao.mina.licenca.recuperar': 'Lavra em bancadas, com a encosta recuperada',
    's3.decisao.mina.licenca.recuperar.ganho': 'Legado +6; a encosta volta a ser mata a cada etapa',
    's3.decisao.mina.licenca.recuperar.custo': 'A Mina rende 10% menos; paga o plano de recuperação agora',
    's3.decisao.mina.licenca.acelerar': 'Lavra aberta, com turnos dobrados',
    's3.decisao.mina.licenca.acelerar.ganho': 'A Mina e a Cimenteira rendem 20% mais; Influência +5',
    's3.decisao.mina.licenca.acelerar.custo': 'Paga os equipamentos agora; a encosta fica exposta',
    's3.decisao.vila.futuro.titulo': 'O futuro da Vila de Santa Cida',
    's3.decisao.vila.futuro.texto': 'A Vila já tem água e luz, mas as casas ainda são as de autoconstrução. Dona Cida quer reformar casa por casa, com as famílias dentro. Íris propõe um projeto novo, com lotes refeitos e uma praça. Em qualquer caso a Holding paga quando a Vila estiver pronta.',
    's3.decisao.vila.futuro.reformar': 'Reformar casa por casa',
    's3.decisao.vila.futuro.reformar.ganho': 'Bem-estar +3 na Vila por 2 anos; Legado +3; abre o objetivo de requalificar a Vila',
    's3.decisao.vila.futuro.reformar.custo': 'Cada casa sai do caixa da Holding, numa obra curta de 2 min de jogo',
    's3.decisao.vila.futuro.substituir': 'Projeto novo da arquiteta-chefe',
    's3.decisao.vila.futuro.substituir.ganho': 'Mais comércio de rua por 2 anos; Influência +5; abre o objetivo de requalificar a Vila',
    's3.decisao.vila.futuro.substituir.custo': 'Cada casa sai mais cara e a obra leva 5 min de jogo',

    // Mural: o que cada decisão deixou e a Vila nova
    's3.mural.decisao.energia.2022.contrato': 'Contrato de longo prazo assinado: a energia da Holding não sentiu a crise.',
    's3.mural.decisao.energia.2022.solar': 'A Holding vai gerar a própria energia. Caio já desenha os painéis.',
    's3.mural.decisao.mina.licenca.recuperar': 'A Mina abre em bancadas e a encosta será replantada a cada etapa.',
    's3.mural.decisao.mina.licenca.acelerar': 'A Mina abre a toque de caixa, com turnos dobrados, e o cimento não vai faltar.',
    's3.mural.decisao.vila.futuro.reformar': 'As famílias ficam em casa: a Vila será reformada casa por casa.',
    's3.mural.decisao.vila.futuro.substituir': 'A Vila ganha um projeto novo, com lotes refeitos e uma praça.',
    's3.mural.vilaNova.reformar': 'A Vila de Santa Cida foi requalificada: {n} casas reformadas, com as famílias dentro.',
    's3.mural.vilaNova.substituir': 'A Vila de Santa Cida foi requalificada: {n} casas refeitas no projeto novo.',
  });
}
