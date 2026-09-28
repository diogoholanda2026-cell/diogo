// Registro das cenas fixas (?cena=<nome>): as vistas da bancada (A6), das capturas do dono (A10) e das provas. Cada
// arquivo de cena exporta registrar(registrarCena) e chama registrarCena(nome, def) com a sua; este índice é fixo e
// nenhuma parcela o edita. Donas: fonte/contratos/render.js (CENAS).
//
// def = {
//   sim: 'sintetica' | 'partida' | 'vazia',   // o que o app cria antes (padrão 'sintetica': a cidade de 12 mil prédios)
//   dominios: true,                           // false: a cena desenha sozinha (sem terreno, prédios e vias do jogo)
//   camera: { x, z, dist, guinada, inclinacao },
//   hora: 10,                                 // hora do céu fixa (?hora= troca; ?sol=anda faz andar a partir dela)
//   perfil: 'media',                          // opcional: perfil fixo da cena (?q= troca)
//   async montar(ctx) → { quadro?(tMs, ctx), resultado?() → { ok, falhas: [texto], ... }, descartar?() }
// }
// ctx é o contexto interno do render (index.js): THREE, renderer, cena, camera, sombra, ganchos, medidas, sol, sim...
// resultado() vai para window.__resultado (a bancada falha se ok for false).
// As cenas vêm sob demanda (import dinâmico, um pedaço do pacote por cena): o jogo não carrega o código delas (A1).
// Cada arquivo registra a cena com o nome do próprio arquivo.
const CARREGAR = Object.freeze({
  aberta: () => import('./aberta.js'),
  horizonte: () => import('./horizonte.js'),
  noite: () => import('./noite.js'),
  estresse: () => import('./estresse.js'),
  'prova-sombra': () => import('./prova-sombra.js'),
  costa: () => import('./costa.js'),
  materiais: () => import('./materiais.js'),
  rua: () => import('./rua.js'),
  bairro: () => import('./bairro.js'),
  obra: () => import('./obra.js'),
  servicos: () => import('./servicos.js'),
  torre: () => import('./torre.js'),
  planos: () => import('./planos.js'),
  ferramentas: () => import('./ferramentas.js'),
  camadas: () => import('./camadas.js'),
});

const cenas = new Map();

/** Registra uma cena. Registrar de novo o mesmo nome troca (a parcela dona substitui a versão de prova). */
export function registrarCena(nome, def) {
  if (!def || typeof def.montar !== 'function') throw new Error(`registrarCena(${nome}): falta montar(ctx)`);
  cenas.set(nome, { sim: 'sintetica', dominios: true, hora: 10, ...def, nome });
}

/** Carrega o arquivo da cena e devolve a definição (null se o nome não existe). */
export async function carregarCena(nome) {
  if (!cenas.has(nome) && Object.hasOwn(CARREGAR, nome)) (await CARREGAR[nome]()).registrar?.(registrarCena);
  return cenas.get(nome) ?? null;
}

/** Definição de uma cena já carregada (null se ainda não veio por carregarCena ou se ninguém registrou esse nome). */
export function obterCena(nome) {
  return cenas.get(nome) ?? null;
}

/** Nomes das cenas (as do índice e as registradas à parte). */
export function listarCenas() {
  return [...new Set([...Object.keys(CARREGAR), ...cenas.keys()])];
}
