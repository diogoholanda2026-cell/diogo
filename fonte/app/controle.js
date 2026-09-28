// Controle do app (seção 2.8): cria a simulação, o render e a interface, liga os três e o laço, e é o objeto `jogo`
// que a interface recebe (novaPartida, salvar, carregar, listarSaves, exportar, importar, prefs, evento 'salvo').
// Salvar, carregar e o diário são da U2a (app/armazem.js, diario.js, salvamento.js): entram por registrar(app) e
// trocam as funções por app.implementar({...}); até lá respondem { ok: false, codigo: 'nada' }. Os sons (som/*.js)
// entram do mesmo jeito. Comandos da interface passam por ui/acoes.js; o app usa as mesmas ações.
//
// Tipos de simulação: 'partida' (o jogo: o mapa autoral da S1a com a Vila e a rodovia; o canteiro de prova da F0 saiu
// na I1), 'sintetica' (a cidade sintética de 12 mil prédios, ferramentas/cidade-sintetica.mjs, carregada sob demanda) e
// 'vazia' (só o núcleo, para cenas que desenham sozinhas).
import { criarSimulacao } from '../sim/estado.js';
import { criarRender, carregarCena } from '../render/index.js';
import { criarUI } from '../ui/index.jsx';
import { comando } from '../ui/acoes.js';
import { lerPrefs, gravarPrefs, aplicarPrefs } from '../ui/prefs.js';
import { criarLaco } from './laco.js';
import * as armazem from './armazem.js';
import * as diario from './diario.js';
import * as salvamento from './salvamento.js';
import * as som from '../som/som.js';
import * as somInterface from '../som/interface.js';
import * as somMundo from '../som/mundo.js';
import * as somMusica from '../som/musica.js';

/** Índice fixo dos módulos do app (registrar(app)), na ordem. */
export const MODULOS_APP = Object.freeze([armazem, diario, salvamento, som, somInterface, somMundo, somMusica]);

export const SEMENTE_PADRAO = 'heldopolis-1';

/**
 * Câmeras de partida por tipo de simulação (graus; contrato em fonte/contratos/render.js). A da partida olha da baía
 * para o norte: a Vila de Santa Cida na foz à esquerda, o Rio Held, a planície da área inicial, a rodovia e a serra
 * ao fundo, e o fantasma da Arcologia no platô à direita.
 */
export const CAMERAS = Object.freeze({
  partida: { x: -300, z: -80, dist: 2300, guinada: -14, inclinacao: 33 },
  sintetica: { x: 60, z: 240, dist: 3400, guinada: 18, inclinacao: 30 },
  vazia: { x: 0, z: 0, dist: 400, guinada: 0, inclinacao: 35 },
});

// ------------------------------------------------------------------------------------------------ controle

/**
 * Cria a simulação de um tipo.
 * @param {'partida' | 'sintetica' | 'vazia'} tipo
 */
export async function criarSimDoTipo(tipo, { semente = SEMENTE_PADRAO, holding = null, modo = null, trabalhador = null } = {}) {
  if (tipo === 'sintetica') {
    const { gerarCidadeSintetica, SINTETICA } = await import('../../ferramentas/cidade-sintetica.mjs');
    const sim = criarSimulacao({ semente: SINTETICA.semente, dominios: false, trabalhador });
    gerarCidadeSintetica({ sim });
    return sim;
  }
  if (tipo === 'vazia') return criarSimulacao({ semente, dominios: false, trabalhador });
  return criarSimulacao({ semente, holding, modo, trabalhador });
}

const nada = async () => ({ ok: false, codigo: 'nada' });

/** Vidro com desfoque na barra de cima (ui.md 3.2): só no PC com o perfil Alta ou Ultra (marca data-vidro na raiz). */
export function marcarVidro(R) {
  if (typeof document === 'undefined') return;
  const movel = typeof navigator !== 'undefined' && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || '');
  const id = R.perfil?.().id;
  document.documentElement.dataset.vidro = !movel && (id === 'alta' || id === 'ultra') ? '1' : '0';
}

