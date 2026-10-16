// Textos da parcela S2b (cidade completa, M1b): esgoto, poluição do ar, ruído, mercadoria e as camadas Esgoto, Poluição do
// ar, Ruído e Empregos. Português do Brasil, sem travessão; taxas em "/h" (hora de jogo, D42). registrar(registrarTextos)
// vem de ui/textos.js. Chaves novas, sem repetir as da S2a (s2.js) nem as da U1 (u1.js).
export function registrar(registrarTextos) {
  registrarTextos('s2b', {
    // alertas da cidade
    'aviso.faltaEsgoto': 'Falta esgoto: {n} prédios sem tratamento',
    'aviso.poluicaoAr': 'Ar pesado: {pct}% dos moradores respiram a fumaça da indústria',
    'aviso.poluicaoRuido': 'Ruído alto: {pct}% dos moradores vivem perto de fábricas e avenidas',
    'aviso.mercadoriaImportada': 'O comércio importa {pct}% da mercadoria: falta indústria zoneada',
    // aviso do prédio
    'aviso.poluicao': 'Ar ou ruído pesado: tira bem-estar e valor do terreno',
    // ações dos avisos
    'acao.verCamadaEsgoto': 'Ver camada de esgoto',
    'acao.verCamadaAr': 'Ver camada de poluição do ar',
    // camadas
    'camada.esgoto': 'Esgoto',
    'camada.esgoto.ok': 'Com esgoto',
    'camada.esgoto.racionado': 'Esgoto no limite',
    'camada.esgoto.sem': 'Sem esgoto',
    'camada.esgoto.produtor': 'Trata esgoto',
    'camada.esgoto.resumo': 'A cidade devolve {demanda} m³/h e as estações tratam {oferta} m³/h',
    'camada.ar': 'Poluição do ar',
    'camada.ar.limpo': 'Ar limpo',
    'camada.ar.aviso': 'Ar pesado: tira bem-estar',
    'camada.ar.alto': 'Muito poluído',
    'camada.ar.resumo': 'Pico de {pico} no mapa; {moradores} moradores no ar pesado',
    'camada.ruido': 'Ruído',
    'camada.ruido.limpo': 'Silencioso',
    'camada.ruido.aviso': 'Barulho que incomoda',
    'camada.ruido.alto': 'Muito barulhento',
    'camada.ruido.resumo': 'Pico de {pico} no mapa; {moradores} moradores no barulho',
    'camada.empregos': 'Empregos',
    'camada.empregos.semEmprego': 'Moradores sem emprego',
    'camada.empregos.equilibrado': 'Equilibrado',
    'camada.empregos.semGente': 'Vagas sem trabalhador',
    'camada.empregos.resumo': 'Desemprego de {desemprego}%; {abertas} das {vagas} vagas estão abertas',
    // fatores do bem-estar
    'fator.esgoto': 'Sem esgoto',
    'fator.ar': 'Ar poluído',
    'fator.ruido': 'Ruído',
    // o que falta para subir de nível
    'falta.esgoto': 'Esgoto',
    // painel de demanda (q.demanda().mercadoria)
    'cid.mercadoria': 'Mercadoria da cidade',
    'cid.mercadoria.producao': 'Produção da indústria',
    'cid.mercadoria.consumo': 'Consumo do comércio',
    'cid.mercadoria.importada': 'Importada pela rodovia',
    'cid.mercadoria.excedente': 'Sobra da indústria',
    'cid.mercadoria.unidade': '{n} un./h',
    'cid.mercadoria.nota': 'O que o comércio consome e a indústria não faz é importado a 160% do preço e vira despesa. Mais indústria zoneada traz a conta para baixo.',
  });
}
