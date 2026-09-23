// As obras da composição, na ordem em que fazem sentido construir. Cada projeto tem etapas
// (itens + créditos + tempo); cada etapa acende uma peça 3D. Tempos em minutos no ritmo normal.
// Licenças (estaca, baliza, trena) são exigidas antes de terraplenagens grandes: sem topografia não há obra.

const E = (id, nome, desc, min, custo, itens, o = {}) => ({ id, nome, desc, t: min * 60, custo, itens, ...o });

export const PROJETOS = [
  // ---------------- Capítulo 1 — Fundação ----------------
  { id: 'pas_frente', nome: 'Caminho da Frente', cap: 1, icone: 'caminho', etapas: [
    E('e1', 'Abrir o caminho', 'Deque baixo de madeira sobre brita: o acesso do canteiro até a praça, sem cortar árvores.', 1, 150, { madeira: 3, brita: 2 }, { xp: 40 }),
  ] },
  { id: 'lago', nome: 'Lago Central', cap: 1, icone: 'lago', etapas: [
    E('e1', 'Desassoreamento', 'Retirar o lodo acumulado pela pastagem antiga. O nível da água volta a subir.', 3, 600, { brita: 4, madeira: 2 }, { servico: { agua: 2000 }, modo: 'nivel' }),
    E('e2', 'Margens vivas', 'Juncos, mudas nas margens e na ilha: as raízes seguram o barranco e filtram a água.', 10, 3000, { grama: 4, muda: 3, substrato: 2 }, { bem: 5, modo: 'crescer', cap: 2 }),
    E('e3', 'Estação natural de água', 'Ilhas flutuantes filtrantes, deque e casa de bombas: água limpa para toda a arcologia.', 15, 6000, { deque: 3, painel: 2, bloco: 3 }, { servico: { agua: 5000, saneamento: 3000 }, cap: 2 }),
  ] },
  { id: 'sede', nome: 'Sede Administrativa da Holding Guarda-Chuva', cap: 1, icone: 'sede', faixa: 'sede', etapas: [
    E('e1', 'Terraplenagem e fundações', 'Topografia, corte mínimo do terreno e o anel de fundações.', 3, 1200, { brita: 6, concreto: 2 }, { licencas: { estaca: 1 }, alvo: { modelo: 'sedePatio', parte: 'e1' }, modo: 'terra' }),
    E('e2', 'Térreo e núcleo', 'O primeiro pavimento do anel. A partir daqui a Sede recebe os repasses da Holding.', 6, 2500, { concreto: 3, viga: 4 }, { nivel: 1, desbloqueia: 'repasses' }),
    E('e3', 'Anel de vidro solar', 'Dois pavimentos de vidro fotovoltaico: a fachada gera energia.', 20, 10000, { painel: 6, premoldado: 4, perfil: 4 }, { nivel: 3, servico: { energia: 3000 }, cap: 2 }),
    E('e4', 'Cobertura e pátio', 'Último pavimento, cobertura verde e o pátio com gramado e campo.', 30, 18000, { duplo: 4, grama: 6, muda: 4 }, { nivel: 4, servico: { energia: 2500, agua: 1500 }, extra: { modelo: 'sedePatio', parte: 'e4' }, cap: 3 }),
  ] },
  // ---------------- Capítulo 2 — Água que corre ----------------
  { id: 'escola', nome: 'Escola e Campus para Jovens (10–17 anos)', cap: 2, icone: 'escola', etapas: [
    E('e1', 'Bloco escolar', 'Três pavimentos em curva, salas voltadas para o pátio.', 12, 4500, { viga: 4, concreto: 4, painel: 2 }),
    E('e2', 'Pátios e parquinhos', 'Plataformas em níveis com areia e brinquedos coloridos.', 10, 3500, { deque: 3, grama: 3, bloco: 2 }, { bem: 5 }),
    E('e3', 'Piscina', 'Piscina com deque de madeira sobre o terraço.', 12, 4500, { concreto: 3, painel: 2, deque: 2 }, { bem: 3 }),
  ] },
  { id: 'campo', nome: 'Campo e arquibancadas', cap: 2, icone: 'campo', etapas: [
    E('e1', 'Terraplenagem do campo', 'Nivelar e drenar o terreno.', 4, 1200, { brita: 8 }, { modo: 'terra' }),
    E('e2', 'Gramado e marcações', 'Grama nativa resistente e as linhas do campo.', 8, 2200, { grama: 6, substrato: 3 }, { modo: 'crescer' }),
    E('e3', 'Arquibancadas e iluminação', 'Degraus de concreto e torres de luz de LED.', 15, 5500, { bloco: 4, perfil: 2, luminaria: 2 }, { bem: 6 }),
  ] },
  { id: 'praca', nome: 'Praça Central', cap: 2, icone: 'praca', etapas: [
    E('e1', 'Pavimentação', 'Piso drenante de blocos claros, em círculos concêntricos.', 8, 2800, { brita: 8, cimento: 4 }, { modo: 'terra' }),
    E('e2', 'Jardins filtrantes', 'Os espelhos d’água são jardins que tratam o esgoto com plantas.', 12, 4800, { bloco: 3, grama: 4, substrato: 3 }, { servico: { saneamento: 4500 } }),
    E('e3', 'Palmeiras, bancos e luzes', 'Sombra, lugar para sentar e luz para a noite.', 20, 8500, { muda: 6, deque: 2, luminaria: 3 }, { bem: 8, modo: 'crescer', cap: 3 }),
  ] },
  { id: 'pas_bulevar', nome: 'Bulevar Verde', cap: 2, icone: 'passarela', requer: ['praca.e1'], etapas: [
    E('e1', 'Passarela elevada', 'Deque branco sobre pilares finos, guarda-corpo de vidro e jardineiras.', 15, 5500, { perfil: 4, deque: 3, guarda: 2 }, { bem: 2 }),
  ] },
  // ---------------- Capítulo 3 — Saber de madeira ----------------
  { id: 'biblioteca', nome: 'Biblioteca Central', cap: 3, icone: 'biblioteca', etapas: [
    E('e1', 'Fundações e núcleo', 'Estacas, radier e o núcleo de concreto com escadas e elevadores.', 15, 8000, { concreto: 6, perfil: 4, cimento: 4 }, { licencas: { estaca: 2, baliza: 1 } }),
    E('e2', 'Andares 1 a 3', 'Lajes onduladas, estantes iluminadas e brises de madeira.', 25, 14000, { trelica: 4, painel: 4, premoldado: 3 }),
    E('e3', 'Andares 4 a 6', 'Mais três pavimentos de leitura e o terraço-jardim.', 30, 18000, { estante: 6, trelica: 4, duplo: 3 }),
    E('e4', 'Pilares-árvore', 'Troncos de madeira laminada que se abrem em "V" para sustentar o dossel.', 25, 16000, { trelica: 6, viga: 8, conector: 4 }),
    E('e5', 'Dossel de vidro', 'A grande cobertura quadrada: vidro solar sobre grelha de madeira.', 45, 26000, { painel: 8, solar: 4, trelica: 4 }, { bem: 10, servico: { energia: 2500 } }),
  ] },
  { id: 'crd', nome: 'Centro de Recursos Digitais', cap: 3, icone: 'crd', requer: ['biblioteca.e1'], etapas: [
    E('e1', 'Bloco de apoio', 'Três pavimentos de laboratórios digitais e terraço de trabalho.', 20, 12000, { premoldado: 4, painel: 4, bloco: 4 }),
    E('e2', 'Costelas de madeira', 'A abóbada em onda: arcos de madeira laminada e terças.', 25, 14000, { trelica: 6, viga: 6 }),
    E('e3', 'Vidro e computadores', 'Fechamento de vidro e as estações de trabalho acesas.', 35, 20000, { painel: 6, computador: 3 }, { bem: 5 }),
  ] },
  { id: 'humanidades', nome: 'Faculdade de Humanidades e Artes Integradas', cap: 3, icone: 'faculdade', faixa: 'humanidades', requer: ['anel.3'], etapas: [
    E('e1', 'Pavimentos em curva', 'Dois pavimentos que acompanham a curva interna do Anel.', 15, 9000, { premoldado: 3, painel: 3, viga: 3 }, { nivel: 2 }),
    E('e2', 'Ateliês e terraço', 'Terceiro pavimento de ateliês e terraço verde com esculturas.', 20, 11000, { duplo: 2, grama: 4, trelica: 2 }, { nivel: 3, bem: 4 }),
  ] },
  { id: 'engenharia', nome: 'Faculdade de Engenharia Sustentável', cap: 3, icone: 'faculdade', requer: ['anel.3'], etapas: [
    E('e1', 'Laboratórios', 'Blocos brancos de laboratórios no térreo.', 15, 8000, { bloco: 4, painel: 3, premoldado: 2 }),
    E('e2', 'Oficinas e cobertura solar', 'Pavimentos superiores e painéis solares na cobertura.', 20, 11000, { solar: 4, perfil: 3, bloco: 3 }, { bem: 3, servico: { energia: 2000 } }),
  ] },
  { id: 'instituto', nome: 'Instituto de Estudos Urbanos e Políticas Públicas', cap: 3, icone: 'faculdade', requer: ['anel.3'], etapas: [
    E('e1', 'Blocos de estudo', 'Salas de projeto em blocos brancos junto ao Anel.', 15, 8000, { bloco: 4, painel: 3, viga: 3 }),
    E('e2', 'Pavimentos superiores', 'Mais pavimentos, vidro solar e jardins verticais.', 20, 12000, { duplo: 3, solar: 2, jardim: 1 }, { bem: 3, servico: { energia: 1000 } }),
  ] },
  { id: 'ciencias', nome: 'Faculdade de Ciências Avançadas e Tecnologia', cap: 3, icone: 'ciencias', etapas: [
    E('e1', 'Pilotis e lajes', 'O prédio flutua sobre pilotis: a água da chuva e a mata passam por baixo.', 20, 12000, { concreto: 6, perfil: 4, premoldado: 3 }, { licencas: { estaca: 1, baliza: 1 } }),
    E('e2', 'Laboratórios', 'Biotecnologia e nanotecnologia: bancadas, equipamentos e telas.', 25, 15000, { painel: 4, fiacao: 3, bloco: 3 }, { desbloqueia: 'laboratorio' }),
    E('e3', 'Casca orgânica', 'As bandas brancas fluidas, a marca da faculdade.', 30, 20000, { premoldado: 6, trelica: 3, conector: 4 }),
    E('e4', 'Vidro e luzes', 'Vidro recuado e a fachada em corte que deixa ver os laboratórios.', 30, 22000, { duplo: 6, luminaria: 4, sensor: 2 }, { bem: 5, servico: { agua: 2000 } }),
  ] },
  { id: 'onda', nome: 'Ala em Onda', cap: 3, icone: 'faculdade', faixa: 'onda', requer: ['ciencias.e1'], etapas: [
    E('e1', 'Pavimentos em "S"', 'A fita que liga o Campus Universitário à Faculdade de Ciências.', 20, 10000, { premoldado: 3, painel: 3, viga: 3 }, { nivel: 2 }),
    E('e2', 'Terraços verdes', 'Terceiro pavimento em recuos e terraços com jardim.', 25, 12000, { grama: 4, jardim: 2, duplo: 2 }, { nivel: 3 }),
  ] },
  { id: 'gramadoUni', nome: 'Gramado do Campus Universitário', cap: 3, icone: 'campo', requer: ['uni.2'], etapas: [
    E('e1', 'Gramado e campo', 'O gramado central do campus com árvores ao redor.', 12, 6000, { grama: 6, muda: 4 }, { bem: 3, modo: 'crescer', servico: { saneamento: 2000 } }),
  ] },
  { id: 'uniElo', nome: 'Elo Norte', cap: 3, icone: 'passarela', faixa: 'uniElo', requer: ['uni.1', 'anel.2'], etapas: [
    E('e1', 'Fita de ligação', 'Um prédio-ponte entre o Anel e o Campus Universitário.', 15, 9000, { premoldado: 3, painel: 3, viga: 3 }, { nivel: 2 }),
    E('e2', 'Terraço do elo', 'Terceiro pavimento e terraço-jardim.', 15, 9000, { grama: 3, duplo: 2, guarda: 2 }, { nivel: 3 }),
  ] },
  { id: 'pas_ponte', nome: 'Ponte do Instituto', cap: 3, icone: 'passarela', requer: ['instituto.e1'], etapas: [
    E('e1', 'Passarela elevada', 'Liga o Instituto à praça por cima do jardim.', 15, 6000, { perfil: 4, deque: 3, guarda: 2 }),
  ] },
  { id: 'ponteCoberta', nome: 'Ponte Coberta', cap: 3, icone: 'passarela', requer: ['ciencias.e1', 'biblioteca.e2'], etapas: [
    E('e1', 'Pilares', 'Pilares finos sobre o jardim, entre a Faculdade e a Biblioteca.', 10, 5000, { concreto: 3, perfil: 3 }),
    E('e2', 'Tubo de vidro', 'Um corredor envidraçado para atravessar com chuva.', 20, 9000, { painel: 4, duplo: 2, perfil: 2 }),
  ] },
  // ---------------- Capítulo 4 — Energia escondida ----------------
  { id: 'acelerador', nome: 'Acelerador de Partículas Subterrâneo & Centro de Física Avançada', cap: 4, icone: 'acelerador', etapas: [
    E('e1', 'Escavação do poço', 'Um poço redondo com paredes de contenção de concreto.', 25, 16000, { brita: 10, concreto: 6 }, { licencas: { estaca: 2, baliza: 2, trena: 1 } }),
    E('e2', 'Túnel e anel', 'O anel do acelerador e seus ímãs.', 35, 24000, { premoldado: 6, perfil: 6, fiacao: 4 }),
    E('e3', 'Detectores', 'Detectores em camadas, racks de computação e luz azul.', 45, 32000, { sensor: 4, computador: 3, kitlab: 3 }, { bem: 3 }),
    E('e4', 'Centro de Física Avançada', 'Pavilhão curvo de vidro na borda do poço. Por baixo, uma central geotérmica.', 30, 22000, { duplo: 4, painel: 4, grama: 4 }, { servico: { energia: 2000 } }),
  ] },
  { id: 'anfiteatro', nome: 'Anfiteatro da Vila', cap: 4, icone: 'anfiteatro', etapas: [
    E('e1', 'Escavação e arquibancadas', 'Degraus de concreto no declive. Por baixo, uma bacia que retém e trata a água da chuva.', 20, 12000, { bloco: 6, concreto: 4 }, { servico: { agua: 1500, saneamento: 2500 } }),
    E('e2', 'Palco e iluminação', 'Palco de madeira, fundo curvo e luminárias.', 20, 12000, { deque: 4, luminaria: 4, perfil: 2 }, { bem: 6 }),
  ] },
  { id: 'pas_vila', nome: 'Passarela da Vila', cap: 4, icone: 'passarela', requer: ['anfiteatro.e1'], etapas: [
    E('e1', 'Passarela elevada', 'Da Biblioteca até a Vila Estudantil, por cima da mata.', 15, 6500, { perfil: 4, deque: 3, guarda: 3 }),
  ] },
  // ---------------- Capítulo 5 — Casa dos gigantes ----------------
  { id: 'santuarioInt', nome: 'Santuário: mata e fauna', cap: 5, icone: 'santuario', requer: ['santuario.1'], etapas: [
    E('e1', 'Clareiras e mirantes', 'Rochas, clareiras e um biodigestor que transforma resíduos em energia.', 20, 14000, { brita: 6, deque: 4, muda: 4 }, { servico: { saneamento: 3000 } }),
    E('e2', 'Fauna resgatada', 'Elefantes e rinocerontes vindos de zoológicos fechados.', 40, 26000, { racao: 6, kitvet: 3 }, { bem: 4 }),
  ] },
  { id: 'savana', nome: 'Habitats Expandidos e Centro de Reabilitação', cap: 5, icone: 'savana', etapas: [
    E('e1', 'Cercados e trilhas', 'Cercas de madeira e trilhas de cascalho.', 15, 9000, { madeira: 10, deque: 4 }, { modo: 'crescer' }),
    E('e2', 'Lagoa e abrigos', 'Bebedouros, abrigos de sombra, rochas e acácias.', 25, 14000, { substrato: 4, muda: 6, bloco: 3 }, { modo: 'crescer', servico: { saneamento: 2000 } }),
    E('e3', 'Elefantes', 'Uma manada chega ao centro de reabilitação.', 40, 24000, { racao: 6, kitvet: 2 }, { modo: 'surgir' }),
    E('e4', 'Girafas e rinocerontes', 'O habitat se completa.', 45, 28000, { racao: 8, kitvet: 3 }, { bem: 4, modo: 'surgir' }),
  ] },
  { id: 'bioma', nome: 'Bioma Aquático de Conservação', cap: 5, icone: 'bioma', etapas: [
    E('e1', 'Fundação e tanque', 'O tanque do aquário, areia e rochas.', 30, 20000, { concreto: 8, premoldado: 4 }, { licencas: { estaca: 2, baliza: 2, trena: 2 } }),
    E('e2', 'Estrutura geodésica', 'Milhares de barras e nós formam a cúpula.', 45, 30000, { no: 10, perfil: 6 }),
    E('e3', 'Painéis de vidro', 'Cada triângulo recebe seu painel.', 60, 36000, { cupula: 12 }),
    E('e4', 'Aquário vivo', 'Água, baleia, arraias e cardumes em recuperação.', 60, 40000, { acrilico: 6, sensor: 3, racao: 4 }, { bem: 6, requer: ['lago.e3'] }),
  ] },
  { id: 'gorilas', nome: 'Recinto dos Gorilas', cap: 5, icone: 'gorilas', etapas: [
    E('e1', 'Rochedos e fosso', 'Rochedos de arenito e o gramado do recinto.', 20, 14000, { brita: 10, concreto: 4 }),
    E('e2', 'Passarela anelar', 'Um anel elevado com vidro para ver sem incomodar.', 30, 20000, { perfil: 6, deque: 4, guarda: 4 }),
    E('e3', 'Abrigo e árvores', 'Sombra e esconderijos.', 20, 14000, { muda: 6, madeira: 8 }, { modo: 'crescer' }),
    E('e4', 'Família de gorilas', 'Cinco gorilas resgatados chegam juntos.', 45, 30000, { racao: 6, kitvet: 3 }, { bem: 4, modo: 'surgir' }),
  ] },
  { id: 'pas_trilhaBioma', nome: 'Trilha do Bioma', cap: 5, icone: 'passarela', requer: ['bioma.e1'], etapas: [
    E('e1', 'Passarela sinuosa', 'Contorna a cúpula e desce até os gorilas.', 20, 9000, { perfil: 5, deque: 4, guarda: 3 }),
  ] },
  { id: 'pas_elo', nome: 'Elo do Santuário', cap: 5, icone: 'passarela', requer: ['savana.e1'], etapas: [
    E('e1', 'Passarela elevada', 'Liga a savana ao anel do santuário.', 20, 9000, { perfil: 5, deque: 4, guarda: 3 }),
  ] },
  // ---------------- Epílogo ----------------
  { id: 'reflorestar', nome: 'Reflorestar o canteiro', cap: 6, icone: 'floresta', etapas: [
    E('e1', 'Desmontar e reflorestar', 'As oficinas descem para galpões sob o acelerador e a mata volta a ocupar o canteiro.', 60, 50000, { muda: 20, substrato: 10, grama: 10 }, { modo: 'reflorestar' }),
  ] },
];
export const PROJ = Object.fromEntries(PROJETOS.map((p) => [p.id, p]));
// peça 3D de cada etapa (quando não é a própria peça "modelo.etapa")
export function alvoEtapa(p, e) { return e.alvo || { modelo: p.id, parte: e.id }; }

