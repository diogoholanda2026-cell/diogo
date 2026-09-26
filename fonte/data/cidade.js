// Cidade em volta da Arcologia (mundo aberto): bairros com lotes de 4 x 4 e ruas de 1,2 além da faixa de mata, e os
// prédios que o jogador coloca. Cada TIPO é uma faixa de módulos de tamanho variável (entra em MODULOS): o nível 1 é
// a construção (só créditos, sem materiais, como pôr uma zona no BuildIt) e os níveis seguintes pedem materiais,
// serviços e bem-estar como os módulos da Arcologia. Serviços e lazer têm um nível só.
//
// Contrato:
//   BAIRROS[id] {nome, x0, z0, nx, nz, preco, cap}; lotesDoBairro(id) → [{id, bairro, i, j, x, z}]; loteDe(id) → lote;
//   CIDADE[f] {cat, nome, sub, icone, cap, max, popNivel[], custo[], tempo[], servico?, bem?, renda?}; TIPOS_CIDADE (ids);
//   ehCidade(f).
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
// de cada tipo contam inteiros, os seguintes pela metade).
export const CIDADE = {
  cidCasas: { cat: 'moradia', nome: 'Casas com jardim', sub: 'Sobrados creme com telhado verde e quintal', icone: 'casa', cap: 1, max: 3,
    popNivel: [0, 60, 140, 240], custo: [0, 300, 900, 2400], tempo: [0, 40, 150, 420] },
  cidTerraco: { cat: 'moradia', nome: 'Edifício em terraços', sub: 'Lajes creme escalonadas com jardins, como os anéis', icone: 'predio', cap: 2, max: 5,
    popNivel: [0, 140, 320, 560, 880, 1260], custo: [0, 900, 2000, 4200, 8000, 14000], tempo: [0, 90, 240, 600, 1100, 1800] },
  cidTorre: { cat: 'moradia', nome: 'Torre-jardim', sub: 'Torre de vidro com jardins verticais', icone: 'torre', cap: 3, max: 5,
    popNivel: [0, 320, 720, 1240, 1900, 2800], custo: [0, 2500, 5000, 9000, 15000, 24000], tempo: [0, 150, 420, 900, 1500, 2400] },
  cidAgua: { cat: 'servico', nome: 'Estação de água e reuso', sub: 'Tanques, filtros e reservatório', icone: 'agua', cap: 1, max: 1, servico: { agua: 4000 }, custo: [0, 2500], tempo: [0, 120] },
  cidEnergia: { cat: 'servico', nome: 'Usina solar', sub: 'Painéis sobre a pérgola e baterias', icone: 'energia', cap: 1, max: 1, servico: { energia: 4000 }, custo: [0, 3000], tempo: [0, 150] },
  cidSaneamento: { cat: 'servico', nome: 'Saneamento verde', sub: 'Estação de tratamento com jardins filtrantes', icone: 'saneamento', cap: 1, max: 1, servico: { saneamento: 4000 }, custo: [0, 3000], tempo: [0, 150] },
  cidSaude: { cat: 'servico', nome: 'Posto de saúde', sub: 'Clínica de bairro', icone: 'saude', cap: 1, max: 1, bem: 5, custo: [0, 2200], tempo: [0, 120] },
  cidEscola: { cat: 'servico', nome: 'Escola do bairro', sub: 'Salas em volta de um pátio', icone: 'escola', cap: 2, max: 1, bem: 5, custo: [0, 2600], tempo: [0, 150] },
  cidSeguranca: { cat: 'servico', nome: 'Segurança e bombeiros', sub: 'Posto com garagem e torre', icone: 'seguranca', cap: 2, max: 1, bem: 4, custo: [0, 2400], tempo: [0, 120] },
  cidEstacao: { cat: 'servico', nome: 'Estação de VLT', sub: 'Parada coberta sobre os trilhos', icone: 'estacao', cap: 2, max: 1, bem: 4, custo: [0, 3500], tempo: [0, 150] },
  cidHospital: { cat: 'servico', nome: 'Hospital', sub: 'Blocos brancos com heliponto e jardim', icone: 'hospital', cap: 4, max: 1, bem: 8, custo: [0, 9000], tempo: [0, 360] },
  cidPraca: { cat: 'lazer', nome: 'Praça', sub: 'Piso claro, árvores e bancos', icone: 'praca', cap: 1, max: 1, bem: 3, custo: [0, 800], tempo: [0, 40] },
  cidParque: { cat: 'lazer', nome: 'Parque com lago', sub: 'Gramado, lago e caminhos', icone: 'parque', cap: 2, max: 1, bem: 6, custo: [0, 2000], tempo: [0, 90] },
  cidCultura: { cat: 'lazer', nome: 'Centro cultural', sub: 'Teatro e museu em volta de uma praça', icone: 'cultura', cap: 3, max: 1, bem: 6, custo: [0, 6000], tempo: [0, 240] },
  cidEstadio: { cat: 'lazer', nome: 'Arena esportiva', sub: 'Campo com arquibancada coberta', icone: 'estadio', cap: 4, max: 1, bem: 10, custo: [0, 15000], tempo: [0, 480] },
  // comércio: renda a mais por morador (cada nível soma renda; a cidade inteira soma até +45%)
  cidComercio: { cat: 'comercio', nome: 'Rua comercial', sub: 'Lojas no térreo e escritórios em cima', icone: 'comercio', cap: 1, max: 3, renda: 0.01, custo: [0, 600, 1500, 3600], tempo: [0, 60, 200, 520] },
  cidEscritorio: { cat: 'comercio', nome: 'Centro de negócios', sub: 'Torre de escritórios com terraços verdes', icone: 'escritorio', cap: 3, max: 5, renda: 0.015, custo: [0, 3000, 6000, 11000, 18000, 28000], tempo: [0, 180, 480, 1000, 1700, 2600] },
  cidMercado: { cat: 'comercio', nome: 'Mercado municipal', sub: 'Galpão de vidro com feira', icone: 'mercado', cap: 2, max: 1, renda: 0.03, bem: 3, custo: [0, 4000], tempo: [0, 180] },
};
export const RENDA_CIDADE_MAX = 0.45;
export const TIPOS_CIDADE = Object.keys(CIDADE);
export const ehCidade = (f) => Object.prototype.hasOwnProperty.call(CIDADE, f);
export const CATEGORIAS_CIDADE = [['moradia', 'Moradia'], ['comercio', 'Comércio'], ['servico', 'Serviços'], ['lazer', 'Lazer']];
export const MAX_POR_TIPO = 270; // teto de prédios de um tipo (o save guarda até isso): o triplo do primeiro
