// Textos da U2b (Modo livre, Mural, Modo foto e abertura). Português do Brasil, frases curtas, sem travessão, unidades da
// D42. Entra pelo índice fixo de ui/textos.js (uma linha, do integrador).
export function registrar(registrarTextos) {
  registrarTextos('u2b', {
    // nova partida: Modo livre (D56)
    'u2b.nova.livre': 'Modo livre',
    'u2b.nova.livreExp': 'Sem licença de ladrilho e sem custo: o caixa fica fixo em {caixa}. Não conta recordes e não volta ao modo normal.',
    // Mural
    'u2b.mural.titulo': 'Mural',
    'u2b.mural.filtro': 'Assunto',
    'u2b.mural.todos': 'Tudo',
    'u2b.mural.decisoes': 'Decisões',
    'u2b.mural.marcos': 'Marcos',
    'u2b.mural.arcologia': 'Arcologia',
    'u2b.mural.mundo': 'Mundo',
    'u2b.mural.vila': 'Vila',
    'u2b.mural.vazio': 'Nada no Mural ainda. As notícias da cidade, as decisões do Conselho e as etapas da Arcologia aparecem aqui.',
    'u2b.mural.vazioFiltro': 'Nenhuma notícia neste assunto.',
    'u2b.mural.ver': 'Ver no mapa',
    'u2b.mural.total': '{n} notícias',
    'u2b.mural.um': '1 notícia',
    'u2b.mural.autor.cidade': 'Heldópolis',
    'u2b.mural.autor.mundo': 'Mundo',
    'u2b.mural.semTexto': 'Notícia sem texto.',
    // Modo foto
    'u2b.foto.titulo': 'Modo foto',
    'u2b.foto.luz': 'Luz',
    'u2b.foto.luzJogo': 'Luz do jogo',
    'u2b.foto.tamanho': 'Tamanho',
    'u2b.foto.tamanhoTela': 'Da tela',
    'u2b.foto.tamanhoHd': '1920 x 1080',
    'u2b.foto.salvar': 'Salvar imagem',
    'u2b.foto.salvando': 'Salvando...',
    'u2b.foto.salva': 'Imagem salva na pasta de downloads do navegador.',
    'u2b.foto.erro': 'Não foi possível salvar a imagem.',
    'u2b.foto.sair': 'Sair',
    'u2b.foto.dica': 'Esc sai. H esconde este painel. Arraste para mover a câmera.',
    'u2b.foto.arquivo': 'heldopolis-foto',
    // Abertura
    'u2b.cfg.abertura': 'Abertura na nova partida',
    'u2b.cfg.aberturaExp': 'Mostra os 40 s de voo sobre Heldópolis e a Arcologia. Esc ou Espaço pula.',
    'u2b.abertura.pular': 'Pular abertura',
    'u2b.abertura.dica': 'Esc ou Espaço pula',
    'u2b.abertura.l1.titulo': 'Held Capital',
    'u2b.abertura.l1.texto': 'O braço financeiro da Holding Held compra a baía, o rio e a planície.',
    'u2b.abertura.l2.titulo': 'Heldópolis',
    'u2b.abertura.l2.texto': 'Uma cidade inteira por planejar: vias, zonas, redes e serviços, da Vila de Santa Cida à orla.',
    'u2b.abertura.l3.titulo': 'A Arcologia de Held',
    'u2b.abertura.l3.texto': 'No platô de frente para o mar, o Park of Future Dreams: a Blade Tower, a Legacy Tower e o lago.',
    'u2b.abertura.l4.titulo': 'Holding Held',
    'u2b.abertura.l4.texto': 'Jan. 2020. A obra começa agora.',
    'u2b.abertura.aria': 'Abertura do jogo',
  });
}
