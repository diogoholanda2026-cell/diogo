// As obras da composição, na ordem em que fazem sentido construir. Cada projeto tem etapas
// (itens + créditos + tempo); cada etapa acende uma peça 3D. Tempos-base em minutos no ritmo normal
// (a simulação multiplica pelo fator do capítulo, F_OBRA em estado.js).
// Licenças (estaca, baliza, trena) são exigidas antes de terraplenagens grandes: sem topografia não há obra.
// preEntrega: a prancha aceita materiais a partir desse capítulo, antes de a etapa abrir.
// Apresentação (só interface): nomeCurto para títulos de uma linha e foto:[x,y,w,h], o recorte da foto de referência
// (1376x768) que vira a miniatura no cabeçalho da folha. Nada disso entra na mecânica.
import { PASSARELAS } from './planta.js';
import { CIDADE } from './cidade.js';

const E = (id, nome, desc, min, custo, itens, o = {}) => ({ id, nome, desc, t: min * 60, custo, itens, ...o });

export const PROJETOS = [
  // ---------------- Capítulo 1 — Fundação ----------------
  { id: 'pas_frente', nome: 'Caminho da Frente', cap: 1, icone: 'caminho', foto: [300, 520, 280, 200], etapas: [
    E('e1', 'Abrir o caminho', 'Deque baixo de madeira sobre brita: o acesso do canteiro até a praça, sem cortar árvores.', 1, 150, { madeira: 3, brita: 2 }, { xp: 40 }),
  ] },
  { id: 'lago', nome: 'Lago Central', cap: 1, icone: 'lago', foto: [590, 140, 280, 200], etapas: [
    E('e1', 'Desassoreamento', 'Retirar o lodo acumulado pela pastagem antiga. O nível da água volta a subir.', 3, 300, { brita: 4, madeira: 2 }, { servico: { agua: 2000 }, modo: 'nivel' }),
    E('e2', 'Margens vivas', 'Juncos, mudas nas margens e na ilha: as raízes seguram o barranco e filtram a água.', 10, 2500, { grama: 4, muda: 3, substrato: 2 }, { bem: 5, modo: 'crescer', cap: 2 }),
    E('e3', 'Estação natural de água', 'Ilhas flutuantes filtrantes, deque e casa de bombas: água limpa para toda a arcologia.', 15, 5000, { deque: 3, painel: 2, bloco: 3 }, { servico: { agua: 5000, saneamento: 2000 }, cap: 2 }),
  ] },
  { id: 'sede', nome: 'Sede Administrativa da Holding Guarda-Chuva', cap: 1, icone: 'sede', nomeCurto: 'Sede da Holding', foto: [585, 75, 320, 229], faixa: 'sede', etapas: [
    E('e1', 'Terraplenagem e fundações', 'Topografia, corte mínimo do terreno e o anel de fundações.', 3, 600, { brita: 6, concreto: 2 }, { licencas: { estaca: 1 }, alvo: { modelo: 'sedePatio', parte: 'e1' }, modo: 'terra' }),
    E('e2', 'Térreo e núcleo', 'O primeiro pavimento do anel. A Sede passa a receber a renda dos moradores (antes no Escritório).', 6, 1200, { concreto: 3, viga: 4 }, { nivel: 1 }),
    E('e3', 'Anel de vidro solar', 'Dois pavimentos de vidro fotovoltaico: a fachada gera energia.', 20, 6000, { painel: 6, premoldado: 4, perfil: 4 }, { nivel: 3, servico: { energia: 3000 }, cap: 2 }),
    E('e4', 'Cobertura e pátio', 'Último pavimento, cobertura verde, orla de deque, piscina e árvores entre a Sede e o lago.', 30, 10500, { duplo: 3, grama: 5, muda: 3 }, { nivel: 4, servico: { energia: 2500, agua: 1500 }, extra: { modelo: 'sedePatio', parte: 'e4' }, cap: 3 }),
  ] },
  // ---------------- Capítulo 2 — Água que corre ----------------
  { id: 'escola', nome: 'Escola e Campus para Jovens (10–17 anos)', cap: 2, icone: 'escola', nomeCurto: 'Escola e Campus', foto: [45, 255, 280, 200], etapas: [
    E('e1', 'Bloco escolar', 'Três pavimentos em curva, salas voltadas para o pátio.', 12, 3500, { viga: 4, concreto: 4, painel: 2 }),
    E('e2', 'Pátios e parquinhos', 'Plataformas em níveis com areia e brinquedos coloridos.', 10, 3000, { deque: 3, grama: 3, bloco: 2 }, { bem: 5 }),
    E('e3', 'Piscina', 'Piscina com deque de madeira sobre o terraço.', 12, 3500, { concreto: 3, painel: 2, deque: 2 }, { bem: 3 }),
  ] },
  { id: 'campo', nome: 'Campo e arquibancadas', cap: 2, icone: 'campo', foto: [200, 235, 240, 171], etapas: [
    E('e1', 'Terraplenagem do campo', 'Nivelar e drenar o terreno.', 4, 1000, { brita: 8 }, { modo: 'terra' }),
    E('e2', 'Gramado e marcações', 'Grama nativa resistente e as linhas do campo.', 8, 2000, { grama: 6, substrato: 3 }, { modo: 'crescer' }),
    E('e3', 'Arquibancadas e iluminação', 'Degraus de concreto e torres de luz de LED.', 15, 4500, { bloco: 4, perfil: 2, luminaria: 2 }, { bem: 6 }),
  ] },
  { id: 'praca', nome: 'Praça Central', cap: 2, icone: 'praca', foto: [450, 430, 280, 200], etapas: [
    E('e1', 'Pavimentação', 'Piso drenante de blocos claros, em círculos concêntricos.', 8, 2000, { brita: 8, cimento: 4 }, { modo: 'terra' }),
    E('e2', 'Jardins filtrantes', 'Os espelhos d’água são jardins que tratam o esgoto com plantas.', 12, 4000, { bloco: 3, grama: 4, substrato: 3 }, { servico: { saneamento: 3000 } }),
    E('e3', 'Palmeiras, bancos e luzes', 'Sombra, lugar para sentar e luz para a noite.', 20, 5000, { muda: 5, deque: 2, luminaria: 2 }, { bem: 7, modo: 'crescer', cap: 3 }),
  ] },
  { id: 'pas_bulevar', nome: 'Bulevar Verde', cap: 2, icone: 'passarela', foto: [380, 480, 280, 200], requer: ['praca.e1'], etapas: [
    E('e1', 'Passarela elevada', 'Deque branco sobre pilares finos, guarda-corpo de vidro e jardineiras.', 15, 4500, { perfil: 4, deque: 3, guarda: 2 }, { bem: 2 }),
  ] },
  { id: 'pas_anel', nome: 'Passeio do Anel', cap: 2, icone: 'passarela', foto: [120, 380, 280, 200], requer: ['anel.2', 'pas_frente.e1'], etapas: [
    E('e1', 'Passarela elevada', 'Contorna a frente do Anel pela mata, sem tocar nas raízes.', 12, 3500, { deque: 3, perfil: 2, guarda: 1 }, { bem: 2 }),
  ] },
  // a Fita da Frente sai do Passeio do Anel, junto ao canteiro, e pousa na praça pavimentada
  ...(PASSARELAS.frente2 ? [{ id: 'pas_frente2', nome: PASSARELAS.frente2.nome || 'Fita da Frente', cap: 2, icone: 'passarela', foto: [300, 500, 280, 200], requer: ['pas_anel.e1', 'praca.e1'], etapas: [
    E('e1', 'Passarela em camadas', 'Uma segunda fita sobre o Caminho da Frente, com floreiras dos dois lados, até a praça.', 12, 4500, { deque: 3, perfil: 2, guarda: 1 }, { bem: 2 }),
  ] }] : []),
  // ---------------- Capítulo 3 — Saber de madeira ----------------
  { id: 'biblioteca', nome: 'Biblioteca Central', cap: 3, icone: 'biblioteca', foto: [700, 260, 320, 229], etapas: [
    E('e1', 'Fundações e núcleo', 'Estacas, radier e o núcleo de concreto com escadas e elevadores.', 15, 4500, { concreto: 5, perfil: 3, cimento: 3 }, { licencas: { estaca: 2, baliza: 1 } }),
    E('e2', 'Andares 1 a 3', 'Lajes onduladas, estantes iluminadas e brises de madeira.', 25, 8500, { trelica: 3, painel: 3, premoldado: 2 }),
    E('e3', 'Andares 4 a 6', 'Mais três pavimentos de leitura e o terraço-jardim.', 30, 10500, { estante: 5, trelica: 3, duplo: 2 }),
    E('e4', 'Pilares-árvore', 'Troncos de madeira laminada que se abrem em "V" para sustentar o dossel.', 25, 9500, { trelica: 5, viga: 5, conector: 3 }),
    E('e5', 'Dossel de vidro', 'A grande cobertura quadrada: vidro solar sobre grelha de madeira.', 45, 15500, { painel: 5, solar: 3, trelica: 3 }, { bem: 8, servico: { energia: 2500 } }),
  ] },
  { id: 'crd', nome: 'Centro de Recursos Digitais', cap: 3, icone: 'crd', nomeCurto: 'Recursos Digitais', foto: [690, 430, 280, 200], requer: ['biblioteca.e1'], etapas: [
    E('e1', 'Bloco de apoio', 'Três pavimentos de laboratórios digitais e terraço de trabalho.', 20, 7000, { premoldado: 3, painel: 3, bloco: 3 }),
    E('e2', 'Costelas de madeira', 'A abóbada em onda: arcos de madeira laminada e terças.', 25, 8500, { trelica: 5, viga: 5 }),
    E('e3', 'Vidro e computadores', 'Fechamento de vidro e as estações de trabalho acesas.', 35, 12000, { painel: 5, computador: 2 }, { bem: 4 }),
  ] },
  { id: 'humanidades', nome: 'Faculdade de Humanidades e Artes Integradas', cap: 3, icone: 'faculdade', nomeCurto: 'Faculdade de Humanidades', foto: [200, 260, 280, 200], faixa: 'humanidades', requer: ['anel.3'], etapas: [
    E('e1', 'Pavimentos em curva', 'Dois pavimentos que acompanham a curva interna do Anel.', 15, 5500, { premoldado: 2, painel: 2, viga: 2 }, { nivel: 2 }),
    E('e2', 'Ateliês e terraço', 'Terceiro pavimento de ateliês e terraço verde com esculturas.', 20, 6500, { duplo: 2, grama: 3, trelica: 2 }, { nivel: 3, bem: 4 }),
  ] },
  { id: 'engenharia', nome: 'Faculdade de Engenharia Sustentável', cap: 3, icone: 'faculdade', nomeCurto: 'Faculdade de Engenharia', foto: [50, 390, 280, 200], requer: ['anel.3'], etapas: [
    E('e1', 'Laboratórios', 'Blocos brancos de laboratórios no térreo.', 15, 4500, { bloco: 3, painel: 2, premoldado: 2 }),
    E('e2', 'Oficinas e cobertura solar', 'Pavimentos superiores e painéis solares na cobertura.', 20, 6500, { solar: 3, perfil: 2, bloco: 2 }, { bem: 3, servico: { energia: 2000 } }),
  ] },
  { id: 'instituto', nome: 'Instituto de Estudos Urbanos e Políticas Públicas', cap: 3, icone: 'faculdade', nomeCurto: 'Instituto de Estudos Urbanos', foto: [300, 300, 280, 200], requer: ['anel.3'], etapas: [
    E('e1', 'Blocos de estudo', 'Salas de projeto em blocos brancos junto ao Anel.', 15, 4500, { bloco: 3, painel: 2, viga: 2 }),
    E('e2', 'Pavimentos superiores', 'Mais pavimentos, vidro solar e jardins verticais.', 20, 7000, { duplo: 2, solar: 2, jardim: 1 }, { bem: 3, servico: { energia: 1000 } }),
  ] },
  { id: 'ciencias', nome: 'Faculdade de Ciências Avançadas e Tecnologia', cap: 3, icone: 'ciencias', nomeCurto: 'Faculdade de Ciências', foto: [430, 145, 280, 200], etapas: [
    E('e1', 'Pilotis e lajes', 'O prédio flutua sobre pilotis: a água da chuva e a mata passam por baixo.', 20, 7000, { concreto: 5, perfil: 3, premoldado: 2 }, { licencas: { estaca: 1, baliza: 1 } }),
    E('e2', 'Laboratórios', 'Biotecnologia e nanotecnologia: bancadas, equipamentos e telas.', 25, 9000, { painel: 3, fiacao: 2, bloco: 2 }, { desbloqueia: 'laboratorio' }),
    E('e3', 'Casca orgânica', 'As bandas brancas fluidas, a marca da faculdade.', 30, 12000, { premoldado: 5, trelica: 2, conector: 3 }),
    E('e4', 'Vidro e luzes', 'Vidro recuado e a fachada em corte que deixa ver os laboratórios.', 30, 13000, { duplo: 5, luminaria: 3, sensor: 2 }, { bem: 5, servico: { agua: 2000 } }),
  ] },
  { id: 'onda', nome: 'Ala em Onda', cap: 3, icone: 'faculdade', foto: [330, 60, 280, 200], faixa: 'onda', requer: ['ciencias.e1'], etapas: [
    E('e1', 'Pavimentos em "S"', 'A fita que liga o Campus Universitário à Faculdade de Ciências.', 20, 6000, { premoldado: 2, painel: 2, viga: 2 }, { nivel: 2 }),
    E('e2', 'Terraços verdes', 'Terceiro pavimento em recuos e terraços com jardim.', 25, 7000, { grama: 3, jardim: 2, duplo: 2 }, { nivel: 3 }),
  ] },
  { id: 'gramadoUni', nome: 'Gramado do Campus Universitário', cap: 3, icone: 'campo', nomeCurto: 'Gramado do Campus', foto: [300, 80, 280, 200], requer: ['uni.3'], etapas: [
    E('e1', 'Gramado e campo', 'O gramado central do campus com árvores ao redor.', 12, 3500, { grama: 5, muda: 3 }, { bem: 3, modo: 'crescer', servico: { saneamento: 2000 } }),
  ] },
  { id: 'uniElo', nome: 'Elo Norte', cap: 3, icone: 'passarela', foto: [250, 120, 280, 200], faixa: 'uniElo', requer: ['uni.1', 'anel.2'], etapas: [
    E('e1', 'Fita de ligação', 'Um prédio-ponte entre o Anel e o Campus Universitário.', 15, 5500, { premoldado: 2, painel: 2, viga: 2 }, { nivel: 2 }),
    E('e2', 'Terraço do elo', 'Terceiro pavimento e terraço-jardim.', 15, 5500, { grama: 2, duplo: 2, guarda: 2 }, { nivel: 3 }),
  ] },
  { id: 'pas_ponte', nome: 'Ponte do Instituto', cap: 3, icone: 'passarela', foto: [430, 380, 280, 200], requer: ['instituto.e1'], etapas: [
    E('e1', 'Passarela elevada', 'Liga o Instituto à praça por cima do jardim.', 15, 3500, { perfil: 3, deque: 2, guarda: 2 }),
  ] },
  // o Caracol sobe em espiral do chão do vale ao terraço do Anel (que existe a partir do 3º pavimento)
  ...(PASSARELAS.caracol ? [{ id: 'pas_caracol', nome: PASSARELAS.caracol.nome || 'Caracol do Anel', cap: 3, icone: 'passarela', foto: [150, 200, 280, 200], requer: ['anel.3'], etapas: [
    E('e1', 'Rampa em espiral', 'Uma rampa suave em caracol, sem degraus, do chão do vale ao terraço do Anel.', 12, 5000, { deque: 3, perfil: 3, guarda: 2 }, { bem: 2 }),
  ] }] : []),
  { id: 'ponteCoberta', nome: 'Ponte Coberta', cap: 3, icone: 'passarela', foto: [640, 250, 280, 200], requer: ['ciencias.e1', 'biblioteca.e2'], etapas: [
    E('e1', 'Pilares', 'Pilares finos sobre o jardim, entre a Faculdade e a Biblioteca.', 10, 3000, { concreto: 2, perfil: 2 }),
    E('e2', 'Tubo de vidro', 'Um corredor envidraçado para atravessar com chuva.', 20, 5500, { painel: 3, duplo: 2, perfil: 2 }),
  ] },
  // ---------------- Capítulo 4 — Energia escondida ----------------
  { id: 'acelerador', nome: 'Acelerador de Partículas Subterrâneo & Centro de Física Avançada', cap: 4, icone: 'acelerador', nomeCurto: 'Acelerador de Partículas', foto: [600, 500, 280, 200], etapas: [
    E('e1', 'Escavação do poço', 'Um poço redondo com paredes de contenção de concreto.', 25, 22500, { brita: 9, concreto: 5 }, { licencas: { estaca: 3, baliza: 3, trena: 2 } }),
    E('e2', 'Túnel e anel', 'O anel do acelerador e seus ímãs.', 35, 33500, { premoldado: 5, perfil: 5, fiacao: 4 }),
    E('e3', 'Detectores', 'Detectores em camadas, racks de computação e luz azul.', 45, 45000, { sensor: 4, computador: 3, kitlab: 3 }, { bem: 4 }),
    E('e4', 'Centro de Física Avançada', 'Pavilhão curvo de vidro na borda do poço. Por baixo, uma central geotérmica.', 30, 31000, { duplo: 4, painel: 4, grama: 4 }, { bem: 5, servico: { energia: 2000 } }),
  ] },
  { id: 'anfiteatro', nome: 'Anfiteatro da Vila', cap: 4, icone: 'anfiteatro', foto: [880, 400, 280, 200], etapas: [
    E('e1', 'Escavação e arquibancadas', 'Degraus de concreto no declive. Por baixo, uma bacia que retém e trata a água da chuva.', 20, 17000, { bloco: 5, concreto: 4 }, { bem: 3, servico: { agua: 1500, saneamento: 3000 } }),
    E('e2', 'Palco e iluminação', 'Palco de madeira, fundo curvo e luminárias.', 20, 17000, { deque: 4, luminaria: 4, perfil: 2 }, { bem: 10 }),
  ] },
  { id: 'pas_vila', nome: 'Passarela da Vila', cap: 4, icone: 'passarela', foto: [960, 420, 280, 200], requer: ['anfiteatro.e1'], etapas: [
    E('e1', 'Passarela elevada', 'Da Biblioteca até a Vila Estudantil, por cima da mata.', 15, 9000, { perfil: 4, deque: 3, guarda: 3 }, { bem: 3 }),
  ] },
  // ---------------- Capítulo 5 — Casa dos gigantes ----------------
  { id: 'santuarioInt', nome: 'Santuário: mata e fauna', cap: 5, icone: 'santuario', foto: [900, 90, 320, 229], requer: ['santuario.1'], etapas: [
    E('e1', 'Clareiras e mirantes', 'Rochas, clareiras e um biodigestor que transforma resíduos em energia.', 20, 19500, { brita: 5, deque: 3, muda: 3 }, { servico: { saneamento: 3000 } }),
    E('e2', 'Fauna resgatada', 'Elefantes e rinocerontes vindos de zoológicos fechados.', 40, 35500, { racao: 5, kitvet: 2 }, { bem: 2 }),
  ] },
  { id: 'savana', nome: 'Habitats Expandidos e Centro de Reabilitação', cap: 5, icone: 'savana', nomeCurto: 'Habitats e Reabilitação', foto: [870, 220, 280, 200], etapas: [
    E('e1', 'Cercados e trilhas', 'Cercas de madeira e trilhas de cascalho.', 15, 12500, { madeira: 7, deque: 3 }, { modo: 'crescer' }),
    E('e2', 'Lagoa e abrigos', 'Bebedouros, abrigos de sombra, rochas e acácias.', 25, 19500, { substrato: 3, muda: 5, bloco: 2 }, { modo: 'crescer', servico: { saneamento: 2000 } }),
    E('e3', 'Elefantes', 'Uma manada chega ao centro de reabilitação.', 40, 33500, { racao: 5, kitvet: 2 }, { modo: 'surgir' }),
    E('e4', 'Girafas e rinocerontes', 'O habitat se completa.', 45, 38500, { racao: 5, kitvet: 2 }, { bem: 2, modo: 'surgir' }),
  ] },
  { id: 'bioma', nome: 'Bioma Aquático de Conservação', cap: 5, icone: 'bioma', nomeCurto: 'Bioma Aquático', foto: [1010, 250, 280, 200], etapas: [
    E('e1', 'Fundação e tanque', 'O tanque do aquário, areia e rochas.', 30, 27500, { concreto: 5, premoldado: 3 }, { licencas: { estaca: 3, baliza: 3, trena: 3 } }),
    E('e2', 'Estrutura geodésica', 'Milhares de barras e nós formam a cúpula.', 45, 41500, { no: 7, perfil: 5 }),
    E('e3', 'Painéis de vidro', 'Cada triângulo recebe seu painel.', 60, 49500, { cupula: 9 }),
    E('e4', 'Aquário vivo', 'Água, baleia, arraias e cardumes em recuperação.', 60, 55000, { acrilico: 5, sensor: 2, racao: 3 }, { bem: 3, requer: ['lago.e3'] }),
  ] },
  { id: 'gorilas', nome: 'Recinto dos Gorilas', cap: 5, icone: 'gorilas', foto: [1010, 520, 280, 200], etapas: [
    E('e1', 'Rochedos e fosso', 'Rochedos de arenito e o gramado do recinto.', 20, 19500, { brita: 7, concreto: 3 }),
    E('e2', 'Passarela anelar', 'Um anel elevado com vidro para ver sem incomodar.', 30, 27500, { perfil: 5, deque: 3, guarda: 3 }),
    E('e3', 'Abrigo e árvores', 'Sombra e esconderijos.', 20, 19500, { muda: 5, madeira: 5 }, { modo: 'crescer' }),
    E('e4', 'Família de gorilas', 'Cinco gorilas resgatados chegam juntos.', 45, 41500, { racao: 5, kitvet: 2 }, { bem: 2, modo: 'surgir' }),
  ] },
  { id: 'pas_trilhaBioma', nome: 'Trilha do Bioma', cap: 5, icone: 'passarela', foto: [1000, 400, 280, 200], requer: ['bioma.e1'], etapas: [
    E('e1', 'Passarela sinuosa', 'Contorna a cúpula e desce até os gorilas.', 20, 12500, { perfil: 4, deque: 3, guarda: 2 }),
  ] },
  { id: 'pas_elo', nome: 'Elo do Santuário', cap: 5, icone: 'passarela', foto: [900, 180, 280, 200], requer: ['savana.e1'], etapas: [
    E('e1', 'Passarela elevada', 'Liga a savana ao anel do santuário.', 20, 12500, { perfil: 4, deque: 3, guarda: 2 }),
  ] },
  { id: 'pas_santuario', nome: 'Passeio do Santuário', cap: 5, icone: 'passarela', foto: [1050, 120, 280, 200], requer: ['santuario.1', 'savana.e1'], etapas: [
    E('e1', 'Passarela elevada', 'Um mirante contínuo sobre a mata do santuário.', 20, 12500, { perfil: 4, deque: 3, guarda: 2 }),
  ] },
  // ---------------- Epílogo ----------------
  { id: 'reflorestar', nome: 'Reflorestar o canteiro', cap: 6, icone: 'floresta', foto: [20, 520, 280, 200], etapas: [
    E('e0', 'Desmontar o canteiro', 'As oficinas descem para galpões sob o acelerador. Perfis, deques e vigas viram o piso dos galpões.', 30, 20000, { perfil: 4, deque: 4, viga: 6 }, { modo: 'desmontar', preEntrega: 5 }),
    E('e1', 'Replantar a mata', 'Mudas nativas, substrato e grama onde era o canteiro: a mata volta a fechar a clareira.', 45, 30000, { muda: 8, substrato: 4, grama: 6 }, { modo: 'reflorestar', preEntrega: 5 }),
  ] },
];
export const PROJ = Object.fromEntries(PROJETOS.map((p) => [p.id, p]));
// peça 3D de cada etapa (quando não é a própria peça "modelo.etapa")
export function alvoEtapa(p, e) { return e.alvo || { modelo: p.id, parte: e.id }; }

