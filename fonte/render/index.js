// Render do jogo novo (seção 2.7): criarRender(canvas, opcoes) devolve a API R que a UI e o app usam. A UI nunca toca
// em objetos do three. Tudo entra por registro (D45): este arquivo tem o ÍNDICE FIXO dos módulos do render e nenhuma
// parcela o edita. Cada módulo exporta registrar(api) e usa:
//   api.registrarDominio(nome, fabrica, { substituto })   fabrica(ctx) → { nome, aplicar?(d, espelho, ctx, prazo),
//                                                            quadro?(tMs, ctx), descartar?() }; registrar o mesmo nome
//                                                            troca o substituto da F0 (depuracao.js)
//   (cenas fixas, ?cena=: só nos arquivos de render/cenas/, por registrar(registrarCena) do índice de lá; o app
//    precisa conhecer a cena antes de criar a simulação e o render, então ela não entra por esta api)
//   api.registrarTextura(nome, gerador)                    materiais/texturas.js
//   api.registrarSelecionavel(dominio, fn, { prioridade }) camera/selecao.js
//   api.ganchos                                            motor/ganchos.js (definir, aplicar, uniformes)
//   api.definirCamera(fabrica), api.definirEntrada(fabrica), api.definirRaio(fn)   a R1a troca as peças básicas
// Os geradores de malha do worker `oficina` registram-se lá (mundo/oficina.worker.js), não aqui.
//
// Os pedidos da UI às sobreposições (camadas, ferramentas, marcadores, seleção) viram avisos internos: o domínio dono
// ouve com ctx.ouvir(nome, fn) e lê o último valor em ctx.sobre[nome]. Nomes: 'camadas', 'ferramenta.via',
// 'ferramenta.zona', 'ferramenta.celulas', 'ferramenta.pincel', 'ferramenta.ladrilhos', 'ferramenta.fantasma',
// 'ferramenta.demolir', 'ferramenta.limpar', 'marcadores.atlas', 'marcadores', 'selecionado', 'qualidade', 'estado'.
import * as THREE from 'three';
import { criarRenderizador, vigiarContexto } from './motor/renderizador.js';
import { PERFIS, sugerirPerfil, perfilDe, razaoDePixels } from './motor/perfis.js';
import { Quadro, SombraPropria } from './motor/quadro.js';
import { Medidas } from './motor/medidas.js';
import { ganchos } from './motor/ganchos.js';
import { PonteRender } from './ponte.js';
import { registrarTextura, ligarTexturas, textura, memoriaTexturasMB, THREE_TEXTURAS } from './materiais/texturas.js';
import { registrarSelecionavel, selecionarPorRaio, PRIORIDADE } from './camera/selecao.js';
import { registrarCena, obterCena, carregarCena, listarCenas } from './cenas/index.js';
import * as depuracao from './depuracao.js';
import { AGUA } from '../contratos/flags.js';
import { celulaEm } from '../comum/altura.js';

import * as motorPos from './motor/pos.js';
import * as motorResolucao from './motor/resolucao.js';
import * as motorBancada from './motor/bancada.js';
import * as motorCapacidades from './motor/capacidades.js';
import * as motorFaixas from './motor/faixas.js';
import * as astro from './ambiente/astro.js';
import * as ceu from './ambiente/ceu.js';
import * as ibl from './ambiente/ibl.js';
import * as exposicao from './ambiente/exposicao.js';
import * as neblina from './ambiente/neblina.js';
import * as sol from './ambiente/sol.js';
import * as nuvens from './ambiente/nuvens.js';
import * as campoAlturas from './ambiente/campoAlturas.js';
import * as sombraLonge from './ambiente/sombraLonge.js';
import * as luzNoite from './ambiente/luzNoite.js';
import * as sombraProjetores from './sombra/projetores.js';
import * as sombraMapa from './sombra/mapa.js';
import * as camera from './camera/camera.js';
import * as entrada from './camera/entrada.js';
import * as raio from './camera/raio.js';
import * as biblioteca from './materiais/biblioteca.js';
import * as texturasChao from './materiais/texturas-chao.js';
import * as texturasVia from './materiais/texturas-via.js';
import * as texturasPredio from './materiais/texturas-predio.js';
import * as terreno from './mundo/terreno.js';
import * as agua from './mundo/agua.js';
import * as fora from './mundo/fora.js';
import * as vegetacao from './mundo/vegetacao.js';
import * as vias from './mundo/vias.js';
import * as luzRua from './mundo/luzRua.js';
import * as props from './mundo/props.js';
import * as trafego from './mundo/trafego.js';
import * as pedestres from './mundo/pedestres.js';
import * as caminhoes from './mundo/caminhoes.js';
import * as predios from './mundo/predios.js';
import * as setores from './mundo/setores.js';
import * as oficina from './mundo/oficina.js';
import * as instancias from './mundo/instancias.js';
import * as obras from './mundo/obras.js';
import * as anexos from './mundo/anexos.js';
import * as lotes from './mundo/lotes.js';
import * as colocaveis from './colocaveis/index.js';
import * as colocaveisDominio from './colocaveis/dominio.js';
import * as iates from './vida/iates.js';
import * as navios from './vida/navios.js';
import * as jatos from './vida/jatos.js';
import * as torre from './arcologia/torre.js';
import * as planos from './arcologia/planos.js';
import * as partes from './arcologia/partes.js';
import * as lago from './arcologia/lago.js';
import * as fantasma from './arcologia/fantasma.js';
import * as arcoObra from './arcologia/obra.js';
import * as heli from './arcologia/heli.js';
import * as sobreFerramentas from './sobreposicoes/ferramentas.js';
import * as sobreCamadas from './sobreposicoes/camadas.js';
import * as sobreMarcadores from './sobreposicoes/marcadores.js';
import * as sobreAncoras from './sobreposicoes/ancoras.js';

