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
import { t } from '../ui/textos.js';
import { avisar } from '../ui/loja.js';
import { opcoesDoToque } from '../render/camera/gesto.js';
import { criarLaco } from './laco.js';
import { ligarContexto, armazenamentoSessao, lerRetomada, limparRetomada } from './estavel.js';
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

/** As preferências do toque (TOQ1, D99) que a entrada do render recebe. */
export const PREFS_TOQUE = Object.freeze(['toqueArrasto', 'toquePinca', 'toqueGiro', 'toqueInercia']);

/** Aviso de tela cheia da perda do contexto gráfico: DOM puro, sem depender da interface (que pode estar num estado qualquer). */
function avisoDoContexto(fase) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('aviso-contexto');
  if (fase === 'seguiu') {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'aviso-contexto';
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;inset:0;z-index:95;display:flex;align-items:center;justify-content:center;background:rgba(11,15,20,.82);color:#EEF2F6;font:600 15px Inter,system-ui,sans-serif;letter-spacing:.04em;text-align:center;padding:24px';
    document.body.appendChild(el);
  }
  el.textContent = t(fase === 'perdeu' ? 'toq1.contexto.perdeu' : 'toq1.contexto.voltou');
}

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
  R.entrada?.opcoes?.(opcoesDoToque(prefs));

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
      if (PREFS_TOQUE.some((k) => k in p)) R.entrada?.opcoes?.(opcoesDoToque(prefs));
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
  const pausarTempo = () => {
    const v = sim.velocidade ?? 0;
    if (v) mudarVelocidade(0);
    return v;
  };
  laco = criarLaco({
    obterSim: () => sim,
    R,
    ui,
    aoQuadro,
    aoSegundoPlano: (oculto) => {
      for (const fn of aoFundo) fn(oculto);
      app.emitir('segundoPlano', { oculto });
    },
    pausar: pausarTempo,
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

  // estabilidade (TOQ1, D99): a perda do contexto WebGL recarrega pelo ?menu=continuar levando a câmera e a velocidade
  // do tempo; a página nova as retoma quando a partida abre (só no jogo de verdade: as cenas e a sintética ficam fora, e
  // o ?menu=0 também: sem menu nem save, a recarga abriria uma partida nova e perderia a de agora)
  if (!nomeCena && tipo === 'partida' && !app.simUIFalsa && qs.get('menu') !== '0') {
    app.contexto = ligarContexto({
      canvas,
      // com a aba no fundo o laço já pausou o tempo: a velocidade que vale é a de antes dele
      estado: () => ({ camera: R.camera.estado(), velocidade: (sim.velocidade ?? 0) || (laco.velocidadeAntesDoFundo ?? 0) }),
      pausar: pausarTempo,
      avisar: avisoDoContexto,
    });
    const armazem = armazenamentoSessao();
    const ret = lerRetomada(armazem);
    if (ret) {
      let solta = () => {};
      const aplicar = () => {
        solta();
        limparRetomada(armazem);
        try {
          if (ret.camera) R.camera.definir(ret.camera);
          if (ret.velocidade > 0) mudarVelocidade(ret.velocidade);
          avisar({ texto: t('toq1.retomou'), gravidade: 'info', glifo: 'ajustes' });
        } catch (e) {
          console.warn('retomada: não consegui aplicar', e);
        }
        try {
          const u = new URL(location.href);
          if (u.searchParams.get('menu') === 'continuar') {
            u.searchParams.delete('menu');
            history.replaceState(history.state, '', u.toString());
          }
        } catch (e) {
          // sem histórico
        }
      };
      solta = app.on('carregado', aplicar);
      // a partida não carregou (sem save): a retomada não fica esperando para sempre
      setTimeout(() => {
        solta();
        limparRetomada(armazem);
      }, 120000);
    }
  }
  return app;
}