// Módulos: segmentos dos edifícios-fita que sobem um andar por nível (como as zonas do BuildIt).
export const MODULOS = {
  anel: { nome: 'Anel do Campus', sub: 'Moradias e salas de aula', cap: 1, pop: 800, max: 5, inicio: 3 },
  uni: { nome: 'Campus Universitário', sub: 'Salas, laboratórios e moradias', cap: 3, pop: 600, max: 5 },
  anelBib: { nome: 'Anel da Biblioteca', sub: 'Salas de estudo em terraços', cap: 3, pop: 380, max: 3, requer: ['biblioteca.e1'] },
  casas: { nome: 'Vila Estudantil Expandida', sub: 'Casas brancas empilhadas', cap: 4, pop: 130, max: 3, requer: ['anfiteatro.e1'] },
  santuario: { nome: 'Santuário de Animais e Centro de Conservação', sub: 'Clínicas, pesquisa e moradia de pesquisadores', cap: 5, pop: 320, max: 2 },
};
// limites de nível por capítulo (o Anel cresce aos poucos ao longo da história)
export const LIMITE_CAP = { anel: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 5, 6: 5 }, uni: { 3: 4, 4: 5, 5: 5, 6: 5 } };
export const POP_NIVEL = [0, 0.08, 0.2, 0.4, 0.7, 1.0];
// o que cada nível pede (três tipos sorteados do conjunto, conforme o que já foi liberado)
export const POOL_NIVEL = {
  1: ['viga', 'concreto', 'cimento', 'madeira'],
  2: ['bloco', 'premoldado', 'painel', 'viga', 'concreto'],
  3: ['premoldado', 'painel', 'guarda', 'deque', 'grama', 'bloco'],
  4: ['duplo', 'trelica', 'grama', 'luminaria', 'perfil', 'guarda'],
  5: ['jardim', 'solar', 'luminaria', 'sensor', 'muda', 'duplo'],
};
export const CUSTO_NIVEL = [0, 400, 1400, 3800, 8500, 15000];
export const TEMPO_NIVEL = [0, 60, 180, 480, 900, 1500];
export const SERVICO_NIVEL = { 3: 'agua', 4: 'energia', 5: 'saneamento' };
