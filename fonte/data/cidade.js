// Cidade em volta da Arcologia (mundo aberto): bairros com lotes de 4 x 4 e ruas de 1,2 além da faixa de mata, e os
// prédios que o jogador coloca. Cada TIPO é uma faixa de módulos de tamanho variável (entra em MODULOS): o nível 1 é
// a construção (só créditos, sem materiais, como pôr uma zona no BuildIt) e os níveis seguintes pedem materiais,
// serviços e bem-estar como os módulos da Arcologia. Serviços e lazer têm um nível só.
//
// Contrato:
//   BAIRROS[id] {nome, x0, z0, nx, nz, preco, cap}; lotesDoBairro(id) → [{id, bairro, i, j, x, z}]; loteDe(id) → lote;
//   CIDADE[f] {cat, nome, sub, icone, cap, max, popNivel[], custo[], tempo[], servico?, bem?, renda?, cobre?, unico?};
//   lucro?, empregos?, efeito? (empresas); TIPOS_CIDADE (ids); ehCidade(f); PRECO_TERRENO[b]; EFEITO_EMPRESA[f]; COBERTURAS[k] {nome, icone, tipos[]}; exigeNivel(n) → coberturas que o nível n de
//   uma moradia da cidade pede (as dos níveis de baixo também).
export const LOTE = { tam: 4, rua: 1.2 };
export const PASSO = LOTE.tam + LOTE.rua;
// bairros alinhados à grade (em lotes), fora da faixa de mata da Arcologia (x -38..39, z -29..26) e longe da praia
// (a oeste de x = -45 começam as dunas; mais ao norte e ao sul a costa entra, e os bairros de fora recuam). O Sul
// abre de graça; os outros se compram quando o capítulo chega, cada vez mais longe e mais caros (dez bairros,
// ~950 lotes: o triplo da primeira cidade). Depois do capítulo 6 a cidade continua crescendo.
export const BAIRROS = {
  sul: { nome: 'Bairro Sul', x0: -44, z0: 31, nx: 19, nz: 7, preco: 0, cap: 1 },
  leste: { nome: 'Bairro Leste', x0: 45, z0: -28.2, nx: 8, nz: 11, preco: 25000, cap: 2 },
  norte: { nome: 'Bairro Norte', x0: -44, z0: -72.4, nx: 19, nz: 7, preco: 60000, cap: 3 },
  sudeste: { nome: 'Bairro Sudeste', x0: 60, z0: 31, nx: 8, nz: 7, preco: 90000, cap: 3 },
  nordeste: { nome: 'Bairro Nordeste', x0: 60, z0: -72.4, nx: 8, nz: 7, preco: 140000, cap: 4 },
  leste2: { nome: 'Bairro Leste Alto', x0: 91, z0: -28.2, nx: 8, nz: 11, preco: 200000, cap: 4 },
  sudeste2: { nome: 'Bairro da Enseada', x0: 106, z0: 31, nx: 7, nz: 7, preco: 240000, cap: 5 },
  nordeste2: { nome: 'Bairro da Serra', x0: 106, z0: -72.4, nx: 7, nz: 7, preco: 240000, cap: 5 },
  sul2: { nome: 'Bairro Sul Novo', x0: -36, z0: 72.6, nx: 19, nz: 8, preco: 320000, cap: 6 },
  norte2: { nome: 'Bairro Norte Novo', x0: -36, z0: -119.6, nx: 19, nz: 8, preco: 400000, cap: 6 },
};
export const ORDEM_BAIRROS = ['sul', 'leste', 'norte', 'sudeste', 'nordeste', 'leste2', 'sudeste2', 'nordeste2', 'sul2', 'norte2'];
const _lotes = new Map(), _porBairro = {};
for (const [b, B] of Object.entries(BAIRROS)) {
  _porBairro[b] = [];
  for (let j = 0; j < B.nz; j++) for (let i = 0; i < B.nx; i++) {
    const l = { id: `${b}:${i}:${j}`, bairro: b, i, j, x: B.x0 + i * PASSO + LOTE.tam / 2, z: B.z0 + j * PASSO + LOTE.tam / 2 };
    _lotes.set(l.id, l); _porBairro[b].push(l);
  }
}
// aeroporto: área própria plana a leste do Leste Alto, fora dos bairros (pista ao longo de z); o prédio 'cidAeroporto'
// ocupa o lote especial 'aeroporto', no centro da área
export const AEROPORTO = { x0: 146, z0: -26, x1: 190, z1: 26, x: 168, z: 0 };
_lotes.set('aeroporto', { id: 'aeroporto', bairro: 'aeroporto', i: 0, j: 0, x: AEROPORTO.x, z: AEROPORTO.z });
export const lotesDoBairro = (b) => _porBairro[b] || [];
export const loteDe = (id) => _lotes.get(id) || null;
// extensão de um bairro em mundo (com a rua em volta)
export function areaBairro(b) { const B = BAIRROS[b]; return { x0: B.x0 - LOTE.rua, z0: B.z0 - LOTE.rua, x1: B.x0 + B.nx * PASSO, z1: B.z0 + B.nz * PASSO }; }
// bairro que contém o ponto (com a rua em volta), ou null
export function bairroEm(x, z) { for (const b of ORDEM_BAIRROS) { const a = areaBairro(b); if (x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1) return b; } return null; }
// o lote mais perto do ponto (dentro de meio passo), ou null
export function loteEm(x, z) {
  const b = bairroEm(x, z); if (!b) return null; const B = BAIRROS[b];
  const i = Math.floor((x - B.x0 + LOTE.rua / 2) / PASSO), j = Math.floor((z - B.z0 + LOTE.rua / 2) / PASSO);
  return i >= 0 && j >= 0 && i < B.nx && j < B.nz ? loteDe(`${b}:${i}:${j}`) : null;
}