// Módulos: segmentos dos edifícios-fita que sobem um andar por nível (como as zonas do BuildIt).
export const MODULOS = {
  anel: { nome: 'Anel do Campus', sub: 'Moradias e salas de aula', cap: 1, foto: [80, 130, 420, 300], pop: 800, max: 5, inicio: 3 },
  uni: { nome: 'Campus Universitário', sub: 'Salas, laboratórios e moradias', cap: 3, foto: [260, 70, 320, 229], pop: 600, max: 5 },
  anelBib: { nome: 'Anel da Biblioteca', sub: 'Salas de estudo em terraços', cap: 3, foto: [640, 200, 320, 229], pop: 380, max: 3, requer: ['biblioteca.e1'] },
  casas: { nome: 'Vila Estudantil Expandida', sub: 'Casas brancas empilhadas', cap: 4, nomeCurto: 'Vila Estudantil', foto: [960, 400, 280, 200], pop: 130, max: 3, requer: ['anfiteatro.e1'] },
  santuario: { nome: 'Santuário de Animais e Centro de Conservação', sub: 'Clínicas, pesquisa e moradia de pesquisadores', cap: 5, nomeCurto: 'Santuário', foto: [880, 80, 320, 229], pop: 320, max: 4 },
};
// os prédios da cidade em volta da Arcologia também são faixas de módulos (de tamanho variável: um item por prédio
// colocado); pop é a do nível máximo e popNivel dá os moradores de cada nível
for (const [k, v] of Object.entries(CIDADE)) MODULOS[k] = { ...v, pop: v.popNivel ? v.popNivel[v.max] : 0, cidade: true };
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
export const CUSTO_NIVEL = [0, 200, 700, 1800, 4500, 9000];
export const TEMPO_NIVEL = [0, 60, 180, 480, 900, 1500];
// serviços exigidos a partir de cada nível (cumulativos) e o bem-estar mínimo do último pavimento
export const SERVICO_NIVEL = { 3: ['agua'], 4: ['energia', 'saneamento'] };
export const BEM_NIVEL = { 5: 70 };
// pressão de moradia: cada tantos moradores tiram 1 ponto de bem-estar (mais gente pede mais praça, escola e verde)
export const PRESSAO_MORADIA = 200;