export { registrarCena, registrarTextura, registrarSelecionavel, ganchos, listarCenas, obterCena, carregarCena, PERFIS, sugerirPerfil };

/** Índice fixo, na ordem de registro (a depuração vem antes: os donos trocam os substitutos dela). */
export const MODULOS_RENDER = Object.freeze([
  motorPos, motorResolucao, motorBancada, motorCapacidades, motorFaixas,
  astro, ceu, ibl, exposicao, neblina, sol, nuvens, campoAlturas, sombraLonge, luzNoite,
  sombraProjetores, sombraMapa, camera, entrada, raio,
  biblioteca, texturasChao, texturasVia, texturasPredio,
  terreno, agua, fora, vegetacao, vias, luzRua, props, trafego, pedestres, caminhoes,
  predios, setores, oficina, instancias, obras, anexos, lotes, colocaveis, colocaveisDominio,
  iates, navios, jatos,
  torre, planos, partes, lago, fantasma, arcoObra, heli,
  sobreFerramentas, sobreCamadas, sobreMarcadores, sobreAncoras,
]);

// ------------------------------------------------------------------------------------------------ registro

/** Registros de uma instância do render (cada criarRender monta os seus a partir do índice). */
function coletarRegistros({ forcarDepuracao = false } = {}) {
  const dominios = [];
  const pecas = { camera: null, entrada: null, raio: null };
  const api = {
    THREE: THREE_TEXTURAS, // subconjunto (materiais/texturas.js): o namespace como valor impedia a poda do three
    ganchos,
    registrarTextura,
    registrarSelecionavel,
    registrarDominio(nome, fabrica, { substituto = false } = {}) {
      if (typeof fabrica !== 'function') throw new Error(`registrarDominio(${nome}): fabrica(ctx)`);
      const i = dominios.findIndex((d) => d.nome === nome);
      if (i >= 0) {
        const velho = dominios[i];
        if (!velho.substituto && !substituto) throw new Error(`domínio repetido: ${nome}`);
        if (substituto && !velho.substituto) return; // o dono já registrou
        if (forcarDepuracao && velho.substituto) return; // ?depuracao=1 mantém a vista de depuração
        dominios.splice(i, 1);
      }
      dominios.push({ nome, fabrica, substituto });
    },
    definirCamera(fabrica) {
      if (!forcarDepuracao) pecas.camera = fabrica;
    },
    definirEntrada(fabrica) {
      if (!forcarDepuracao) pecas.entrada = fabrica;
    },
    definirRaio(fn) {
      if (!forcarDepuracao) pecas.raio = fn;
    },
  };
  depuracao.registrar(api);
  for (const m of MODULOS_RENDER) m.registrar?.(api);
  return { dominios, pecas };
}

// ------------------------------------------------------------------------------------------------ render

const HORA_SEMPRE_DIA = 11;
/** Velocidade do voo de câmera, em unidades de S (caminhoVoo) por segundo. */
const VEL_VOO = 1.1;