/**
 * Monta o jogo.
 * @param {{ canvas: HTMLCanvasElement, raizUI: HTMLElement, qs: URLSearchParams, carga: { fase(chave, pct), sair() } }} op
 * @returns {Promise<object>} o app (jogo)
 */
export async function criarControle({ canvas, raizUI, qs, carga }) {
  const nomeCena = qs.get('cena') || null;
  const defCena = nomeCena ? await carregarCena(nomeCena) : null;
  if (nomeCena && !defCena) throw new Error(`cena desconhecida: ${nomeCena}`);
  const modoUI = qs.get('ui') ?? (nomeCena ? '0' : '1'); // cenas saem limpas; ?ui=1 ou ?ui=vitrine põe a interface
  const tipo = defCena ? defCena.sim : qs.get('sintetica') === '1' ? 'sintetica' : 'partida';
  const montagem = window.__HELD_MONTAGEM__ ?? null;
  const prefs = lerPrefs();
  aplicarPrefs(prefs);

  // worker `tarefas` (D15): um só, servindo à simulação atual
  let trabalhador = null;
  if (montagem?.workers?.tarefas && typeof Worker !== 'undefined') {
    try {
      trabalhador = new Worker(montagem.workers.tarefas);
    } catch (e) {
      console.warn('worker tarefas não abriu; as tarefas rodam na thread principal', e);
    }
  }

  carga.fase('carga.mundo', 20);
  let sim = await criarSimDoTipo(tipo, { semente: qs.get('semente') || SEMENTE_PADRAO, trabalhador });
  const fonte = {
    get espelho() {
      return sim.espelho;
    },
    get mudancas() {
      return sim.mudancas;
    },
  };

  carga.fase('carga.ceu', 45);
  const hora = qs.has('hora') ? Number(qs.get('hora')) : null;
  const R = await criarRender(canvas, {
    sim: fonte,
    qualidade: qs.get('q') || (prefs.qualidade !== 'auto' ? prefs.qualidade : 'auto'),
    pr: Number(qs.get('pr')) || 0,
    semClip: qs.get('semClip') === '1',
    cena: nomeCena,
    camera: CAMERAS[tipo] ?? CAMERAS.partida,
    solAnda: qs.get('sol') === 'anda',
    hora: Number.isFinite(hora) ? hora : null,
    depuracao: qs.get('depuracao') === '1',
  });
  if (prefs.sempreDia) R.sempreDia(true);
  marcarVidro(R);

  const eventos = new Map();
  let laco = null;
  const aoQuadro = [];
  const aoFundo = [];
  let ui = null;
  const app = {
    get sim() {
      return sim;
    },
    R,
    get ui() {
      return ui;
    },
    prefs,
    tipo,
    cena: nomeCena,
    /** Grava e aplica as preferências (U2a): página, render e o sinal que a interface lê. */
    gravarPrefs(p = {}) {
      Object.assign(prefs, p);
      aplicarPrefs(prefs);
      if ('sempreDia' in p) R.sempreDia(!!prefs.sempreDia);
      if ('qualidade' in p && !qs.get('q')) {
        R.qualidade(prefs.qualidade);
        marcarVidro(R);
      }
      if (ui && !app.simUIFalsa) ui.ui.loja.prefs.value = { ...prefs };
      return gravarPrefs(prefs);
    },
    on(nome, fn) {
      const l = eventos.get(nome) ?? [];
      l.push(fn);
      eventos.set(nome, l);
      return () => eventos.set(nome, (eventos.get(nome) ?? []).filter((f) => f !== fn));
    },
    emitir(nome, dados) {
      for (const fn of eventos.get(nome) ?? []) {
        try {
          fn(dados);
        } catch (e) {
          console.error(`app: ouvinte de ${nome} falhou`, e);
        }
      }
    },
    aoQuadro(fn) {
      aoQuadro.push(fn);
      return () => {
        const i = aoQuadro.indexOf(fn);
        if (i >= 0) aoQuadro.splice(i, 1);
      };
    },
    aoSegundoPlano(fn) {
      aoFundo.push(fn);
      return () => {
        const i = aoFundo.indexOf(fn);
        if (i >= 0) aoFundo.splice(i, 1);
      };
    },
    /** Troca a simulação em uso (nova partida, carregar): o render percebe pelo diário e a interface relê tudo. */
    trocarSim(nova) {
      if (!nova || nova === sim) return;
      sim.tarefas?.desligar?.();
      if (trabalhador) nova.tarefas?.ligar?.(trabalhador);
      sim = nova;
      if (ui && !app.simUIFalsa) ui.trocarSim(nova);
      app.emitir('trocouSim', { sim: nova });
    },
    /** Nova partida (D34, D56): nome e cor da Holding e o modo; abre pausada (D10). */
    async novaPartida({ nome = 'Held', cor = '#c9a86a', modo = 'normal', semente = SEMENTE_PADRAO } = {}) {
      try {
        const nova = await criarSimDoTipo('partida', { semente, holding: { nome, cor }, modo, trabalhador: null });
        app.trocarSim(nova);
        return { ok: true };
      } catch (e) {
        console.error('nova partida', e);
        return { ok: false, codigo: 'valor' };
      }
    },
    salvar: nada,
    carregar: nada,
    listarSaves: async () => [],
    exportar: nada,
    importar: nada,
    /** A U2a troca salvar, carregar, listarSaves, exportar e importar pelas de verdade. */
    implementar(funcoes = {}) {
      for (const k of ['salvar', 'carregar', 'listarSaves', 'exportar', 'importar']) if (typeof funcoes[k] === 'function') app[k] = funcoes[k];
    },
    get velocidadeEfetiva() {
      return laco?.velocidadeEfetiva ?? 0;
    },
    simUIFalsa: null,
  };
  for (const m of MODULOS_APP) {
    try {
      m.registrar?.(app);
    } catch (e) {
      console.error('app: registro falhou', e);
    }
  }

  carga.fase('carga.cidade', 75);
  if (modoUI === 'vitrine') {
    // a pele sobre a cena: a interface lê a simulação falsa (números de uma cidade de 12 mil), o render a de verdade
    const { criarSimFalsa, criarJogoFalso } = await import('../../ferramentas/vitrine/sim-falsa.js');
    const falsa = criarSimFalsa({ cenario: qs.get('cenario') || 'meio' });
    app.simUIFalsa = falsa;
    ui = criarUI(raizUI, { sim: falsa, R, jogo: criarJogoFalso(falsa) });
    if (qs.get('tela')) ui.ui.abrirTela(qs.get('tela'));
  } else if (modoUI !== '0') {
    ui = criarUI(raizUI, { sim, R, jogo: app });
    if (qs.get('tela')) ui.ui.abrirTela(qs.get('tela'));
  }

  // segundo plano: pausa e avisa quem salva (U2a salva sem gzip, D31); ao voltar, a velocidade de antes. Com a
  // interface ligada à simulação, o comando passa pelas ações da interface; sem ela (cenas), direto.
  const mudarVelocidade = (v) => (ui && !app.simUIFalsa ? comando('velocidade', { v }, { silencioso: true }) : sim.cmd('velocidade', { v }));
  laco = criarLaco({
    obterSim: () => sim,
    R,
    ui,
    aoQuadro,
    aoSegundoPlano: (oculto) => {
      for (const fn of aoFundo) fn(oculto);
      app.emitir('segundoPlano', { oculto });
    },
    pausar: () => {
      const v = sim.velocidade ?? 0;
      if (v) mudarVelocidade(0);
      return v;
    },
    retomar: (v) => mudarVelocidade(v),
  });
  app.laco = laco;
  // a velocidade efetiva (D15: cai quando uma tarefa atrasa) e o segundo plano chegam à interface pela loja
  if (ui && !app.simUIFalsa) {
    const L = ui.ui.loja;
    app.aoQuadro(() => {
      const v = Math.round(laco.velocidadeEfetiva * 10) / 10;
      if (L.app.value.velocidadeEfetiva !== v) L.app.value = { ...L.app.value, velocidadeEfetiva: v };
    });
    app.on('segundoPlano', ({ oculto }) => (L.app.value = { ...L.app.value, segundoPlano: oculto }));
  }
  carga.fase('carga.pronto', 100);
  laco.iniciar();
  return app;
}
