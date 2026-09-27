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
import * as aberta from './aberta.js';
import * as horizonte from './horizonte.js';
import * as noite from './noite.js';
import * as estresse from './estresse.js';
import * as provaSombra from './prova-sombra.js';
import * as costa from './costa.js';
import * as materiais from './materiais.js';
import * as rua from './rua.js';
import * as bairro from './bairro.js';
import * as obra from './obra.js';
import * as servicos from './servicos.js';
import * as torre from './torre.js';
import * as planos from './planos.js';
import * as ferramentas from './ferramentas.js';
import * as camadas from './camadas.js';

const MODULOS = [aberta, horizonte, noite, estresse, provaSombra, costa, materiais, rua, bairro, obra, servicos, torre, planos, ferramentas, camadas];

const cenas = new Map();
let registradas = false;

/** Registra uma cena. Registrar de novo o mesmo nome troca (a parcela dona substitui a versão de prova). */
export function registrarCena(nome, def) {
  if (!def || typeof def.montar !== 'function') throw new Error(`registrarCena(${nome}): falta montar(ctx)`);
  cenas.set(nome, { sim: 'sintetica', dominios: true, hora: 10, ...def, nome });
}

function registrarTodas() {
  if (registradas) return;
  registradas = true;
  for (const m of MODULOS) m.registrar?.(registrarCena);
}

/** Definição de uma cena (null se ninguém registrou esse nome). */
export function obterCena(nome) {
  registrarTodas();
  return cenas.get(nome) ?? null;
}

/** Nomes das cenas registradas. */
export function listarCenas() {
  registrarTodas();
  return [...cenas.keys()];
}
