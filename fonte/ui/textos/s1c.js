// Textos da S1c (trânsito agregado com efeitos, D37): camada Trânsito, avisos de "trânsito parado" com a sugestão e o
// fator do bem-estar. Português do Brasil, sem travessão; tempo em minutos de viagem. registrar(registrarTextos) vem de
// ui/textos.js.
export function registrar(registrarTextos) {
  registrarTextos('s1c', {
    // camada Trânsito (a cor da aresta é o v/c do sentido mais cheio no pico: 1 é a capacidade)
    'camada.transito': 'Trânsito',
    'camada.transito.livre': 'Livre',
    'camada.transito.cheio': 'Na capacidade',
    'camada.transito.parado': 'Parado',
    'camada.transito.resumo': '{gargalos} vias acima da capacidade; viagem média de {minutos} min, vias a {vel}% da velocidade livre',
    // aviso da cidade: a aresta mais cheia e o que fazer (as três sugestões da D37)
    'aviso.transitoParado': 'Trânsito parado em {via}: melhore a via para uma avenida mais larga',
    'aviso.transitoParadoMao': 'Trânsito parado em {via}: faça a rua de mão única para ganhar uma faixa',
    'aviso.transitoParadoParalela': 'Trânsito parado em {via}: abra uma via paralela para dividir o fluxo',
    // fator do bem-estar (q.predio().moradia.fatores)
    'fator.transito': 'Tempo no trânsito',
  });
}
