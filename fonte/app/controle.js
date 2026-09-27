// Controle do app (seção 2.8): cria a simulação, o render e a interface, liga os três e o laço, e é o objeto `jogo`
// que a interface recebe (novaPartida, salvar, carregar, listarSaves, exportar, importar, prefs, evento 'salvo').
// Salvar, carregar e o diário são da U2a (app/armazem.js, diario.js, salvamento.js): entram por registrar(app) e
// trocam as funções por app.implementar({...}); até lá respondem { ok: false, codigo: 'nada' }. Os sons (som/*.js)
// entram do mesmo jeito. Comandos da interface passam por ui/acoes.js; o app usa as mesmas ações.
//
// Tipos de simulação: 'partida' (o jogo: nova partida mínima; enquanto o mapa da S1a não existe, um canteiro de prova
// de ruas e caixas sobre o chão plano), 'sintetica' (a cidade sintética de 12 mil prédios, ferramentas/
// cidade-sintetica.mjs) e 'vazia' (só o núcleo, para cenas que desenham sozinhas).
import { criarSimulacao } from '../sim/estado.js';
import { addNo, addAresta } from '../sim/vias/grafo.js';
import { celulasDaAresta, crescerNaFrente } from '../sim/substitutos.js';
import { somarPredios } from '../sim/agregados.js';
import { CELULA } from '../contratos/flags.js';
import { PREDIOS, modelosDaZona } from '../data/predios.js';
import { ZONAS_ORDEM } from '../data/zonas.js';
import { criarRender, obterCena } from '../render/index.js';
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

/** Câmeras de partida por tipo de simulação (graus; contrato em fonte/contratos/render.js). */
export const CAMERAS = Object.freeze({
  partida: { x: 0, z: 30, dist: 640, guinada: 24, inclinacao: 36 },
  sintetica: { x: 60, z: 240, dist: 3400, guinada: 18, inclinacao: 30 },
  vazia: { x: 0, z: 0, dist: 400, guinada: 0, inclinacao: 35 },
});

// ------------------------------------------------------------------------------------------------ canteiro de prova

const MISTURA = ['resBaixa', 'resBaixa', 'resMedia', 'comBaixa', 'resBaixa', 'industria', 'resMedia', 'comBaixa'];

/**
 * Canteiro de prova da F0 (sai sozinho quando o mapa da S1a publicar a Vila e a rodovia: só roda com o mundo vazio).
 * Seis ruas leste-oeste e cinco norte-sul numa grade de 112 m, uma avenida no eixo, células dos dois lados das ruas
 * leste-oeste e prédios de frente para elas, pelos mesmos substitutos que a cidade sintética usa. Determinístico.
 * @returns {number} prédios criados
 */
export function semearCanteiro(sim) {
  if (!sim.grafo || sim.tabelas.arestas.vivos || sim.tabelas.predios.vivos) return 0;
  const G = sim.grafo;
  const rng = sim.rng('canteiro');
  const xs = [-336, -224, -112, 0, 112, 224, 336];
  const zs = [-224, -112, 0, 112, 224];
  const no = new Map();
  for (const z of zs) for (const x of xs) no.set(`${x},${z}`, addNo(G, x, z));
  const ew = [];
  for (const z of zs) {
    for (let i = 0; i + 1 < xs.length; i++) {
      const e = addAresta(G, no.get(`${xs[i]},${z}`), no.get(`${xs[i + 1]},${z}`), 'rua');
      if (e >= 0) ew.push(e);
    }
  }
  for (const x of xs) for (let j = 0; j + 1 < zs.length; j++) addAresta(G, no.get(`${x},${zs[j]}`), no.get(`${x},${zs[j + 1]}`), x === 0 ? 'avenida' : 'rua');
  const C = sim.tabelas.celulas;
  let feitos = 0;
  for (const e of ew) {
    const { lados } = celulasDaAresta(sim, e);
    for (const lado of [1, -1]) {
      const colunas = lados[lado];
      if (!colunas.length) continue;
      const zona = MISTURA[rng.int(0, MISTURA.length - 1)];
      const zi = ZONAS_ORDEM.indexOf(zona);
      for (const col of colunas) for (const c of col) {
        C.zona[c] = zi;
        C.marcar(c);
      }
      const modelos = modelosDaZona(zona);
      let k = 0;
      while (k < colunas.length) {
        if (C.estado[colunas[k][0]] !== CELULA.LIVRE) {
          k++;
          continue;
        }
        let feito = -1;
        let largura = 1;
        for (const m of rng.embaralhar([...modelos])) {
          const [w, d] = PREDIOS[m].planta;
          if (k + w > colunas.length) continue;
          const lista = [];
          for (let i = k; i < k + w; i++) for (let r = 0; r < d; r++) lista.push(colunas[i][r]);
          if (lista.some((c) => c === undefined || C.estado[c] !== CELULA.LIVRE)) continue;
          feito = crescerNaFrente(sim, lista, { modelo: m, nivel: rng.int(1, 3), estilo: rng.int(0, 3), semente: rng.u32() });
          if (feito >= 0) {
            largura = w;
            break;
          }
        }
        if (feito >= 0) {
          feitos++;
          k += largura;
        } else k++;
      }
    }
  }
  somarPredios(sim);
  return feitos;
}

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
  const sim = criarSimulacao({ semente, holding, modo, trabalhador });
  semearCanteiro(sim);
  return sim;
}

const nada = async () => ({ ok: false, codigo: 'nada' });

/**
 * Monta o jogo.
 * @param {{ canvas: HTMLCanvasElement, raizUI: HTMLElement, qs: URLSearchParams, carga: { fase(chave, pct), sair() } }} op
 * @returns {Promise<object>} o app (jogo)
 */
export async function criarControle({ canvas, raizUI, qs, carga }) {
  const nomeCena = qs.get('cena') || null;
  const defCena = nomeCena ? obterCena(nomeCena) : null;
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
      if ('qualidade' in p && !qs.get('q')) R.qualidade(prefs.qualidade);
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