// Tipos de prédio. popNivel: moradores em cada nível; custo e tempo (s) por nível (o 1 é a construção); servico:
// capacidade somada (água, energia, saneamento) com o prédio pronto; bem: pontos de bem-estar (os quatro primeiros
// de cada tipo contam inteiros, os seguintes pela metade); cobre: raio de atendimento (em unidades, entre os centros
// dos lotes) de polícia, saúde, escola ou faculdade, como no BuildIt; unico: um só na cidade.
export const CIDADE = {
  cidCasas: { cat: 'moradia', nome: 'Casas com jardim', sub: 'Sobrados creme com telhado verde e quintal', icone: 'casa', cap: 1, max: 3,
    popNivel: [0, 60, 140, 240], custo: [0, 300, 900, 2400], tempo: [0, 40, 150, 420] },
  cidTerraco: { cat: 'moradia', nome: 'Edifício em terraços', sub: 'Lajes creme escalonadas com jardins, como os anéis', icone: 'predio', cap: 2, max: 5,
    popNivel: [0, 140, 320, 560, 880, 1260], custo: [0, 900, 2000, 4200, 8000, 14000], tempo: [0, 90, 240, 600, 1100, 1800] },
  cidLuxo: { cat: 'moradia', nome: 'Residencial de luxo', sub: 'Torre de vidro e dourado com piscina no pódio e heliponto no topo', icone: 'luxo', cap: 4, max: 5, renda: 0.01,
    popNivel: [0, 180, 420, 760, 1150, 1600], custo: [0, 8000, 15000, 26000, 40000, 62000], tempo: [0, 240, 600, 1200, 2000, 3000] },
  cidTorre: { cat: 'moradia', nome: 'Torre-jardim', sub: 'Torre de vidro com jardins verticais', icone: 'torre', cap: 3, max: 5,
    popNivel: [0, 320, 720, 1240, 1900, 2800], custo: [0, 2500, 5000, 9000, 15000, 24000], tempo: [0, 150, 420, 900, 1500, 2400] },
  cidPrefeitura: { cat: 'servico', nome: 'Prefeitura', sub: 'Paço municipal com torre do relógio e praça cívica', icone: 'prefeitura', cap: 1, max: 1, unico: true, bem: 5, custo: [0, 5000], tempo: [0, 240] },
  cidAgua: { cat: 'servico', nome: 'Estação de água e reuso', sub: 'Tanques, filtros e reservatório', icone: 'agua', cap: 1, max: 1, servico: { agua: 4000 }, custo: [0, 2500], tempo: [0, 120] },
  cidEnergia: { cat: 'servico', nome: 'Usina solar', sub: 'Painéis sobre a pérgola e baterias', icone: 'energia', cap: 1, max: 1, servico: { energia: 4000 }, custo: [0, 3000], tempo: [0, 150] },
  cidHidreletrica: { cat: 'servico', nome: 'Hidrelétrica', sub: 'Represa, barragem com turbinas e linha de transmissão', icone: 'hidreletrica', cap: 3, max: 1, servico: { energia: 15000 }, custo: [0, 14000], tempo: [0, 540] },
  cidSaneamento: { cat: 'servico', nome: 'Empresa de saneamento básico', sub: 'Tratamento de esgoto com lagoas e jardins filtrantes', icone: 'saneamento', cap: 1, max: 1, servico: { saneamento: 4000 }, custo: [0, 3000], tempo: [0, 150] },
  cidSeguranca: { cat: 'servico', nome: 'Delegacia de polícia', sub: 'Delegacia com viaturas e torre de rádio', icone: 'seguranca', cap: 1, max: 1, bem: 4, cobre: { policia: 28 }, custo: [0, 2400], tempo: [0, 120] },
  cidSaude: { cat: 'servico', nome: 'Posto de saúde', sub: 'Clínica de bairro', icone: 'saude', cap: 1, max: 1, bem: 5, cobre: { saude: 22 }, custo: [0, 2200], tempo: [0, 120] },
  cidHospital: { cat: 'servico', nome: 'Hospital', sub: 'Blocos brancos com heliponto e jardim', icone: 'hospital', cap: 3, max: 1, bem: 8, cobre: { saude: 45 }, custo: [0, 9000], tempo: [0, 360] },
  cidEscola: { cat: 'servico', nome: 'Escola do bairro', sub: 'Salas em volta de um pátio', icone: 'escola', cap: 1, max: 1, bem: 5, cobre: { educacao: 28 }, custo: [0, 2600], tempo: [0, 150] },
  cidFaculdade: { cat: 'servico', nome: 'Faculdade', sub: 'Campus com biblioteca, laboratórios e gramado', icone: 'faculdade', cap: 3, max: 1, bem: 6, cobre: { superior: 60 }, custo: [0, 10000], tempo: [0, 420] },
  cidAeroporto: { cat: 'servico', nome: 'Aeroporto', sub: 'Pista, terminal de passageiros, torre de controle e hangares', icone: 'aeroporto', cap: 5, max: 3, unico: true, lugar: 'aeroporto', bem: 10, renda: 0.04,
    custo: [0, 40000, 80000, 150000], tempo: [0, 900, 1800, 3600] },
  cidEstacao: { cat: 'servico', nome: 'Estação de VLT', sub: 'Parada coberta sobre os trilhos', icone: 'estacao', cap: 2, max: 1, bem: 4, custo: [0, 3500], tempo: [0, 150] },
  cidPraca: { cat: 'lazer', nome: 'Praça', sub: 'Piso claro, árvores e bancos', icone: 'praca', cap: 1, max: 1, bem: 3, custo: [0, 800], tempo: [0, 40] },
  cidParque: { cat: 'lazer', nome: 'Parque com lago', sub: 'Gramado, lago e caminhos', icone: 'parque', cap: 2, max: 1, bem: 6, custo: [0, 2000], tempo: [0, 90] },
  cidCultura: { cat: 'lazer', nome: 'Centro cultural', sub: 'Teatro e museu em volta de uma praça', icone: 'cultura', cap: 3, max: 1, bem: 6, custo: [0, 6000], tempo: [0, 240] },
  cidEstadio: { cat: 'lazer', nome: 'Arena esportiva', sub: 'Campo com arquibancada coberta', icone: 'estadio', cap: 4, max: 1, bem: 10, custo: [0, 15000], tempo: [0, 480] },
  // comércio: renda a mais por morador (cada nível soma renda; a cidade inteira soma até +45%)
  cidComercio: { cat: 'comercio', nome: 'Rua comercial', sub: 'Lojas no térreo e escritórios em cima', icone: 'comercio', cap: 1, max: 3, renda: 0.01, custo: [0, 600, 1500, 3600], tempo: [0, 60, 200, 520] },
  cidEscritorio: { cat: 'comercio', nome: 'Centro de negócios', sub: 'Torre de escritórios com terraços verdes', icone: 'escritorio', cap: 3, max: 5, renda: 0.015, custo: [0, 3000, 6000, 11000, 18000, 28000], tempo: [0, 180, 480, 1000, 1700, 2600] },
  // empresas da Holding (só em terreno da Holding: o terreno é comprado junto se preciso): lucro por hora e empregos por
  // nível (o lucro cai se faltar gente para os empregos) e um efeito na obra
  cidConstrutora: { cat: 'empresa', nome: 'Construtora', sub: 'Escritório, pátio de máquinas e depósito', icone: 'construtora', cap: 2, max: 5, lucro: 250, empregos: 60, efeito: 'obras e pavimentos 3% mais rápidos por nível (até 25%)',
    custo: [0, 5000, 9000, 16000, 26000, 40000], tempo: [0, 180, 420, 900, 1500, 2400] },
  cidFabrica: { cat: 'empresa', nome: 'Fábrica de materiais', sub: 'Galpões com telhado em serra, silos e chaminé', icone: 'fabrica', cap: 2, max: 5, lucro: 300, empregos: 90, efeito: 'produz 2 matérias-primas por hora e por nível direto no almoxarifado',
    custo: [0, 6000, 11000, 19000, 30000, 46000], tempo: [0, 200, 480, 1000, 1600, 2600] },
  cidLogistica: { cat: 'empresa', nome: 'Centro logístico', sub: 'Armazém com docas, caminhões e contêineres', icone: 'logistica', cap: 3, max: 5, lucro: 280, empregos: 70, efeito: '+30 vagas no almoxarifado por nível',
    custo: [0, 7000, 12000, 20000, 32000, 48000], tempo: [0, 200, 480, 1000, 1600, 2600] },
  cidShopping: { cat: 'empresa', nome: 'Shopping', sub: 'Galerias de vidro com átrio e jardim na cobertura', icone: 'shopping', cap: 3, max: 5, lucro: 500, empregos: 120, bem: 4, efeito: '+2% de renda dos moradores por nível (até 20%)',
    custo: [0, 12000, 20000, 32000, 50000, 75000], tempo: [0, 300, 600, 1200, 2000, 3000] },
  cidBanco: { cat: 'empresa', nome: 'Banco', sub: 'Torre de vidro espelhado com coroa dourada', icone: 'banco', cap: 4, max: 5, lucro: 800, empregos: 50, efeito: 'juros do empréstimo 2 pontos menores por nível (até 2% ao ano)',
    custo: [0, 20000, 32000, 50000, 75000, 110000], tempo: [0, 360, 720, 1400, 2200, 3200] },
  cidMercado: { cat: 'comercio', nome: 'Mercado municipal', sub: 'Galpão de vidro com feira', icone: 'mercado', cap: 2, max: 1, renda: 0.03, bem: 3, custo: [0, 4000], tempo: [0, 180] },
};
export const RENDA_CIDADE_MAX = 0.45;
// serviços com área de atendimento: a moradia da cidade só sobe de nível com eles por perto (a Prefeitura vale para a
// cidade inteira). Nível 2 pede polícia e escola; 3, saúde; 4, faculdade; 5, a Prefeitura.
export const COBERTURAS = {
  policia: { nome: 'Polícia', icone: 'seguranca', tipos: ['cidSeguranca'] },
  educacao: { nome: 'Escola', icone: 'escola', tipos: ['cidEscola'] },
  saude: { nome: 'Saúde', icone: 'saude', tipos: ['cidSaude', 'cidHospital'] },
  superior: { nome: 'Faculdade', icone: 'faculdade', tipos: ['cidFaculdade'] },
  prefeitura: { nome: 'Prefeitura', icone: 'prefeitura', tipos: ['cidPrefeitura'], global: true },
};
const EXIGE = { 2: ['policia', 'educacao'], 3: ['saude'], 4: ['superior'], 5: ['prefeitura'] };
export const exigeNivel = (n) => { const out = []; for (let k = 2; k <= n; k++) if (EXIGE[k]) out.push(...EXIGE[k]); return out; };
export const TIPOS_CIDADE = Object.keys(CIDADE);
export const ehCidade = (f) => Object.prototype.hasOwnProperty.call(CIDADE, f);
export const CATEGORIAS_CIDADE = [['moradia', 'Moradia'], ['comercio', 'Comércio'], ['servico', 'Serviços'], ['lazer', 'Lazer'], ['empresa', 'Empresas da Holding']];
// terrenos: preço base de um lote por bairro; valoriza com a ocupação do bairro (até o triplo com o bairro cheio)
export const PRECO_TERRENO = { sul: 400, leste: 600, norte: 700, sudeste: 800, nordeste: 1000, leste2: 1200, sudeste2: 1400, nordeste2: 1400, sul2: 1600, norte2: 1800 };
// efeitos das empresas por nível e seus tetos
export const EFEITO_EMPRESA = { cidConstrutora: { obra: 0.03 }, cidFabrica: { fabrica: 2 }, cidLogistica: { almox: 30 }, cidShopping: { renda: 0.02 }, cidBanco: { juros: 0.02 } };
export const TETO_EMPRESA = { obra: 0.25, renda: 0.2, taxaMin: 0.02 };
export const MAX_POR_TIPO = 270; // teto de prédios de um tipo (o save guarda até isso): o triplo do primeiro