/**
 * Cria o render sobre o canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {{ sim: { espelho: object, mudancas: object }, qualidade?: string, semClip?: boolean, pr?: number,
 *           cena?: string | null, camera?: object, solAnda?: boolean, hora?: number | null, depuracao?: boolean }} opcoes
 *   sim: a fonte que o render lê a cada quadro (pode ter getters que apontam para a simulação atual do app)
 * @returns {Promise<object>} R (contrato em fonte/contratos/render.js)
 */
export async function criarRender(canvas, opcoes = {}) {
  const { sim, qualidade = 'auto', semClip = false, pr: prFixo = 0, cena: nomeCena = null, solAnda = false, depuracao: forcarDepuracao = false } = opcoes;
  const defCena = nomeCena ? await carregarCena(nomeCena) : null;
  if (nomeCena && !defCena) throw new Error(`cena desconhecida: ${nomeCena} (registradas: ${listarCenas().join(', ') || 'nenhuma'})`);

  // perfil pelo aparelho (D33) e o renderizador
  const qPedida = qualidade === 'auto' && defCena?.perfil ? defCena.perfil : qualidade;
  const provisorio = PERFIS[qPedida] ?? PERFIS.media;
  const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
  const rz = criarRenderizador(canvas, { msaa: provisorio.msaa, pr: razaoDePixels(provisorio, dpr, prFixo) });
  const sugerido = sugerirPerfil({ gpu: rz.gpu, movel: rz.movel });
  let perfil = perfilDe(qPedida === 'auto' ? sugerido : qPedida, sugerido);
  const contexto = vigiarContexto(canvas, {});

  const { dominios: registrados, pecas } = coletarRegistros({ forcarDepuracao });
  const cena = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(40, 1, 0.5, 20000);
  const medidas = new Medidas(rz.renderer, { perfil: perfil.id, capac: rz.capac });
  medidas.stats.msaa = rz.gl.getParameter(rz.gl.SAMPLES) || 0; // o MSAA do canvas (a R1a leva para o alvo HDR)
  const sombra = new SombraPropria({ tam: perfil.sombra.tam, degrauGraus: perfil.sombra.degrau });
  const ouvintes = new Map();
  const tempoForcado = { hora: null, anda: false, hora0: 0, sempreDia: false };

  const ctx = {
    THREE: THREE_TEXTURAS,
    canvas,
    renderer: rz.renderer,
    gl: rz.gl,
    capac: rz.capac,
    gpu: rz.gpu,
    semClip: !!semClip || !rz.capac.clipControl,
    perfil,
    pr: razaoDePixels(perfil, dpr, prFixo),
    cena,
    camera: cam,
    sombra,
    ganchos,
    medidas,
    get stats() {
      return medidas.stats;
    },
    sim,
    sol: { dir: new THREE.Vector3(0.4, 0.8, 0.3).normalize(), dia: 1 },
    sobre: {},
    montagem: typeof window !== 'undefined' ? window.__HELD_MONTAGEM__ ?? null : null,
    quadros: 0,
    textura,
    ouvir(nome, fn) {
      const l = ouvintes.get(nome) ?? [];
      l.push(fn);
      ouvintes.set(nome, l);
      return () => ouvintes.set(nome, (ouvintes.get(nome) ?? []).filter((f) => f !== fn));
    },
    emitir(nome, valor) {
      ctx.sobre[nome] = valor;
      for (const fn of ouvintes.get(nome) ?? []) {
        try {
          fn(valor, ctx);
        } catch (e) {
          console.error(`render: ouvinte de ${nome} falhou:`, e);
        }
      }
    },
    /** Hora do céu que o render usa: a do espelho (D9), a forçada (cenas, modo foto) ou a de "Sempre dia". */
    horaDoCeu() {
      const h = sim?.espelho?.tempo?.hora ?? 10;
      if (tempoForcado.sempreDia && tempoForcado.hora === null) return HORA_SEMPRE_DIA;
      if (tempoForcado.hora === null) return h;
      if (!tempoForcado.anda) return tempoForcado.hora;
      return (((tempoForcado.hora + h - tempoForcado.hora0) % 24) + 24) % 24;
    },
    dominio: (nome) => instancias.get(nome) ?? null,
    criarWorker(nome) {
      const url = ctx.montagem?.workers?.[nome];
      if (!url || typeof Worker === 'undefined') return null;
      try {
        return new Worker(url);
      } catch (e) {
        console.warn(`render: worker ${nome} não abriu:`, e);
        return null;
      }
    },
  };
  ligarTexturas({ renderer: rz.renderer, THREE: THREE_TEXTURAS, perfil });

  const quadro = new Quadro(ctx);
  quadro.medirTela();

  // peças básicas (a R1a troca por registro)
  const inicial = { ...(opcoes.camera ?? {}), ...(defCena?.camera ?? {}) };
  const camApi = (pecas.camera ?? depuracao.criarCameraBasica)(ctx, inicial);
  ctx.cameraApi = camApi;
  const raioFn = pecas.raio ?? ((c, x, y) => depuracao.raioNoChao(c.sim.espelho.terreno, depuracao.raioDaTela(c.camera, quadro.w, quadro.h, x, y)));
  ctx.raio = (x, y) => raioFn(ctx, x, y);
  const entradaApi = (pecas.entrada ?? depuracao.criarEntradaBasica)(ctx, camApi);

  // chão e água como últimos da seleção
  registrarSelecionavel(
    'chao',
    (r, c) => {
      const T = c.sim.espelho.terreno;
      // o raio publicado (o da R1a, quando existir) acerta o chão; sem ponto de tela, a marcha básica
      const p = Number.isFinite(r.xTela) ? c.raio(r.xTela, r.yTela) : depuracao.raioNoChao(T, r);
      if (!p) return null;
      const a = T?.agua ? celulaEm(T.agua, T.n, T.passo, T.origem[0] - T.passo / 2, T.origem[1] - T.passo / 2, p[0], p[2]) : 0;
      return { tipo: a && a !== AGUA.TERRA ? 'agua' : 'terreno', ref: null, idx: -1, ponto: p, dist: Math.hypot(p[0] - r.origem[0], p[1] - r.origem[1], p[2] - r.origem[2]) };
    },
    { prioridade: PRIORIDADE.chao },
  );

  // domínios (a cena pode pedir nenhum ou só alguns)
  const querDom = defCena ? defCena.dominios : true;
  const instancias = new Map();
  for (const d of registrados) {
    if (querDom === false || (Array.isArray(querDom) && !querDom.includes(d.nome))) continue;
    const inst = d.fabrica(ctx) ?? {};
    inst.nome ??= d.nome;
    instancias.set(d.nome, inst);
  }
  const ponte = new PonteRender(sim);

  // cena fixa
  let instCena = null;
  if (defCena) {
    const hora = Number.isFinite(opcoes.hora) ? opcoes.hora : defCena.hora;
    if (Number.isFinite(hora)) {
      tempoForcado.hora = hora;
      tempoForcado.anda = !!solAnda;
      tempoForcado.hora0 = sim?.espelho?.tempo?.hora ?? 0;
    }
    instCena = (await defCena.montar(ctx)) ?? {};
  } else if (Number.isFinite(opcoes.hora)) {
    tempoForcado.hora = opcoes.hora;
    tempoForcado.anda = !!solAnda;
    tempoForcado.hora0 = sim?.espelho?.tempo?.hora ?? 0;
  }

  const alvoSombra = new THREE.Vector3();
  function acompanharSombra() {
    if (instCena?.sombraPropria) return; // a cena cuida da sombra dela
    camApi.alvo(alvoSombra);
    const dist = cam.position.distanceTo(alvoSombra);
    const raio = Math.min(perfil.sombra.raioMax, Math.max(60, 0.6 * dist));
    sombra.acompanhar(alvoSombra, raio, ctx.sol.dir);
  }

  const doms = () => instancias.values();
  let descartado = false;
  const agora = () => (typeof performance !== 'undefined' ? performance.now() : 0);

  /** Um quadro: diário, domínios, sombra e o desenho (forcar: desenha mesmo acima do teto de qps do estado). */
  function fazerQuadro(tMs, forcar = false) {
    if (descartado || contexto.perdido()) return false;
    ctx.quadros++;
    quadro.medirTela();
    camApi.atualizar(tMs);
    ponte.quadro(doms(), ctx);
    for (const d of doms()) {
      try {
        d.quadro?.(tMs, ctx);
      } catch (e) {
        console.error(`render: domínio ${d.nome} falhou no quadro:`, e);
      }
    }
    instCena?.quadro?.(tMs, ctx);
    acompanharSombra();
    const desenhou = forcar || quadro.vez(tMs);
    if (desenhou) quadro.desenhar(tMs);
    medidas.stats.memoria.texturasMB = +memoriaTexturasMB().toFixed(1);
    return desenhou;
  }

  const R = {
    /** Lê o diário e desenha um quadro (o laço do app chama a cada requestAnimationFrame). */
    quadro(tMs = agora()) {
      fazerQuadro(tMs);
    },
    camera: {
      irPara: (alvo, ms) => camApi.irPara(alvo, ms),
      estado: () => camApi.estado(),
      definir: (e) => camApi.definir(e),
    },
    entrada: {
      modo: (m) => entradaApi.modo(m),
      aoFerramenta: (fn) => entradaApi.aoFerramenta(fn),
      opcoes: (o) => entradaApi.opcoes(o),
      /** (F0) toque curto ou longo no mundo: fn({ x, y, longo }). A UI seleciona com R.selecionar(x, y). */
      aoToque: (fn) => entradaApi.aoToque?.(fn),
    },
    selecionar(x, y) {
      const r = depuracao.raioDaTela(cam, quadro.w, quadro.h, x, y);
      return selecionarPorRaio({ ...r, xTela: x, yTela: y }, ctx);
    },
    // "na frente" decidido no espaço da câmera (R1a): com a profundidade invertida, o z da tela não serve
    projetar: (p) => raio.projetarNaTela(cam, quadro.w, quadro.h, p),
    raio: (x, y) => ctx.raio(x, y),
    ancoras: (lista) => lista.map((p) => R.projetar(p)),
    camadas: {
      mostrar: (c) => ctx.emitir('camadas', c),
      ocultar: () => ctx.emitir('camadas', null),
    },
    ferramenta: {
      via: { previa: (plano, estilo = 'normal') => ctx.emitir('ferramenta.via', plano ? { plano, estilo } : null) },
      zona: {
        mostrar: (b) => ctx.emitir('ferramenta.zona', !!b),
        celulas: (celulas, zona) => ctx.emitir('ferramenta.celulas', { celulas, zona }),
      },
      pincel: (p) => ctx.emitir('ferramenta.pincel', p),
      ladrilhos: (b) => ctx.emitir('ferramenta.ladrilhos', !!b),
      fantasma: (f) => ctx.emitir('ferramenta.fantasma', f),
      demolir: (refs) => ctx.emitir('ferramenta.demolir', refs ?? []),
      limpar: () => ctx.emitir('ferramenta.limpar', true),
    },
    marcadores: {
      atlas: (cv, mapa) => ctx.emitir('marcadores.atlas', { canvas: cv, mapa }),
      definir: (lista) => ctx.emitir('marcadores', lista ?? []),
    },
    // aceita { tipo, ref } (o domínio do selecionado) ou só a ref (um prédio, como antes); 'selecionado' leva a ref do
    // prédio ou do colocável (predios.js) e 'selecao' leva { tipo, ref } para os outros domínios (a aresta das vias)
    selecionado(s) {
      const sel = s == null ? null : typeof s === 'object' ? { tipo: s.tipo ?? 'predio', ref: s.ref ?? null } : { tipo: 'predio', ref: s };
      ctx.emitir('selecionado', sel && (sel.tipo === 'predio' || sel.tipo === 'colocavel') ? sel.ref : null);
      ctx.emitir('selecao', sel);
    },
    tempo: {
      /** { fase } (modo foto, D42), ou { hora, anda } (cenas e testes), ou null para voltar ao relógio do jogo. */
      forcar(f) {
        if (!f) {
          tempoForcado.hora = null;
          return;
        }
        const hora = Number.isFinite(f.hora) ? f.hora : depuracao.HORA_DA_FASE[f.fase];
        tempoForcado.hora = Number.isFinite(hora) ? hora : null;
        tempoForcado.anda = !!f.anda;
        tempoForcado.hora0 = sim?.espelho?.tempo?.hora ?? 0;
      },
    },
    sempreDia(b) {
      tempoForcado.sempreDia = !!b;
    },
    estado(e) {
      quadro.estado = e in { livre: 1, coberto: 1, foto: 1, teste: 1 } ? e : 'livre';
      ctx.emitir('estado', quadro.estado);
    },
    qualidade(id) {
      const novo = perfilDe(id === 'auto' ? sugerido : id, sugerido);
      if (novo === perfil) return;
      perfil = novo;
      ctx.perfil = novo;
      ctx.pr = razaoDePixels(novo, dpr, prFixo);
      medidas.stats.perfil = novo.id;
      ligarTexturas({ renderer: rz.renderer, THREE: THREE_TEXTURAS, perfil: novo });
      sombra.redimensionar(novo.sombra.tam);
      sombra.degrau = novo.sombra.degrau * (Math.PI / 180);
      ctx.emitir('qualidade', novo);
      // o MSAA do canvas só muda num contexto novo: a R1a leva o MSAA para o alvo HDR (troca na hora)
    },
    perfil: () => ({ id: perfil.id, sugerido, capac: rz.capac, gpu: rz.gpu }),
    /**
     * Promessa do aquecimento dos programas (D66, motor/quadro.js): resolve com o relatório quando a rodada final
     * termina, de 2,5 a 12 s depois do primeiro quadro. O app segura a tela de carga até ela.
     */
    aquecido: () => quadro.aquecimento?.promessa ?? Promise.resolve(null),
    get stats() {
      return medidas.stats;
    },
    /**
     * Teste de desempenho: o domínio 'bancada' da R1a (ctx.bancada: resolução travada, ms de GPU, programas contados
     * contra a guarda do Mali); sem ele, a primeira versão da F0 mede n quadros parados na vista atual.
     */
    async bancada(op = {}) {
      if (ctx.bancada) return ctx.bancada(op);
      const { quadros = 120 } = op;
      const esperar = () => new Promise((ok) => requestAnimationFrame(ok));
      const ms = [];
      let t = performance.now();
      for (let i = 0; i < quadros; i++) {
        await esperar();
        const n = performance.now();
        ms.push(n - t);
        t = n;
      }
      ms.sort((a, b) => a - b);
      const s = medidas.stats;
      const media = ms.reduce((a, b) => a + b, 0) / ms.length;
      return {
        perfil: perfil.id, sugerido, msMedio: +media.toFixed(2), p95: +ms[Math.floor(ms.length * 0.95)].toFixed(2), qps: +(1000 / media).toFixed(1),
        calls: s.calls, tris: s.tris, pior: { ...s.pior }, gpuMs: s.gpuMs, familias: { ...s.familias },
        programas: (rz.renderer.info.programs ?? []).map((p) => ({ nome: p.name, amostradores: null, varyings: null, uniformesF: null, atributos: null, msCompilar: null })),
        capac: rz.capac,
      };
    },
    /**
     * Imagem da vista atual (capa do save, D31): desenha um quadro (mesmo com uma tela aberta, acima do teto de qps) e
     * copia o canvas no mesmo passo, antes de o navegador compor e limpar o buffer.
     */
    capa(w = 640, h = 288) {
      return new Promise((ok) => {
        fazerQuadro(agora(), true);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d');
        const k = Math.max(w / canvas.width, h / canvas.height);
        const sw = w / k;
        const sh = h / k;
        g.drawImage(canvas, (canvas.width - sw) / 2, (canvas.height - sh) / 2, sw, sh, 0, 0, w, h);
        c.toBlob(ok, 'image/jpeg', 0.82);
      });
    },
    foto: ({ w = 1920, h = 1080 } = {}) => R.capa(w, h),
    /** Voo de câmera com a duração pelo comprimento S do caminho de van Wijk e Nuij (caminhoVoo): 0,8 a 4,5 s. */
    voo(alvo = {}) {
      const de = camApi.estado();
      const w1 = Number.isFinite(alvo.dist) ? alvo.dist : de.dist;
      const d = Math.hypot((Number.isFinite(alvo.x) ? alvo.x : de.x) - de.x, (Number.isFinite(alvo.z) ? alvo.z : de.z) - de.z);
      const S = camera.caminhoVoo(Math.max(1, de.dist), Math.max(1, w1), d).S;
      return camApi.irPara(alvo, Math.min(4500, Math.max(800, (1000 * (Number.isFinite(S) ? S : 2.6)) / VEL_VOO)));
    },
    /** Resultado da cena fixa (window.__resultado) ou null. */
    resultado: () => (instCena?.resultado ? instCena.resultado() : null),
    /** Nomes dos domínios ativos (substitutos marcados). */
    dominios: () => [...instancias.values()].map((d) => (registrados.find((r) => r.nome === d.nome)?.substituto ? `${d.nome} (substituto)` : d.nome)),
    descartar() {
      if (descartado) return;
      descartado = true;
      for (const d of doms()) d.descartar?.();
      instCena?.descartar?.();
      // a entrada solta os ouvintes mesmo quando a cena exclui o domínio 'entrada'; o quadro solta o resize e o pós
      entradaApi.descartar?.();
      quadro.descartar();
      sombra.descartar();
      rz.renderer.dispose();
    },
  };
  Object.defineProperty(R, '_ctx', { value: ctx, enumerable: false });
  return R;
}
