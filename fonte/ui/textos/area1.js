// Textos da compra de área inteira (D107): a Várzea do Held e as áreas nomeadas que vierem depois. Português do
// Brasil, sem travessão; registrar(registrarTextos) vem de ui/textos.js.
export function registrar(registrarTextos) {
  registrarTextos('area1', {
    'folha.terreno.comprar': 'Comprar terreno',
    'folha.terreno.comprarLadrilho': 'Comprar este terreno por {preco}',
    'area.titulo': '{nome}',
    'area.faltam1': 'falta 1 ladrilho',
    'area.faltam': 'faltam {n} ladrilhos',
    'area.preco': '{preco} no total',
    'area.comprar': 'Comprar {nome}',
    'area.comprada': '{nome} comprada: {n} ladrilhos.',
    'area.comprada1': '{nome} comprada: 1 ladrilho.',
    'area.modo': 'O que comprar',
    'area.modo.area': 'A área toda',
    'area.modo.ladrilho': 'Só este ladrilho',
    'area.inteira': 'Toda esta área já é da Holding',
    'area.criterio.vizinho': 'Encosta numa área da Holding',
    'area.criterio.licenca': 'Uma licença de ladrilho',
    'area.criterio.licencaLivre': 'Sem licença no Modo livre',
    'area.criterio.creditos': 'Créditos para o total',
    'area.falta.vizinho': 'Falta encostar numa área da Holding',
    'area.falta.licenca': 'Falta uma licença de ladrilho',
    'area.falta.creditos': 'Faltam {falta} em créditos',
    'area.criterio.ok': 'cumprido',
    'area.criterio.nao': 'falta',
  });
}
